import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { limparSessao } from "../_core/sessao";
import { googleConfigurado, ENV } from "../_core/env";
import { db } from "../db";
import { usuarios } from "../../shared/schema";
import { criarLinkAcesso } from "../auth/link";
import { auditar } from "../lib/auditoria";

export const authRouter = router({
  /** Usuário da sessão atual, ou null. */
  eu: publicProcedure.query(({ ctx }) => {
    const u = ctx.usuario;
    return u ? { id: u.id, email: u.email, nome: u.nome, papel: u.papel } : null;
  }),

  metodos: publicProcedure.query(() => ({ google: googleConfigurado() })),

  /**
   * Pede link de acesso por e-mail. Resposta idêntica exista ou não a conta,
   * para não revelar quem está cadastrado.
   */
  pedirLink: publicProcedure
    .input(z.object({ email: z.string().trim().email().max(255) }))
    .mutation(async ({ input, ctx }) => {
      const link = await criarLinkAcesso(input.email, ctx.ip);
      // Em desenvolvimento sem Resend, devolve o link para facilitar o teste local.
      const devLink = !ENV.isProduction && !ENV.resendApiKey ? link : undefined;
      return { ok: true as const, devLink };
    }),

  sair: protectedProcedure.mutation(({ ctx }) => {
    limparSessao(ctx.req, ctx.res);
    return { ok: true as const };
  }),

  /** Invalida a sessão em todos os dispositivos. */
  sairDeTodos: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(usuarios)
      .set({ versaoSessao: sql`${usuarios.versaoSessao} + 1` })
      .where(eq(usuarios.id, ctx.usuario.id));
    limparSessao(ctx.req, ctx.res);
    await auditar({ atorId: ctx.usuario.id, acao: "sair_de_todos", entidade: "usuario", entidadeId: ctx.usuario.id, ip: ctx.ip });
    return { ok: true as const };
  }),
});
