import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or, sum } from "drizzle-orm";
import { router, comPapel } from "./trpc";
import { ENV, r2Configurado } from "./env";
import { db, getOrCreateInvestidor } from "../db";
import { contratos, documentos, investidores, ofertas, resgatesRendimento, usuarios } from "../schema";
import { QUESTOES_SUITABILITY, calcularPerfil } from "../../shared/suitability";
import { carregarEmissor, pendenciasParaCaptar } from "../../shared/issuer";
import { dataPagamentoResgate, rendimentoAcumulado } from "../../shared/finance";
import { auditar } from "../auditoria";
import { urlDownload } from "../storage";
import { enviarEmail } from "./email";

const investidorProcedure = comPapel("investidor");

const meuInvestidor = getOrCreateInvestidor;

const diasEntre = (inicio: string | null) =>
  inicio ? Math.max(0, Math.floor((Date.now() - new Date(inicio + "T00:00:00Z").getTime()) / 86_400_000)) : 0;

export const investidorRouter = router({
  perfil: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    return {
      nome: ctx.usuario.nome,
      email: ctx.usuario.email,
      telefone: ctx.usuario.telefone,
      suitability: inv.suitability,
      suitabilityEm: inv.suitabilityEm,
      trilhaConcluidaEm: inv.trilhaConcluidaEm,
      interesseAporteEm: inv.interesseAporteEm,
      kyc: inv.kyc,
    };
  }),

  atualizarPerfil: investidorProcedure
    .input(z.object({ nome: z.string().trim().min(3).max(255), telefone: z.string().regex(/^\d{10,13}$/) }))
    .mutation(async ({ ctx, input }) => {
      await db.update(usuarios).set(input).where(eq(usuarios.id, ctx.usuario.id));
      return { ok: true as const };
    }),

  questoesSuitability: investidorProcedure.query(() => QUESTOES_SUITABILITY),

  salvarSuitability: investidorProcedure
    .input(z.object({ respostas: z.record(z.number().int().min(0).max(5)) }))
    .mutation(async ({ ctx, input }) => {
      let r;
      try {
        r = calcularPerfil(input.respostas);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Responda todas as perguntas." });
      }
      await db
        .update(investidores)
        .set({ suitability: r.perfil, suitabilityRespostas: { respostas: input.respostas, ...r }, suitabilityEm: new Date() })
        .where(eq(investidores.usuarioId, ctx.usuario.id));
      await auditar({ atorId: ctx.usuario.id, acao: "suitability_registrado", entidade: "usuario", entidadeId: ctx.usuario.id, dados: r, ip: ctx.ip });
      return r;
    }),

  /** Painel com contratos reais do investidor. */
  painel: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const lista = await db
      .select({ c: contratos, oferta: ofertas.nome })
      .from(contratos)
      .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
      .where(eq(contratos.investidorId, inv.id))
      .orderBy(desc(contratos.criadoEm));

    const ids = lista.map((l) => l.c.id);
    const pagos = ids.length
      ? await db
          .select({ contratoId: resgatesRendimento.contratoId, total: sum(resgatesRendimento.valorCentavos) })
          .from(resgatesRendimento)
          .where(and(inArray(resgatesRendimento.contratoId, ids), inArray(resgatesRendimento.status, ["solicitado", "aprovado", "pago"])))
          .groupBy(resgatesRendimento.contratoId)
      : [];
    const pagoPor = new Map(pagos.map((p) => [p.contratoId, Number(p.total ?? 0)]));

    const e = carregarEmissor(process.env);
    return {
      resgateHabilitado: pendenciasParaCaptar(e).length === 0,
      pagamentoSePedirHoje: dataPagamentoResgate(new Date(), e.prazoResgateDias).toISOString().slice(0, 10),
      contratos: lista.map(({ c, oferta }) => {
        const ativo = c.status === "ativo";
        const acc = ativo
          ? rendimentoAcumulado(c.principalCentavos, Number(c.taxaMensal), diasEntre(c.inicio), pagoPor.get(c.id) ?? 0)
          : { brutoCentavos: 0, disponivelCentavos: 0 };
        return {
          id: c.id,
          oferta,
          status: c.status,
          principalCentavos: c.principalCentavos,
          taxaMensal: Number(c.taxaMensal),
          prazoMeses: c.prazoMeses,
          inicio: c.inicio,
          vencimento: c.vencimento,
          rendimentoBrutoCentavos: acc.brutoCentavos,
          resgatadoCentavos: pagoPor.get(c.id) ?? 0,
          disponivelCentavos: acc.disponivelCentavos,
        };
      }),
    };
  }),

  documentos: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const meusContratos = await db.select({ id: contratos.id }).from(contratos).where(eq(contratos.investidorId, inv.id));
    const ids = meusContratos.map((c) => c.id);
    const linhas = await db
      .select({ id: documentos.id, titulo: documentos.titulo, tipo: documentos.tipo, escopo: documentos.escopo, publicadoEm: documentos.publicadoEm })
      .from(documentos)
      .where(
        or(
          eq(documentos.escopo, "publico"),
          and(eq(documentos.escopo, "investidor"), eq(documentos.escopoId, inv.id)),
          ids.length ? and(eq(documentos.escopo, "contrato"), inArray(documentos.escopoId, ids)) : undefined,
        ),
      )
      .orderBy(desc(documentos.publicadoEm));
    return { armazenamentoAtivo: r2Configurado(), documentos: linhas };
  }),

  baixarDocumento: investidorProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const [d] = await db.select().from(documentos).where(eq(documentos.id, input.id)).limit(1);
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });

    let permitido = d.escopo === "publico" || (d.escopo === "investidor" && d.escopoId === inv.id);
    if (!permitido && d.escopo === "contrato" && d.escopoId) {
      const [c] = await db
        .select({ id: contratos.id })
        .from(contratos)
        .where(and(eq(contratos.id, d.escopoId), eq(contratos.investidorId, inv.id)))
        .limit(1);
      permitido = Boolean(c);
    }
    if (!permitido) throw new TRPCError({ code: "FORBIDDEN", message: "Documento indisponível para sua conta." });

    await auditar({ atorId: ctx.usuario.id, acao: "documento_baixado", entidade: "documento", entidadeId: d.id, ip: ctx.ip });
    return { url: await urlDownload(d.storageKey, `${d.titulo}.pdf`), sha256: d.sha256 };
  }),

  /**
   * Manifestação de interesse em aporte. Só abre com trilha concluída e perfil
   * adequado. Não movimenta dinheiro: avisa a equipe, que conduz o onboarding.
   */
  manifestarInteresse: investidorProcedure.mutation(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    if (!inv.trilhaConcluidaEm) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conclua a trilha \"Antes de investir\" primeiro." });
    }
    const r = (inv.suitabilityRespostas as { adequado?: boolean; motivo?: string } | null) ?? null;
    if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Responda o questionário de perfil primeiro." });
    if (!r.adequado) throw new TRPCError({ code: "PRECONDITION_FAILED", message: r.motivo ?? "Produto não adequado ao seu perfil." });

    await db.update(investidores).set({ interesseAporteEm: new Date() }).where(eq(investidores.id, inv.id));
    await auditar({ atorId: ctx.usuario.id, acao: "interesse_aporte", entidade: "investidor", entidadeId: inv.id, ip: ctx.ip });
    for (const para of ENV.emailsAssessores) {
      void enviarEmail({
        para,
        assunto: `Interesse em aporte: ${ctx.usuario.nome ?? ctx.usuario.email}`,
        html: `<p>${ctx.usuario.nome ?? ""} (${ctx.usuario.email}) concluiu a trilha, tem perfil adequado e quer conversar sobre aporte.</p>`,
      });
    }
    return { ok: true as const };
  }),

  /** Pedido de resgate de rendimento. Travado até o emissor estar habilitado. */
  solicitarResgate: investidorProcedure
    .input(z.object({ contratoId: z.number().int(), valorCentavos: z.number().int().positive(), idempotencyKey: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const e = carregarEmissor(process.env);
      if (pendenciasParaCaptar(e).length > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resgates ainda não estão habilitados nesta plataforma." });
      }
      const inv = await meuInvestidor(ctx.usuario.id);
      const [c] = await db
        .select()
        .from(contratos)
        .where(and(eq(contratos.id, input.contratoId), eq(contratos.investidorId, inv.id), eq(contratos.status, "ativo")))
        .limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato ativo não encontrado." });

      const [ja] = await db.select().from(resgatesRendimento).where(eq(resgatesRendimento.idempotencyKey, input.idempotencyKey)).limit(1);
      if (ja) return { ok: true as const, id: ja.id, previstoPara: ja.previstoPara, repetido: true };

      const [pago] = await db
        .select({ total: sum(resgatesRendimento.valorCentavos) })
        .from(resgatesRendimento)
        .where(and(eq(resgatesRendimento.contratoId, c.id), inArray(resgatesRendimento.status, ["solicitado", "aprovado", "pago"])));
      const acc = rendimentoAcumulado(c.principalCentavos, Number(c.taxaMensal), diasEntre(c.inicio), Number(pago?.total ?? 0));
      if (input.valorCentavos > acc.disponivelCentavos) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Valor acima do rendimento disponível." });
      }

      const previsto = dataPagamentoResgate(new Date(), e.prazoResgateDias).toISOString().slice(0, 10);
      const [novo] = await db
        .insert(resgatesRendimento)
        .values({ contratoId: c.id, valorCentavos: input.valorCentavos, previstoPara: previsto, idempotencyKey: input.idempotencyKey })
        .onConflictDoNothing()
        .returning();
      await auditar({ atorId: ctx.usuario.id, acao: "resgate_solicitado", entidade: "contrato", entidadeId: c.id, dados: { valor: input.valorCentavos }, ip: ctx.ip });
      return { ok: true as const, id: novo?.id ?? null, previstoPara: previsto, repetido: !novo };
    }),
});
