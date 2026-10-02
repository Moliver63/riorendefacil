import { db } from "../db";
import { auditoria } from "../../shared/schema";

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
