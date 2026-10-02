/**
 * Logger simples com nível e contexto (formato do MecProAI: log.info("[area] mensagem", dados)).
 * Em produção sai uma linha JSON por evento, fácil de filtrar nos logs do Render.
 */
import { ENV } from "./_core/env";

type Nivel = "debug" | "info" | "warn" | "error";

function emitir(nivel: Nivel, area: string, mensagem: string, dados?: unknown) {
  if (ENV.isTest && nivel !== "error") return;
  if (ENV.isProduction) {
    const linha = { t: new Date().toISOString(), nivel, area, mensagem, ...(dados !== undefined ? { dados } : {}) };
    (nivel === "error" ? console.error : console.log)(JSON.stringify(linha));
    return;
  }
  const f = nivel === "error" ? console.error : nivel === "warn" ? console.warn : console.log;
  dados === undefined ? f(`[${area}] ${mensagem}`) : f(`[${area}] ${mensagem}`, dados);
}

export const log = {
  debug: (area: string, msg: string, dados?: unknown) => !ENV.isProduction && emitir("debug", area, msg, dados),
  info: (area: string, msg: string, dados?: unknown) => emitir("info", area, msg, dados),
  warn: (area: string, msg: string, dados?: unknown) => emitir("warn", area, msg, dados),
  error: (area: string, msg: string, dados?: unknown) => emitir("error", area, msg, dados),
};
