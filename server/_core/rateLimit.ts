import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { ENV } from "./env";

/** Limites por rota (padrão Shadia). Em testes ficam desligados. */
function limite(janelaMs: number, max: number, mensagem: string): RequestHandler {
  if (ENV.isTest) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: janelaMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { erro: mensagem },
  });
}

export const limiteApi = limite(60_000, 150, "Muitas requisições. Aguarde um momento.");
export const limiteLogin = limite(15 * 60_000, 6, "Muitas tentativas de acesso. Tente de novo em 15 minutos.");
export const limiteFormulario = limite(60 * 60_000, 6, "Muitos envios. Tente de novo em 1 hora.");
export const limiteErroCliente = limite(60_000, 20, "Muitos relatórios de erro.");

/** Aplica limite apenas a procedures tRPC específicas (o tRPC usa um único endpoint). */
export function limitePorProcedure(mapa: Record<string, RequestHandler>): RequestHandler {
  return (req, res, next) => {
    const caminho = req.path.replace(/^\//, "");
    const nomes = caminho.split(",");
    const alvo = nomes.map((n) => mapa[n]).find(Boolean);
    return alvo ? alvo(req, res, next) : next();
  };
}
