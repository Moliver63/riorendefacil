import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { router, comPapel } from "./trpc";
import { ENV, r2Configurado } from "./env";
import { db, getOrCreateInvestidor } from "../db";
import { contratos, depositos, documentos, investidores, ofertas, reservas, resgatesPrincipal, resgatesRendimento, usuarios } from "../schema";
import { depositoAberto, previaSaquePrincipal, saquePrincipalAberto } from "../movimentacoesService";
import { QUESTOES_SUITABILITY, calcularPerfil } from "../../shared/suitability";
import { esquemaCadastro, mascararCpf } from "../../shared/cadastro";
import { carregarEmissor, pendenciasParaCaptar } from "../../shared/issuer";
import { dataPagamentoResgate, fatorMeses, formatarBRL, formatarPct, jurosDoMes, taxaMensalEfetiva, tetoDaFaixa, type Faixa } from "../../shared/finance";
import { alocacao } from "../lastroService";
import { ficha } from "../fichaOferta";
import { prazoValido } from "../../shared/lastroGraos";
import { auditar } from "../auditoria";
import { chaveDocumento, urlDownload, urlEnvio } from "../storage";
import { enviarEmail } from "./email";
import { cadastroRevelado, getCadastro, salvarCadastro } from "../cadastroService";
import {
  STATUS_CONTRATO_ROTULO,
  evolucaoDoContrato,
  extratoDoContrato,
  getContrato,
  irDoResgate,
  resgatesDoContrato,
  saldoDoContrato,
  totalResgatado,
} from "../contratoService";

const investidorProcedure = comPapel("investidor");

type Pendencia = { etapa: "cadastro"; mensagem: string; href: string };

/** Etapa obrigatória antes de reservar ou ter contrato: o cadastro. A trilha é leitura opcional. */
async function pendenciasDoInvestidor(inv: Awaited<ReturnType<typeof getOrCreateInvestidor>>): Promise<Pendencia[]> {
  const p: Pendencia[] = [];
  if (!(await getCadastro(inv.id))) p.push({ etapa: "cadastro", mensagem: "Complete seu cadastro primeiro. Ele é a base do contrato.", href: "/cadastro" });
  return p;
}
const meuInvestidor = getOrCreateInvestidor;

/** Contrato do próprio investidor, ou 404 (nunca revela se o id existe para outra pessoa). */
async function meuContrato(usuarioId: number, contratoId: number) {
  const inv = await meuInvestidor(usuarioId);
  const c = await getContrato(contratoId).catch(() => null);
  if (!c || c.investidorId !== inv.id) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado." });
  return c;
}

