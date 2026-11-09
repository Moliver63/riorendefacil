import { db } from "./db";
import { auditoria } from "./schema";

/** Registra um evento na trilha de auditoria. Falha de log nunca derruba a ação. */
export async function auditar(e: {
  atorId?: number | null;
  acao: string;
  entidade: string;
  entidadeId?: number | null;
  dados?: unknown;
  ip?: string;
}) {
  try {
    await db.insert(auditoria).values({
      atorId: e.atorId ?? null,
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      dados: e.dados ?? null,
      ip: e.ip?.slice(0, 64) ?? null,
    });
  } catch (erro) {
    console.error("[auditoria] falha ao registrar:", e.acao, erro);
  }
}

/**
 * Campos que mudaram entre o registro antigo e o novo, no formato
 * { campo: { antes, depois } }. Vai em `dados` da auditoria para que toda
 * alteração financeira mostre o valor anterior.
 */
export function diferencas(antes: Record<string, unknown> | null | undefined, depois: Record<string, unknown>) {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);
  const r: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const [k, v] of Object.entries(depois)) {
    if (k === "atualizadoEm") continue;
    const a = norm(antes?.[k]);
    const d = norm(v);
    if (JSON.stringify(a) !== JSON.stringify(d)) r[k] = { antes: a, depois: d };
  }
  return r;
}
