import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { router, adminProcedure, equipeProcedure } from "./trpc";
import { r2Configurado } from "./env";
import { db } from "../db";
import { auditoria, ccbs, documentos, investidores, leads, ofertas, pecasComunicacao, usuarios } from "../schema";
import { PAPEIS, SETORES, SITUACOES_CCB, STATUS_LEAD } from "../../shared/const";
import { avaliarTexto } from "../../shared/complianceGuard";
import { auditar } from "../auditoria";
import { chaveDocumento, urlEnvio } from "../storage";

const faixaSchema = z.object({
  minimoCentavos: z.number().int().positive(),
  prazoMinimoMeses: z.number().int().min(1).max(60),
  taxaMensalTeto: z.number().min(0).max(0.05),
});

export const adminRouter = router({
  resumo: equipeProcedure.query(async () => {
    const seteDias = new Date(Date.now() - 7 * 86_400_000);
    const [[leadsTotal], [leadsNovos], [leadsSemana], [investTotal], [trilhaOk], [interesse]] = await Promise.all([
      db.select({ n: count() }).from(leads),
      db.select({ n: count() }).from(leads).where(eq(leads.status, "novo")),
      db.select({ n: count() }).from(leads).where(gte(leads.criadoEm, seteDias)),
      db.select({ n: count() }).from(investidores),
      db.select({ n: count() }).from(investidores).where(sql`${investidores.trilhaConcluidaEm} is not null`),
      db.select({ n: count() }).from(investidores).where(sql`${investidores.interesseAporteEm} is not null`),
    ]);
    return {
      leadsTotal: leadsTotal!.n,
      leadsNovos: leadsNovos!.n,
      leadsSemana: leadsSemana!.n,
      investidores: investTotal!.n,
      trilhaConcluida: trilhaOk!.n,
      interesseAporte: interesse!.n,
    };
  }),

  // ─── Leads (equipe) ───────────────────────────────────────────────────────
  leads: router({
    listar: equipeProcedure
      .input(z.object({ status: z.enum(STATUS_LEAD).optional() }).default({}))
      .query(({ input }) =>
        db
          .select()
          .from(leads)
          .where(input.status ? eq(leads.status, input.status) : undefined)
          .orderBy(desc(leads.criadoEm))
          .limit(300),
      ),
    atualizar: equipeProcedure
      .input(z.object({ id: z.number().int(), status: z.enum(STATUS_LEAD).optional(), notas: z.string().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...dados } = input;
        const [l] = await db
          .update(leads)
          .set({ ...dados, atualizadoEm: new Date(), assessorId: ctx.usuario.id })
          .where(eq(leads.id, id))
          .returning({ id: leads.id });
        if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado." });
        await auditar({ atorId: ctx.usuario.id, acao: "lead_atualizado", entidade: "lead", entidadeId: id, dados, ip: ctx.ip });
        return { ok: true as const };
      }),
  }),

  // ─── Ofertas e CCBs (admin) ───────────────────────────────────────────────
  ofertas: router({
    listar: adminProcedure.query(() => db.select().from(ofertas).orderBy(desc(ofertas.criadoEm))),
    salvar: adminProcedure
      .input(
        z.object({
          id: z.number().int().optional(),
          nome: z.string().trim().min(3).max(255),
          descricao: z.string().max(4000).optional(),
          faixas: z.array(faixaSchema).min(1).max(12),
          carenciaPrincipalDias: z.number().int().min(1).max(3650),
          prazoResgateDias: z.number().int().min(0).max(90),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...dados } = input;
        const [o] = id
          ? await db.update(ofertas).set(dados).where(eq(ofertas.id, id)).returning()
          : await db.insert(ofertas).values(dados).returning();
        if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Oferta não encontrada." });
        await auditar({ atorId: ctx.usuario.id, acao: id ? "oferta_editada" : "oferta_criada", entidade: "oferta", entidadeId: o.id, dados, ip: ctx.ip });
        return o;
      }),
    ativar: adminProcedure.input(z.object({ id: z.number().int(), ativa: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.ativa) await db.update(ofertas).set({ ativa: false }).where(eq(ofertas.ativa, true));
      await db.update(ofertas).set({ ativa: input.ativa }).where(eq(ofertas.id, input.id));
      await auditar({ atorId: ctx.usuario.id, acao: input.ativa ? "oferta_ativada" : "oferta_desativada", entidade: "oferta", entidadeId: input.id, ip: ctx.ip });
      return { ok: true as const };
    }),
  }),

  ccbs: router({
    listar: adminProcedure
      .input(z.object({ ofertaId: z.number().int() }))
      .query(({ input }) => db.select().from(ccbs).where(eq(ccbs.ofertaId, input.ofertaId)).orderBy(ccbs.codigo)),
    salvar: adminProcedure
      .input(
        z.object({
          id: z.number().int().optional(),
          ofertaId: z.number().int(),
          codigo: z.string().trim().min(2).max(64),
          setor: z.enum(SETORES),
          devedorDescricao: z.string().trim().min(3).max(255),
          valorCentavos: z.number().int().positive(),
          garantiaTipo: z.string().trim().min(3).max(128),
          garantiaValorCentavos: z.number().int().positive().nullable(),
          vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          situacao: z.enum(SITUACOES_CCB),
          diasAtraso: z.number().int().min(0).max(3650),
          registroRef: z.string().max(255).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...dados } = input;
        const valores = { ...dados, atualizadoEm: new Date() };
        const [c] = id
          ? await db.update(ccbs).set(valores).where(eq(ccbs.id, id)).returning()
          : await db.insert(ccbs).values(valores).returning();
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "CCB não encontrada." });
        await auditar({ atorId: ctx.usuario.id, acao: id ? "ccb_editada" : "ccb_criada", entidade: "ccb", entidadeId: c.id, dados, ip: ctx.ip });
        return c;
      }),
  }),

  // ─── Documentos (admin) ───────────────────────────────────────────────────
  documentos: router({
    prepararEnvio: adminProcedure
      .input(
        z.object({
          escopo: z.enum(["publico", "investidor", "contrato", "oferta", "ccb"]),
          escopoId: z.number().int().nullable(),
          nomeArquivo: z.string().min(1).max(200),
          contentType: z.string().max(100),
          tamanho: z.number().int().positive(),
        }),
      )
      .mutation(async ({ input }) => {
        if (!r2Configurado()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure o R2 para enviar documentos." });
        const chave = chaveDocumento(input.escopo, input.escopoId, input.nomeArquivo);
        try {
          return { chave, url: await urlEnvio(chave, input.contentType, input.tamanho) };
        } catch (e) {
          throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
        }
      }),
    registrar: adminProcedure
      .input(
        z.object({
          escopo: z.enum(["publico", "investidor", "contrato", "oferta", "ccb"]),
          escopoId: z.number().int().nullable(),
          tipo: z.string().min(2).max(64),
          titulo: z.string().trim().min(3).max(255),
          chave: z.string().startsWith("docs/").max(500),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          tamanhoBytes: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { chave, ...resto } = input;
        const [d] = await db
          .insert(documentos)
          .values({ ...resto, storageKey: chave, publicadoPor: ctx.usuario.id })
          .returning({ id: documentos.id });
        await auditar({ atorId: ctx.usuario.id, acao: "documento_publicado", entidade: "documento", entidadeId: d!.id, dados: { escopo: input.escopo, sha256: input.sha256 }, ip: ctx.ip });
        return d!;
      }),
  }),

  // ─── Comunicação (equipe) ─────────────────────────────────────────────────
  comunicacao: router({
    avaliar: equipeProcedure.input(z.object({ texto: z.string().min(1).max(5000) })).mutation(({ input }) => avaliarTexto(input.texto)),
    salvar: equipeProcedure
      .input(z.object({ canal: z.enum(["meta_ads", "landing", "email", "whatsapp", "outro"]), texto: z.string().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const resultado = avaliarTexto(input.texto);
        if (!resultado.aprovado) throw new TRPCError({ code: "BAD_REQUEST", message: "A peça tem termos bloqueados. Corrija antes de salvar." });
        const [p] = await db
          .insert(pecasComunicacao)
          .values({ ...input, resultadoGuard: resultado, criadoPor: ctx.usuario.id })
          .returning({ id: pecasComunicacao.id });
        return p!;
      }),
    listar: equipeProcedure.query(() => db.select().from(pecasComunicacao).orderBy(desc(pecasComunicacao.criadoEm)).limit(100)),
  }),

  // ─── Usuários e auditoria (admin) ─────────────────────────────────────────
  usuarios: router({
    listar: adminProcedure.query(() =>
      db
        .select({ id: usuarios.id, email: usuarios.email, nome: usuarios.nome, papel: usuarios.papel, ativo: usuarios.ativo, ultimoLoginEm: usuarios.ultimoLoginEm })
        .from(usuarios)
        .orderBy(desc(usuarios.criadoEm))
        .limit(500),
    ),
    mudarPapel: adminProcedure
      .input(z.object({ id: z.number().int(), papel: z.enum(PAPEIS) }))
      .mutation(async ({ ctx, input }) => {
        if (input.id === ctx.usuario.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar o próprio papel." });
        // incrementar a versão derruba as sessões abertas com o papel antigo
        await db
          .update(usuarios)
          .set({ papel: input.papel, versaoSessao: sql`${usuarios.versaoSessao} + 1` })
          .where(eq(usuarios.id, input.id));
        await auditar({ atorId: ctx.usuario.id, acao: "papel_alterado", entidade: "usuario", entidadeId: input.id, dados: { papel: input.papel }, ip: ctx.ip });
        return { ok: true as const };
      }),
  }),

  auditoria: adminProcedure
    .input(z.object({ entidade: z.string().max(64).optional() }).default({}))
    .query(({ input }) =>
      db
        .select()
        .from(auditoria)
        .where(input.entidade ? and(eq(auditoria.entidade, input.entidade)) : undefined)
        .orderBy(desc(auditoria.criadoEm))
        .limit(200),
    ),
});
