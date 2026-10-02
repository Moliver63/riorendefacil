import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserById } from "../db";
import type { Usuario } from "../schema";
import { COOKIE_SESSAO } from "../../shared/const";
import { lerSessao } from "./sessao";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  usuario: Usuario | null;
  ip: string;
};

export async function usuarioDaRequisicao(req: CreateExpressContextOptions["req"]): Promise<Usuario | null> {
  const sessao = await lerSessao(req.cookies?.[COOKIE_SESSAO]);
  if (!sessao) return null;
  const u = await getUserById(sessao.sub);
  // versão diferente = sessão revogada (logout em todos os dispositivos, troca de papel)
  if (!u || !u.ativo || u.versaoSessao !== sessao.v) return null;
  return u;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let usuario: Usuario | null = null;
  try {
    usuario = await usuarioDaRequisicao(opts.req);
  } catch (e) {
    console.error("[context] falha ao ler sessão:", e);
  }
  return { req: opts.req, res: opts.res, usuario, ip: opts.req.ip ?? "" };
}
