import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { MSG_NAO_AUTENTICADO, MSG_SEM_PERMISSAO, type Papel } from "../../shared/const";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Erro de validação vira mensagem em português (padrão Caro). Erros que
  // lançamos com mensagem própria passam intactos.
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      return { ...shape, message: "Verifique os dados preenchidos e tente novamente." };
    }
    if (error.code === "INTERNAL_SERVER_ERROR") {
      console.error("[trpc]", error);
      return { ...shape, message: "Algo deu errado do nosso lado. Tente de novo em instantes." };
    }
    return shape;
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.usuario) throw new TRPCError({ code: "UNAUTHORIZED", message: MSG_NAO_AUTENTICADO });
  return next({ ctx: { ...ctx, usuario: ctx.usuario } });
});

/** Procedure restrita a papéis (padrão Shadia: admin > assessor > investidor). */
export function comPapel(...papeis: Papel[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!papeis.includes(ctx.usuario.papel)) {
      throw new TRPCError({ code: "FORBIDDEN", message: MSG_SEM_PERMISSAO });
    }
    return next({ ctx });
  });
}

export const equipeProcedure = comPapel("assessor", "admin");
export const adminProcedure = comPapel("admin");
