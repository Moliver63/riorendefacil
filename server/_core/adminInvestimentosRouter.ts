/**
 * Back-office do investimento: investidores, contratos e resgates.
 * Montado dentro do adminRouter (admin.investidores / admin.contratos / admin.resgates).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { router, adminProcedure } from "./trpc";
import { db } from "../db";
import { cadastros, contratos, investidores, ofertas, reservas, resgatesRendimento, usuarios } from "../schema";
import { carregarEmissor, pendenciasParaCaptar } from "../../shared/issuer";
import { tetoDaFaixa, formatarBRL, formatarPct, type Faixa } from "../../shared/finance";
import { mascararCpf } from "../../shared/cadastro";
import { auditar } from "../auditoria";
import { cadastroRevelado, getCadastro, qualificacaoDoCadastro } from "../cadastroService";
import {
  STATUS_CONTRATO_ROTULO,
  exigirStatus,
  extratoDoContrato,
  getContrato,
  resgatesDoContrato,
  saldoDoContrato,
  somarMeses,
  totalResgatado,
} from "../contratoService";
import { exigirCoberturaParaNovoPrincipal, lancar } from "../lastroService";
import { prazoValido } from "../../shared/lastroGraos";
import { emailAporteConfirmado, emailContratoGerado, emailResgatePago, emailResgateRecusado, enviarEmail } from "./email";

async function emailDoInvestidor(investidorId: number) {
  const [r] = await db
    .select({ email: usuarios.email, nome: usuarios.nome })
    .from(investidores)
    .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
    .where(eq(investidores.id, investidorId))
    .limit(1);
  return r ?? null;
}

const idSchema = z.object({ id: z.number().int() });

export const investimentosRoutes = {
  // ─── Investidores ──────────────────────────────────────────────────────────
  investidores: router({
    listar: adminProcedure.query(async () => {
      const linhas = await db
        .select({
          id: investidores.id,
          email: usuarios.email,
          nome: usuarios.nome,
          suitability: investidores.suitability,
          suitabilityRespostas: investidores.suitabilityRespostas,
          trilhaConcluidaEm: investidores.trilhaConcluidaEm,
          interesseAporteEm: investidores.interesseAporteEm,
          ppe: investidores.pessoaPoliticamenteExposta,
          cadastroEm: cadastros.atualizadoEm,
          nomeCompleto: cadastros.nomeCompleto,
          cpfFinal: cadastros.cpfFinal,
          criadoEm: investidores.criadoEm,
          contratos: sql<number>`(select count(*)::int from ${contratos} c where c.investidor_id = ${investidores.id} and c.status <> 'cancelado')`,
          reservaCentavos: sql<number>`(select coalesce(sum(r.valor_centavos), 0)::bigint from ${reservas} r where r.investidor_id = ${investidores.id} and r.status = 'ativa')`,
        })
        .from(investidores)
        .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
        .leftJoin(cadastros, eq(cadastros.investidorId, investidores.id))
        .orderBy(desc(investidores.interesseAporteEm), desc(investidores.criadoEm))
        .limit(500);
      return linhas.map(({ suitabilityRespostas, cpfFinal, ...l }) => ({
        ...l,
        reservaCentavos: Number(l.reservaCentavos),
        cpfMascarado: cpfFinal ? mascararCpf(cpfFinal) : null,
        perfilAdequado: Boolean((suitabilityRespostas as { adequado?: boolean } | null)?.adequado),
      }));
    }),

    /** Ficha completa com dados decifrados. Cada visualização fica na auditoria. */
    detalhe: adminProcedure.input(idSchema).query(async ({ ctx, input }) => {
      const [inv] = await db
        .select({ inv: investidores, email: usuarios.email, nome: usuarios.nome })
        .from(investidores)
        .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
        .where(eq(investidores.id, input.id))
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investidor não encontrado." });
      const cad = await getCadastro(input.id);
      await auditar({ atorId: ctx.usuario.id, acao: "cadastro_visualizado", entidade: "investidor", entidadeId: input.id, ip: ctx.ip });
      const lista = await db.select().from(contratos).where(eq(contratos.investidorId, input.id)).orderBy(desc(contratos.criadoEm));
      const minhasReservas = await db
        .select({ r: reservas, oferta: ofertas.nome, codigo: ofertas.codigo })
        .from(reservas)
        .innerJoin(ofertas, eq(reservas.ofertaId, ofertas.id))
        .where(eq(reservas.investidorId, input.id))
        .orderBy(desc(reservas.criadoEm));
      return {
        reservas: minhasReservas.map(({ r, oferta, codigo }) => ({ ...r, taxaMensal: Number(r.taxaMensal), oferta, codigo })),
        id: inv.inv.id,
        email: inv.email,
        nome: inv.nome,
        suitability: inv.inv.suitability,
        perfil: inv.inv.suitabilityRespostas as { adequado?: boolean; motivo?: string; perfil?: string } | null,
        trilhaConcluidaEm: inv.inv.trilhaConcluidaEm,
        interesseAporteEm: inv.inv.interesseAporteEm,
        cadastro: cad ? cadastroRevelado(cad) : null,
        contratos: await Promise.all(
          lista.map(async (c) => {
            const resgatado = await totalResgatado(c.id);
            const s = saldoDoContrato(c, c.status === "ativo" ? await resgatesDoContrato(c) : []);
            return {
              ...c,
              taxaMensal: Number(c.taxaMensal),
              statusRotulo: STATUS_CONTRATO_ROTULO[c.status] ?? c.status,
              resgatadoCentavos: resgatado,
              disponivelCentavos: s.disponivelCentavos,
            };
          }),
        ),
      };
    }),
  }),

  // ─── Contratos ─────────────────────────────────────────────────────────────
  contratos: router({
    listar: adminProcedure.query(() =>
      db
        .select({
          id: contratos.id,
          investidorId: contratos.investidorId,
          nome: cadastros.nomeCompleto,
          email: usuarios.email,
          oferta: ofertas.nome,
          principalCentavos: contratos.principalCentavos,
          taxaMensal: contratos.taxaMensal,
          prazoMeses: contratos.prazoMeses,
          status: contratos.status,
          inicio: contratos.inicio,
          vencimento: contratos.vencimento,
          criadoEm: contratos.criadoEm,
        })
        .from(contratos)
        .innerJoin(investidores, eq(contratos.investidorId, investidores.id))
        .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
        .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
        .leftJoin(cadastros, eq(cadastros.investidorId, investidores.id))
        .orderBy(desc(contratos.criadoEm))
        .limit(500),
    ),

    /**
     * Cria o contrato. Exige emissor habilitado, oferta ativa, trilha concluída,
     * perfil adequado e cadastro completo. A taxa sai do quadro de faixas da
     * oferta; o admin não digita taxa.
     */
    criar: adminProcedure
      .input(
        z.object({
          investidorId: z.number().int(),
          ofertaId: z.number().int(),
          principalCentavos: z.number().int().min(100_00),
          prazoMeses: z.number().int().refine(prazoValido, "O prazo deve ser de 12, 24 ou 36 meses."),
          observacoes: z.string().max(2000).optional(),
          reservaId: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const pend = pendenciasParaCaptar(carregarEmissor(process.env));
        if (pend.length) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Captação travada até resolver: ${pend.join("; ")}.` });
        }
        const [o] = await db.select().from(ofertas).where(eq(ofertas.id, input.ofertaId)).limit(1);
        if (!o || !o.ativa) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Escolha uma oferta ativa." });

        const [inv] = await db.select().from(investidores).where(eq(investidores.id, input.investidorId)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Investidor não encontrado." });
        if (!inv.trilhaConcluidaEm) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O investidor ainda não concluiu a trilha." });
        const perfil = inv.suitabilityRespostas as { adequado?: boolean } | null;
        if (!perfil?.adequado) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Perfil do investidor não avaliado ou não adequado." });
        const cad = await getCadastro(inv.id);
        if (!cad) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O investidor ainda não completou o cadastro." });

        const taxa = tetoDaFaixa(o.faixas as Faixa[], input.principalCentavos, input.prazoMeses);
        if (taxa === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor ou prazo fora das faixas desta oferta." });
        if (input.prazoMeses * 30 < o.carenciaPrincipalDias) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Prazo menor que a carência do principal (${o.carenciaPrincipalDias} dias).` });
        }
        await exigirCoberturaParaNovoPrincipal(o.id, input.principalCentavos);

        const [c] = await db
          .insert(contratos)
          .values({
            investidorId: inv.id,
            ofertaId: o.id,
            principalCentavos: input.principalCentavos,
            taxaMensal: taxa.toFixed(6),
            prazoMeses: input.prazoMeses,
            status: "aguardando_assinatura",
            qualificacao: qualificacaoDoCadastro(cad),
            observacoes: input.observacoes ?? null,
            criadoPor: ctx.usuario.id,
          })
          .returning();
        if (input.reservaId) {
          await db
            .update(reservas)
            .set({ status: "convertida", contratoId: c!.id, atualizadoEm: new Date() })
            .where(sql`${reservas.id} = ${input.reservaId} and ${reservas.investidorId} = ${inv.id} and ${reservas.status} = 'ativa'`);
        }
        await auditar({
          atorId: ctx.usuario.id,
          acao: "contrato_criado",
          entidade: "contrato",
          entidadeId: c!.id,
          dados: { investidorId: inv.id, principal: input.principalCentavos, taxa, prazo: input.prazoMeses },
          ip: ctx.ip,
        });
        const dest = await emailDoInvestidor(inv.id);
        if (dest) {
          void enviarEmail({
            para: dest.email,
            assunto: "Seu contrato está pronto para leitura",
            html: emailContratoGerado({ nome: cad.nomeCompleto, contratoId: c!.id, valor: formatarBRL(input.principalCentavos), taxa: formatarPct(taxa), prazo: input.prazoMeses }),
          });
        }
        return c!;
      }),

    /** Registra que o contrato foi assinado (manual até integrar ZapSign/Clicksign). */
    marcarAssinado: adminProcedure
      .input(z.object({ id: z.number().int(), assinaturaRef: z.string().max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        const c = await getContrato(input.id);
        exigirStatus(c, "aguardando_assinatura");
        await db
          .update(contratos)
          .set({ status: "aguardando_aporte", assinadoEm: new Date(), assinaturaProvedor: "manual", assinaturaRef: input.assinaturaRef ?? null })
          .where(eq(contratos.id, c.id));
        await auditar({ atorId: ctx.usuario.id, acao: "contrato_assinado", entidade: "contrato", entidadeId: c.id, dados: { ref: input.assinaturaRef }, ip: ctx.ip });
        return { ok: true as const };
      }),

    /**
     * Confirma que o aporte caiu na conta vinculada do emissor. A partir da data
     * de início o rendimento passa a contar. O dinheiro nunca passa por aqui.
     */
    confirmarAporte: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          comprovanteChave: z.string().startsWith("docs/").max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const c = await getContrato(input.id);
        exigirStatus(c, "aguardando_aporte");
        const hoje = new Date().toISOString().slice(0, 10);
        if (input.inicio > hoje) throw new TRPCError({ code: "BAD_REQUEST", message: "A data de início não pode ser no futuro." });
        const vencimento = somarMeses(input.inicio, c.prazoMeses);
        await db
          .update(contratos)
          .set({ status: "ativo", inicio: input.inicio, vencimento, ativadoEm: new Date(), comprovanteAporteChave: input.comprovanteChave ?? null })
          .where(eq(contratos.id, c.id));
        await lancar({
          ofertaId: c.ofertaId,
          tipo: "aporte",
          valorCentavos: c.principalCentavos,
          descricao: `Aporte do contrato #${c.id}`,
          data: input.inicio,
          contratoId: c.id,
          comprovanteChave: input.comprovanteChave,
          criadoPor: ctx.usuario.id,
        });
        await auditar({ atorId: ctx.usuario.id, acao: "aporte_confirmado", entidade: "contrato", entidadeId: c.id, dados: { inicio: input.inicio, vencimento }, ip: ctx.ip });
        const dest = await emailDoInvestidor(c.investidorId);
        if (dest) {
          void enviarEmail({
            para: dest.email,
            assunto: "Seu investimento está ativo",
            html: emailAporteConfirmado({ nome: dest.nome, valor: formatarBRL(c.principalCentavos), inicio: input.inicio, vencimento }),
          });
        }
        return { ok: true as const, vencimento };
      }),

    cancelar: adminProcedure
      .input(z.object({ id: z.number().int(), motivo: z.string().trim().min(3).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const c = await getContrato(input.id);
        exigirStatus(c, "rascunho", "aguardando_assinatura", "assinado", "aguardando_aporte");
        await db
          .update(contratos)
          .set({ status: "cancelado", canceladoEm: new Date(), observacoes: [c.observacoes, `Cancelado: ${input.motivo}`].filter(Boolean).join("\n") })
          .where(eq(contratos.id, c.id));
        await auditar({ atorId: ctx.usuario.id, acao: "contrato_cancelado", entidade: "contrato", entidadeId: c.id, dados: { motivo: input.motivo }, ip: ctx.ip });
        return { ok: true as const };
      }),

    extrato: adminProcedure.input(idSchema).query(async ({ input }) => extratoDoContrato(await getContrato(input.id))),
  }),

  // ─── Resgates ──────────────────────────────────────────────────────────────
  resgates: router({
    listar: adminProcedure
      .input(z.object({ status: z.enum(["solicitado", "aprovado", "pago", "recusado"]).optional() }).default({}))
      .query(({ input }) =>
        db
          .select({
            id: resgatesRendimento.id,
            contratoId: resgatesRendimento.contratoId,
            valorCentavos: resgatesRendimento.valorCentavos,
            irRetidoCentavos: resgatesRendimento.irRetidoCentavos,
            status: resgatesRendimento.status,
            solicitadoEm: resgatesRendimento.solicitadoEm,
            previstoPara: resgatesRendimento.previstoPara,
            pagoEm: resgatesRendimento.pagoEm,
            motivoRecusa: resgatesRendimento.motivoRecusa,
            nome: cadastros.nomeCompleto,
            email: usuarios.email,
            banco: cadastros.bancoNome,
            agencia: cadastros.agencia,
            contaFinal: cadastros.contaFinal,
            contaTipo: cadastros.contaTipo,
          })
          .from(resgatesRendimento)
          .innerJoin(contratos, eq(resgatesRendimento.contratoId, contratos.id))
          .innerJoin(investidores, eq(contratos.investidorId, investidores.id))
          .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
          .leftJoin(cadastros, eq(cadastros.investidorId, investidores.id))
          .where(input.status ? eq(resgatesRendimento.status, input.status) : inArray(resgatesRendimento.status, ["solicitado", "aprovado", "pago", "recusado"]))
          .orderBy(desc(resgatesRendimento.solicitadoEm))
          .limit(500),
      ),

    aprovar: adminProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
      const [r] = await db
        .update(resgatesRendimento)
        .set({ status: "aprovado", aprovadoPor: ctx.usuario.id })
        .where(sql`${resgatesRendimento.id} = ${input.id} and ${resgatesRendimento.status} = 'solicitado'`)
        .returning({ id: resgatesRendimento.id });
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só pedidos em \"solicitado\" podem ser aprovados." });
      await auditar({ atorId: ctx.usuario.id, acao: "resgate_aprovado", entidade: "resgate", entidadeId: input.id, ip: ctx.ip });
      return { ok: true as const };
    }),

    /** Marca como pago depois que a conta vinculada fez a transferência. */
    marcarPago: adminProcedure
      .input(z.object({ id: z.number().int(), comprovanteChave: z.string().startsWith("docs/").max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const [r] = await db
          .update(resgatesRendimento)
          .set({ status: "pago", pagoEm: new Date(), pagoPor: ctx.usuario.id, comprovanteChave: input.comprovanteChave ?? null })
          .where(sql`${resgatesRendimento.id} = ${input.id} and ${resgatesRendimento.status} = 'aprovado'`)
          .returning();
        if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aprove o pedido antes de marcar como pago." });
        await auditar({ atorId: ctx.usuario.id, acao: "resgate_pago", entidade: "resgate", entidadeId: input.id, ip: ctx.ip });
        const c = await getContrato(r.contratoId);
        // sai da conta o bruto: líquido para o investidor e IR recolhido
        await lancar({
          ofertaId: c.ofertaId,
          tipo: "pagamento_rendimento",
          valorCentavos: r.valorCentavos,
          descricao: `Rendimento do contrato #${c.id} (líquido ${formatarBRL(r.valorCentavos - Number(r.irRetidoCentavos))} + IR ${formatarBRL(Number(r.irRetidoCentavos))})`,
          contratoId: c.id,
          resgateId: r.id,
          comprovanteChave: input.comprovanteChave,
          criadoPor: ctx.usuario.id,
        });
        const dest = await emailDoInvestidor(c.investidorId);
        if (dest) {
          void enviarEmail({
            para: dest.email,
            assunto: "Resgate de rendimento pago",
            html: emailResgatePago({ nome: dest.nome, bruto: formatarBRL(r.valorCentavos), ir: formatarBRL(Number(r.irRetidoCentavos)), liquido: formatarBRL(r.valorCentavos - Number(r.irRetidoCentavos)) }),
          });
        }
        return { ok: true as const };
      }),

    recusar: adminProcedure
      .input(z.object({ id: z.number().int(), motivo: z.string().trim().min(3).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const [r] = await db
          .update(resgatesRendimento)
          .set({ status: "recusado", motivoRecusa: input.motivo })
          .where(sql`${resgatesRendimento.id} = ${input.id} and ${resgatesRendimento.status} in ('solicitado','aprovado')`)
          .returning();
        if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este pedido não pode mais ser recusado." });
        await auditar({ atorId: ctx.usuario.id, acao: "resgate_recusado", entidade: "resgate", entidadeId: input.id, dados: { motivo: input.motivo }, ip: ctx.ip });
        const c = await getContrato(r.contratoId);
        const dest = await emailDoInvestidor(c.investidorId);
        if (dest) void enviarEmail({ para: dest.email, assunto: "Pedido de resgate não aprovado", html: emailResgateRecusado({ nome: dest.nome, motivo: input.motivo }) });
        return { ok: true as const };
      }),
  }),
};