export const investidorRouter = router({
  perfil: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const cad = await getCadastro(inv.id);
    return {
      nome: ctx.usuario.nome,
      email: ctx.usuario.email,
      telefone: ctx.usuario.telefone,
      suitability: inv.suitability,
      suitabilityEm: inv.suitabilityEm,
      trilhaConcluidaEm: inv.trilhaConcluidaEm,
      interesseAporteEm: inv.interesseAporteEm,
      cadastroCompletoEm: cad?.atualizadoEm ?? null,
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

  // ─── Cadastro completo (qualificação do contrato) ───────────────────────────

  /** Dados do próprio cadastro, decifrados para edição. Null se ainda não preencheu. */
  cadastro: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const c = await getCadastro(inv.id);
    return c ? cadastroRevelado(c) : null;
  }),

  salvarCadastro: investidorProcedure.input(esquemaCadastro).mutation(async ({ ctx, input }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const c = await salvarCadastro(inv.id, input);
    // mantém nome e telefone da conta alinhados com o cadastro
    await db.update(usuarios).set({ nome: input.nomeCompleto, telefone: input.telefone }).where(eq(usuarios.id, ctx.usuario.id));
    await db.update(investidores).set({ pessoaPoliticamenteExposta: input.ppe }).where(eq(investidores.id, inv.id));
    await auditar({
      atorId: ctx.usuario.id,
      acao: "cadastro_salvo",
      entidade: "investidor",
      entidadeId: inv.id,
      dados: { cpf: mascararCpf(c.cpfFinal), ppe: input.ppe },
      ip: ctx.ip,
    });
    return { ok: true as const };
  }),

  // ─── Carteira ───────────────────────────────────────────────────────────────

  painel: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const lista = await db
      .select({ c: contratos, oferta: ofertas.nome, ofertaCodigo: ofertas.codigo })
      .from(contratos)
      .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
      .where(eq(contratos.investidorId, inv.id))
      .orderBy(desc(contratos.criadoEm));

    const e = carregarEmissor(process.env);
    const hoje = new Date();
    const itens = await Promise.all(
      lista.map(async ({ c, oferta, ofertaCodigo }) => {
        const resgatado = await totalResgatado(c.id);
        const noTempo = c.status === "ativo" ? await resgatesDoContrato(c) : [];
        const s = saldoDoContrato(c, noTempo, hoje);
        return {
          id: c.id,
          oferta,
          ofertaId: c.ofertaId,
          ofertaCodigo,
          status: c.status,
          statusRotulo: STATUS_CONTRATO_ROTULO[c.status] ?? c.status,
          principalCentavos: c.principalCentavos,
          taxaMensal: Number(c.taxaMensal),
          prazoMeses: c.prazoMeses,
          inicio: c.inicio,
          vencimento: c.vencimento,
          rendimentoBrutoCentavos: s.brutoCentavos,
          resgatadoCentavos: resgatado,
          disponivelCentavos: s.disponivelCentavos,
          irSeResgatarTudo: c.status === "ativo" ? irDoResgate(c, s.disponivelCentavos, hoje) : null,
          saldoCentavos: s.saldoCentavos,
          jurosProximoMesCentavos: c.status === "ativo" ? jurosDoMes(s.saldoCentavos, Number(c.taxaMensal), 30) : 0,
          valorNoVencimentoCentavos: c.status === "ativo" ? Math.round(c.principalCentavos * fatorMeses(Number(c.taxaMensal), c.prazoMeses)) : 0,
          taxaMensalEfetiva: taxaMensalEfetiva(Number(c.taxaMensal)),
          resgatesNoTempo: noTempo.map((r) => ({ dia: r.dia, valorCentavos: r.valorCentavos })),
          evolucao: c.status === "ativo" ? evolucaoDoContrato(c, noTempo, hoje) : [],
          alocacao: c.status === "ativo" ? await alocacao(c.id) : [],
          saquePrincipal: await saquePrincipalAberto(c.id),
          depositoInformado: c.status === "aguardando_aporte" ? await depositoAberto(c.id) : null,
        };
      }),
    );
    return {
      resgateHabilitado: pendenciasParaCaptar(e).length === 0,
      prazoResgateDias: e.prazoResgateDias,
      pagamentoSePedirHoje: dataPagamentoResgate(hoje, e.prazoResgateDias).toISOString().slice(0, 10),
      hoje: hoje.toISOString().slice(0, 10),
      contratos: itens,
    };
  }),

  /** Contrato para leitura e impressão (qualificação congelada + condições). */
  contrato: investidorProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const c = await meuContrato(ctx.usuario.id, input.id);
    const [o] = await db.select().from(ofertas).where(eq(ofertas.id, c.ofertaId)).limit(1);
    const e = carregarEmissor(process.env);
    return {
      id: c.id,
      status: c.status,
      statusRotulo: STATUS_CONTRATO_ROTULO[c.status] ?? c.status,
      qualificacao: c.qualificacao,
      oferta: o?.nome ?? "",
      ofertaCodigo: o?.codigo ?? null,
      coberturaMinima: o ? Number(o.coberturaMinima) : 1.3,
      principalCentavos: c.principalCentavos,
      taxaMensal: Number(c.taxaMensal),
      prazoMeses: c.prazoMeses,
      carenciaPrincipalDias: o?.carenciaPrincipalDias ?? e.carenciaPrincipalDias,
      prazoResgateDias: o?.prazoResgateDias ?? e.prazoResgateDias,
      inicio: c.inicio,
      vencimento: c.vencimento,
      criadoEm: c.criadoEm,
      assinadoEm: c.assinadoEm,
      emissor: { nome: e.nome, cnpj: e.cnpj, custodiante: e.custodiante },
    };
  }),

  extrato: investidorProcedure.input(z.object({ contratoId: z.number().int() })).query(async ({ ctx, input }) => {
    const c = await meuContrato(ctx.usuario.id, input.contratoId);
    return extratoDoContrato(c);
  }),

  /** Prévia do resgate: IR e líquido antes de confirmar. */
  previaResgate: investidorProcedure
    .input(z.object({ contratoId: z.number().int(), valorCentavos: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const c = await meuContrato(ctx.usuario.id, input.contratoId);
      return irDoResgate(c, input.valorCentavos);
    }),

  solicitarResgate: investidorProcedure
    .input(z.object({ contratoId: z.number().int(), valorCentavos: z.number().int().positive(), idempotencyKey: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const e = carregarEmissor(process.env);
      if (pendenciasParaCaptar(e).length > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resgates ainda não estão habilitados nesta plataforma." });
      }
      const c = await meuContrato(ctx.usuario.id, input.contratoId);
      if (c.status !== "ativo") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só contratos ativos aceitam resgate." });
      if (await saquePrincipalAberto(c.id)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Há um saque do principal em andamento neste contrato; ele já inclui o rendimento." });
      }

      const [ja] = await db.select().from(resgatesRendimento).where(eq(resgatesRendimento.idempotencyKey, input.idempotencyKey)).limit(1);
      if (ja) {
        const irJa = irDoResgate(c, ja.valorCentavos);
        return { ok: true as const, id: ja.id, previstoPara: ja.previstoPara, repetido: true, ...irJa, irCentavos: Number(ja.irRetidoCentavos), liquidoCentavos: ja.valorCentavos - Number(ja.irRetidoCentavos) };
      }

      const s = saldoDoContrato(c, await resgatesDoContrato(c));
      if (input.valorCentavos > s.disponivelCentavos) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Valor acima do rendimento disponível (${formatarBRL(s.disponivelCentavos)}).` });
      }
      const ir = irDoResgate(c, input.valorCentavos);
      const previsto = dataPagamentoResgate(new Date(), e.prazoResgateDias).toISOString().slice(0, 10);
      const [novo] = await db
        .insert(resgatesRendimento)
        .values({
          contratoId: c.id,
          valorCentavos: input.valorCentavos,
          irRetidoCentavos: ir.irCentavos,
          previstoPara: previsto,
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing()
        .returning();
      await auditar({ atorId: ctx.usuario.id, acao: "resgate_solicitado", entidade: "contrato", entidadeId: c.id, dados: { valor: input.valorCentavos }, ip: ctx.ip });
      for (const para of ENV.emailsAssessores) {
        void enviarEmail({
          para,
          assunto: `Pedido de resgate: contrato #${c.id}`,
          html: `<p>${ctx.usuario.nome ?? ctx.usuario.email} pediu resgate de ${formatarBRL(input.valorCentavos)} do contrato #${c.id}. Previsto para ${new Date(previsto + "T12:00:00").toLocaleDateString("pt-BR")}.</p><p><a href="${ENV.appUrl}/admin/movimentacoes">Abrir resgates</a></p>`,
        });
      }
      return { ok: true as const, id: novo?.id ?? null, previstoPara: previsto, repetido: !novo, ...ir };
    }),

  resgates: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    return db
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
      })
      .from(resgatesRendimento)
      .innerJoin(contratos, eq(resgatesRendimento.contratoId, contratos.id))
      .where(eq(contratos.investidorId, inv.id))
      .orderBy(desc(resgatesRendimento.solicitadoEm));
  }),

  // ─── Documentos ─────────────────────────────────────────────────────────────

  documentos: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const meus = await db.select({ id: contratos.id }).from(contratos).where(eq(contratos.investidorId, inv.id));
    const ids = meus.map((c) => c.id);
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
    return { armazenamentoAtivo: r2Configurado(), documentos: linhas, contratos: ids };
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
   * Manifestação de interesse em aporte. Exige só o
   * cadastro completo. Não movimenta dinheiro: avisa a equipe.
   */
  // ─── Depósito e saque ──────────────────────────────────────────────────────

  /** Para onde depositar: a conta vinculada do emissor, e os contratos esperando aporte. */
  dadosDeposito: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const e = carregarEmissor(process.env);
    const conta = e.contaDeposito;
    const lista = await db
      .select({ c: contratos, oferta: ofertas.nome, codigo: ofertas.codigo })
      .from(contratos)
      .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
      .where(and(eq(contratos.investidorId, inv.id), eq(contratos.status, "aguardando_aporte")))
      .orderBy(desc(contratos.criadoEm));
    return {
      habilitado: pendenciasParaCaptar(e).length === 0 && Boolean(conta.conta || conta.pix),
      conta,
      comprovantes: r2Configurado(),
      contratos: await Promise.all(
        lista.map(async ({ c, oferta, codigo }) => ({
          id: c.id,
          oferta,
          codigo,
          principalCentavos: c.principalCentavos,
          prazoMeses: c.prazoMeses,
          taxaMensal: Number(c.taxaMensal),
          depositoInformado: await depositoAberto(c.id),
        })),
      ),
    };
  }),

  /** URL de envio do comprovante de depósito (só para contrato próprio). */
  prepararComprovante: investidorProcedure
    .input(z.object({ contratoId: z.number().int(), nomeArquivo: z.string().min(1).max(200), contentType: z.string().max(100), tamanho: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const c = await meuContrato(ctx.usuario.id, input.contratoId);
      if (!r2Configurado()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Envio de arquivos ainda não configurado. Informe o depósito sem comprovante." });
      if (!/^(application\/pdf|image\/(png|jpeg))$/.test(input.contentType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie PDF, PNG ou JPG." });
      const chave = chaveDocumento("contrato", c.id, input.nomeArquivo);
      try {
        return { chave, url: await urlEnvio(chave, input.contentType, input.tamanho) };
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
      }
    }),

  /** O investidor avisa que depositou. A equipe confere na conta vinculada e ativa o contrato. */
  informarDeposito: investidorProcedure
    .input(
      z.object({
        contratoId: z.number().int(),
        valorCentavos: z.number().int().positive(),
        dataDeposito: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        comprovante: z.object({ chave: z.string().startsWith("docs/").max(500), sha256: z.string().regex(/^[a-f0-9]{64}$/), tamanhoBytes: z.number().int().positive() }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const e = carregarEmissor(process.env);
      if (pendenciasParaCaptar(e).length > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Depósitos ainda não estão habilitados." });
      const c = await meuContrato(ctx.usuario.id, input.contratoId);
      if (c.status !== "aguardando_aporte") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este contrato não está aguardando aporte." });
      if (input.dataDeposito > new Date().toISOString().slice(0, 10)) throw new TRPCError({ code: "BAD_REQUEST", message: "A data do depósito não pode ser no futuro." });
      if (await depositoAberto(c.id)) throw new TRPCError({ code: "CONFLICT", message: "Você já informou um depósito para este contrato. Aguarde a confirmação." });
      if (input.comprovante?.chave && !input.comprovante.chave.startsWith(`docs/contrato/${c.id}/`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comprovante inválido." });
      }
      const [d] = await db
        .insert(depositos)
        .values({ investidorId: c.investidorId, contratoId: c.id, valorCentavos: input.valorCentavos, dataDeposito: input.dataDeposito, comprovanteChave: input.comprovante?.chave ?? null })
        .returning();
      if (input.comprovante) {
        await db.insert(documentos).values({
          escopo: "contrato",
          escopoId: c.id,
          tipo: "comprovante_deposito",
          titulo: `Comprovante de depósito do contrato #${c.id}`,
          storageKey: input.comprovante.chave,
          sha256: input.comprovante.sha256,
          tamanhoBytes: input.comprovante.tamanhoBytes,
        });
      }
      await auditar({ atorId: ctx.usuario.id, acao: "deposito_informado", entidade: "contrato", entidadeId: c.id, dados: { valor: input.valorCentavos, data: input.dataDeposito }, ip: ctx.ip });
      for (const para of ENV.emailsAssessores) {
        void enviarEmail({
          para,
          assunto: `Depósito informado: contrato #${c.id}, ${formatarBRL(input.valorCentavos)}`,
          html: `<p>${ctx.usuario.nome ?? ctx.usuario.email} informou depósito de ${formatarBRL(input.valorCentavos)} em ${input.dataDeposito} para o contrato #${c.id}.</p><p><a href="${ENV.appUrl}/admin/movimentacoes">Conferir e confirmar</a></p>`,
        });
      }
      if (input.valorCentavos !== c.principalCentavos) {
        return { ...d!, aviso: `O valor informado é diferente do valor do contrato (${formatarBRL(c.principalCentavos)}). A equipe vai conferir.` };
      }
      return { ...d!, aviso: null };
    }),

  /** Quanto o investidor recebe se pedir o saque do principal hoje. */
  previaSaquePrincipal: investidorProcedure.input(z.object({ contratoId: z.number().int() })).query(async ({ ctx, input }) => {
    const c = await meuContrato(ctx.usuario.id, input.contratoId);
    if (c.status !== "ativo") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só contratos ativos." });
    return previaSaquePrincipal(c);
  }),

  solicitarSaquePrincipal: investidorProcedure
    .input(z.object({ contratoId: z.number().int(), ciente: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const e = carregarEmissor(process.env);
      if (pendenciasParaCaptar(e).length > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Saques ainda não estão habilitados." });
      const c = await meuContrato(ctx.usuario.id, input.contratoId);
      if (c.status !== "ativo") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só contratos ativos." });
      if (await saquePrincipalAberto(c.id)) throw new TRPCError({ code: "CONFLICT", message: "Já existe um saque do principal em andamento para este contrato." });
      const pendRend = await db
        .select({ id: resgatesRendimento.id })
        .from(resgatesRendimento)
        .where(and(eq(resgatesRendimento.contratoId, c.id), inArray(resgatesRendimento.status, ["solicitado", "aprovado"])))
        .limit(1);
      if (pendRend.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Espere o pagamento do resgate de rendimento em andamento antes de pedir o saque do principal." });
      const p = await previaSaquePrincipal(c);
      const [r] = await db
        .insert(resgatesPrincipal)
        .values({
          contratoId: c.id,
          tipo: p.tipo,
          regra: p.regra,
          diasPermanencia: p.dias,
          principalCentavos: c.principalCentavos,
          rendimentoSacadoCentavos: p.rendimentoSacadoCentavos,
          brutoCentavos: p.brutoCentavos,
          penalidadeCentavos: p.penalidadeCentavos,
          irCentavos: p.irCentavos,
          liquidoCentavos: p.liquidoCentavos,
          previstoPara: p.previstoPara,
        })
        .returning();
      await auditar({ atorId: ctx.usuario.id, acao: "saque_principal_solicitado", entidade: "contrato", entidadeId: c.id, dados: { tipo: p.tipo, bruto: p.brutoCentavos, penalidade: p.penalidadeCentavos }, ip: ctx.ip });
      for (const para of ENV.emailsAssessores) {
        void enviarEmail({
          para,
          assunto: `Saque do principal (${p.tipo}): contrato #${c.id}`,
          html: `<p>${ctx.usuario.nome ?? ctx.usuario.email} pediu o saque do principal do contrato #${c.id}: ${formatarBRL(p.liquidoCentavos)} líquidos, previsto para ${p.previstoPara}. Regra: ${p.regra}.</p><p><a href="${ENV.appUrl}/admin/movimentacoes">Abrir movimentações</a></p>`,
        });
      }
      return r!;
    }),

  /** Todas as movimentações do investidor: depósitos, saques de rendimento e de principal. */
  movimentacoes: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const meus = await db
      .select({ id: contratos.id, oferta: ofertas.nome })
      .from(contratos)
      .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
      .where(eq(contratos.investidorId, inv.id));
    const ids = meus.map((m) => m.id);
    const nome = new Map(meus.map((m) => [m.id, m.oferta]));
    if (!ids.length) return [];
    const [deps, rend, princ] = await Promise.all([
      db.select().from(depositos).where(inArray(depositos.contratoId, ids)),
      db.select().from(resgatesRendimento).where(inArray(resgatesRendimento.contratoId, ids)),
      db.select().from(resgatesPrincipal).where(inArray(resgatesPrincipal.contratoId, ids)),
    ]);
    const ROT: Record<string, string> = { informado: "Em conferência", confirmado: "Confirmado", solicitado: "Solicitado", aprovado: "Aprovado", pago: "Pago", recusado: "Recusado" };
    const itens = [
      ...deps.map((d) => ({ chave: `d${d.id}`, tipo: "deposito" as const, rotulo: "Depósito", contratoId: d.contratoId, oferta: nome.get(d.contratoId) ?? "", data: `${d.dataDeposito}T12:00:00.000Z`, valorCentavos: d.valorCentavos, liquidoCentavos: d.valorCentavos, status: d.status, statusRotulo: ROT[d.status] ?? d.status, previstoPara: null as string | null, detalhe: d.motivoRecusa ?? `avisado em ${d.criadoEm.toLocaleDateString("pt-BR")}` })),
      ...rend.map((r) => ({ chave: `r${r.id}`, tipo: "saque_rendimento" as const, rotulo: "Saque de rendimento", contratoId: r.contratoId, oferta: nome.get(r.contratoId) ?? "", data: r.solicitadoEm.toISOString(), valorCentavos: -r.valorCentavos, liquidoCentavos: -(r.valorCentavos - Number(r.irRetidoCentavos)), status: r.status, statusRotulo: ROT[r.status] ?? r.status, previstoPara: r.previstoPara, detalhe: r.motivoRecusa ?? `IR ${formatarBRL(Number(r.irRetidoCentavos))}` })),
      ...princ.map((r) => ({ chave: `p${r.id}`, tipo: "saque_principal" as const, rotulo: r.tipo === "vencimento" ? "Saque no vencimento" : "Saque antecipado do principal", contratoId: r.contratoId, oferta: nome.get(r.contratoId) ?? "", data: r.solicitadoEm.toISOString(), valorCentavos: -r.brutoCentavos, liquidoCentavos: -r.liquidoCentavos, status: r.status, statusRotulo: ROT[r.status] ?? r.status, previstoPara: r.previstoPara, detalhe: r.motivoRecusa ?? (r.penalidadeCentavos > 0 ? `penalidade ${formatarBRL(r.penalidadeCentavos)} · IR ${formatarBRL(r.irCentavos)}` : `IR ${formatarBRL(r.irCentavos)}`) })),
    ];
    return itens.sort((a, b) => b.data.localeCompare(a.data));
  }),

  /** Ficha da oferta, inclusive encerrada, se o investidor tiver contrato nela. */
  oferta: investidorProcedure.input(z.object({ id: z.number().int().min(0) })).query(async ({ ctx, input }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const [tem] = await db
      .select({ id: contratos.id })
      .from(contratos)
      .where(and(eq(contratos.investidorId, inv.id), eq(contratos.ofertaId, input.id)))
      .limit(1);
    const f = await ficha(input.id, Boolean(tem));
    if (!f) throw new TRPCError({ code: "NOT_FOUND", message: "Oferta não encontrada ou encerrada." });
    const [minha] = await db
      .select()
      .from(reservas)
      .where(and(eq(reservas.investidorId, inv.id), eq(reservas.ofertaId, input.id), eq(reservas.status, "ativa")))
      .limit(1);
    return { ...f, minhaReserva: minha ? { ...minha, taxaMensal: Number(minha.taxaMensal) } : null };
  }),

  /** O que falta para o investidor poder reservar. Lista vazia = pode. */
  pendencias: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    return pendenciasDoInvestidor(inv);
  }),

  /**
   * Reserva numa oferta (como nas ofertas das corretoras): valor e prazo ficam
   * registrados com a taxa da faixa; a equipe gera o contrato a partir dela.
   */
  reservar: investidorProcedure
    .input(z.object({ ofertaId: z.number().int().positive(), valorCentavos: z.number().int().min(100_00), prazoMeses: z.number().int().refine(prazoValido, "O prazo deve ser de 12, 24 ou 36 meses.") }))
    .mutation(async ({ ctx, input }) => {
      const inv = await meuInvestidor(ctx.usuario.id);
      const pend = await pendenciasDoInvestidor(inv);
      if (pend.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: pend[0]!.mensagem });
      const f = await ficha(input.ofertaId);
      if (!f || f.exemplo) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Esta oferta ainda não está aberta para reservas." });
      if (!f.captacaoLiberada) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Reservas suspensas nesta oferta no momento." });
      const taxa = tetoDaFaixa(f.faixas as Faixa[], input.valorCentavos, input.prazoMeses);
      if (taxa === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor ou prazo fora das faixas desta oferta." });
      if (input.prazoMeses * 30 < f.carenciaPrincipalDias) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `O prazo precisa cobrir a carência do principal (${f.carenciaPrincipalDias} dias).` });
      }
      const [existente] = await db
        .select({ id: reservas.id })
        .from(reservas)
        .where(and(eq(reservas.investidorId, inv.id), eq(reservas.ofertaId, input.ofertaId), eq(reservas.status, "ativa")))
        .limit(1);
      const valores = { valorCentavos: input.valorCentavos, prazoMeses: input.prazoMeses, taxaMensal: taxa.toFixed(6), atualizadoEm: new Date() };
      const [r] = existente
        ? await db.update(reservas).set(valores).where(eq(reservas.id, existente.id)).returning()
        : await db.insert(reservas).values({ ...valores, investidorId: inv.id, ofertaId: input.ofertaId }).returning();
      await db.update(investidores).set({ interesseAporteEm: new Date() }).where(eq(investidores.id, inv.id));
      await auditar({ atorId: ctx.usuario.id, acao: existente ? "reserva_alterada" : "reserva_criada", entidade: "reserva", entidadeId: r!.id, dados: input, ip: ctx.ip });
      for (const para of ENV.emailsAssessores) {
        void enviarEmail({
          para,
          assunto: `Reserva ${f.codigo}: ${formatarBRL(input.valorCentavos)}`,
          html: `<p>${ctx.usuario.nome ?? ""} (${ctx.usuario.email}) reservou ${formatarBRL(input.valorCentavos)} por ${input.prazoMeses} meses em ${f.nome}, a ${formatarPct(taxa)} a.m.</p><p><a href="${ENV.appUrl}/admin/investidores">Abrir investidores</a></p>`,
        });
      }
      return { ...r!, taxaMensal: taxa };
    }),

  reservas: investidorProcedure.query(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const linhas = await db
      .select({ r: reservas, oferta: ofertas.nome, codigo: ofertas.codigo })
      .from(reservas)
      .innerJoin(ofertas, eq(reservas.ofertaId, ofertas.id))
      .where(and(eq(reservas.investidorId, inv.id), eq(reservas.status, "ativa")))
      .orderBy(desc(reservas.criadoEm));
    return linhas.map(({ r, oferta, codigo }) => ({ ...r, taxaMensal: Number(r.taxaMensal), oferta, codigo }));
  }),

  cancelarReserva: investidorProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    const [r] = await db
      .update(reservas)
      .set({ status: "cancelada", atualizadoEm: new Date() })
      .where(and(eq(reservas.id, input.id), eq(reservas.investidorId, inv.id), eq(reservas.status, "ativa")))
      .returning({ id: reservas.id });
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Reserva não encontrada." });
    await auditar({ atorId: ctx.usuario.id, acao: "reserva_cancelada", entidade: "reserva", entidadeId: r.id, ip: ctx.ip });
    return { ok: true as const };
  }),

  manifestarInteresse: investidorProcedure.mutation(async ({ ctx }) => {
    const inv = await meuInvestidor(ctx.usuario.id);
    if (!(await getCadastro(inv.id))) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete seu cadastro primeiro. Ele é a base do contrato." });
    }

    await db.update(investidores).set({ interesseAporteEm: new Date() }).where(eq(investidores.id, inv.id));
    await auditar({ atorId: ctx.usuario.id, acao: "interesse_aporte", entidade: "investidor", entidadeId: inv.id, ip: ctx.ip });
    for (const para of ENV.emailsAssessores) {
      void enviarEmail({
        para,
        assunto: `Interesse em aporte: ${ctx.usuario.nome ?? ctx.usuario.email}`,
        html: `<p>${ctx.usuario.nome ?? ""} (${ctx.usuario.email}) concluiu trilha, perfil e cadastro, e quer conversar sobre aporte.</p><p><a href="${ENV.appUrl}/admin/investidores">Abrir investidores</a></p>`,
      });
    }
    return { ok: true as const };
  }),
});
