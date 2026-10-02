/**
 * Camada de persistência. Usa Postgres quando DATABASE_URL existe; sem banco,
 * cai para memória (só desenvolvimento), e avisa no log.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { auditoria, leads } from "./schema";

type NovoLead = typeof leads.$inferInsert;

const url = process.env.DATABASE_URL;
const db = url ? drizzle(postgres(url, { max: 5 })) : null;

if (!db) {
  console.warn("[repo] DATABASE_URL ausente: usando armazenamento em memória (somente desenvolvimento).");
}

const memoria: (NovoLead & { id: number })[] = [];

export const leadsRepo = {
  async criar(dados: NovoLead): Promise<{ id: number }> {
    if (db) {
      const [row] = await db.insert(leads).values(dados).returning({ id: leads.id });
      if (!row) throw new Error("Falha ao gravar lead");
      await db.insert(auditoria).values({ acao: "lead_criado", entidade: "lead", entidadeId: row.id });
      return row;
    }
    const id = memoria.length + 1;
    memoria.push({ ...dados, id });
    return { id };
  },
};
