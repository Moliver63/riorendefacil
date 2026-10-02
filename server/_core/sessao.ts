/**
 * Sessão: JWT assinado (HS256, jose) num cookie httpOnly. Padrão do MecProAI.
 * O cookie nunca carrega dados confiáveis em texto puro: o servidor só aceita
 * o que ele mesmo assinou, e confere a versão da sessão no banco.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, CookieOptions } from "express";
import { COOKIE_SESSAO, SESSAO_DIAS, type Papel } from "../../shared/const";
import { ENV } from "./env";

const chave = () => new TextEncoder().encode(ENV.sessionSecret);

export type PayloadSessao = { sub: number; papel: Papel; v: number };

export async function assinarSessao(p: PayloadSessao): Promise<string> {
  return new SignJWT({ papel: p.papel, v: p.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(p.sub))
    .setIssuedAt()
    .setExpirationTime(`${SESSAO_DIAS}d`)
    .sign(chave());
}

export async function lerSessao(token: string | undefined): Promise<PayloadSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    const sub = Number(payload.sub);
    if (!Number.isInteger(sub) || sub <= 0) return null;
    return { sub, papel: payload.papel as Papel, v: Number(payload.v) };
  } catch {
    return null;
  }
}

export function opcoesCookie(req: Request): CookieOptions {
  const https = ENV.isProduction || req.protocol === "https";
  return {
    httpOnly: true,
    secure: https,
    sameSite: "lax",
    path: "/",
  };
}

export async function gravarSessao(req: Request, res: Response, p: PayloadSessao) {
  res.cookie(COOKIE_SESSAO, await assinarSessao(p), {
    ...opcoesCookie(req),
    maxAge: SESSAO_DIAS * 24 * 60 * 60 * 1000,
  });
}

export function limparSessao(req: Request, res: Response) {
  res.clearCookie(COOKIE_SESSAO, opcoesCookie(req));
}

/** Token aleatório criptograficamente seguro (nunca Math.random). */
export function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function iguaisSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
