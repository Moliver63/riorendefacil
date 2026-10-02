import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { router, comPapel } from "./trpc";
import { db } from "../db";
import { investidores, progressoTrilha } from "../schema";
import { TRILHA, corrigir, estadoTrilha, moduloSemGabarito } from "../../shared/trilha";
import { auditar } from "../auditoria";

const investidorProcedure = comPapel("investidor", "assessor", "admin");

async function concluidos(usuarioId: number): Promise<string[]> {
  const linhas = await db
    .select({ slug: progressoTrilha.moduloSlug })
    .from(progressoTrilha)
    .where(eq(progressoTrilha.usuarioId, usuarioId))
    .orderBy(asc(progressoTrilha.concluidoEm));
  return linhas.map((l) => l.slug);
}

export const trilhaRouter = router({
  estado: investidorProcedure.query(async ({ ctx }) => estadoTrilha(await concluidos(ctx.usuario.id))),

  modulo: investidorProcedure.input(z.object({ slug: z.string().max(64) })).query(async ({ ctx, input }) => {
    const estado = estadoTrilha(await concluidos(ctx.usuario.id));
    const m = TRILHA.find((x) => x.slug === input.slug);
    const e = estado.modulos.find((x) => x.slug === input.slug);
    if (!m || !e) throw new TRPCError({ code: "NOT_FOUND", message: "Módulo não encontrado." });
    if (!e.liberado) throw new TRPCError({ code: "FORBIDDEN", message: "Conclua o módulo anterior primeiro." });
    return { ...moduloSemGabarito(m), concluido: e.concluido };
  }),

  responder: investidorProcedure
    .input(z.object({ slug: z.string().max(64), respostas: z.record(z.number().int().min(0).max(10)) }))
    .mutation(async ({ ctx, input }) => {
      const estado = estadoTrilha(await concluidos(ctx.usuario.id));
      const m = TRILHA.find((x) => x.slug === input.slug);
      const e = estado.modulos.find((x) => x.slug === input.slug);
      if (!m || !e) throw new TRPCError({ code: "NOT_FOUND", message: "Módulo não encontrado." });
      if (!e.liberado) throw new TRPCError({ code: "FORBIDDEN", message: "Conclua o módulo anterior primeiro." });

      const r = corrigir(m, input.respostas);
      const gabarito = m.perguntas.map((p) => ({
        id: p.id,
        correta: p.correta,
        acertou: input.respostas[p.id] === p.correta,
        explicacao: p.explicacao,
      }));
      if (!r.aprovado) return { ...r, gabarito, trilhaCompleta: false };

      await db
        .insert(progressoTrilha)
        .values({ usuarioId: ctx.usuario.id, moduloSlug: m.slug, acertos: r.acertos, total: r.total })
        .onConflictDoNothing();

      const novo = estadoTrilha(await concluidos(ctx.usuario.id));
      if (novo.completa) {
        await db
          .update(investidores)
          .set({ trilhaConcluidaEm: new Date() })
          .where(eq(investidores.usuarioId, ctx.usuario.id));
        await auditar({ atorId: ctx.usuario.id, acao: "trilha_concluida", entidade: "usuario", entidadeId: ctx.usuario.id, ip: ctx.ip });
      }
      return { ...r, gabarito, trilhaCompleta: novo.completa };
    }),
});
