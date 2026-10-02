/**
 * Regras de conta compartilhadas pelo link mágico e pelo Google.
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { investidores, usuarios, type Usuario } from "../../shared/schema";
import { ENV } from "../_core/env";

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Encontra ou cria o usuário. E-mails em ADMIN_EMAILS viram admin. */
export async function encontrarOuCriarUsuario(p: {
  email: string;
  nome?: string | null;
  googleSub?: string | null;
}): Promise<Usuario> {
  const email = normalizarEmail(p.email);
  const papelInicial = ENV.adminEmails.includes(email) ? "admin" : "investidor";

  const [existente] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existente) {
    const [atualizado] = await db
      .update(usuarios)
      .set({
        ultimoLoginEm: new Date(),
        nome: existente.nome ?? p.nome ?? null,
        googleSub: existente.googleSub ?? p.googleSub ?? null,
        // promove, nunca rebaixa, a partir da lista de admins
        ...(papelInicial === "admin" && existente.papel !== "admin" ? { papel: "admin" as const } : {}),
      })
      .where(eq(usuarios.id, existente.id))
      .returning();
    return atualizado!;
  }

  const [novo] = await db
    .insert(usuarios)
    .values({ email, nome: p.nome ?? null, googleSub: p.googleSub ?? null, papel: papelInicial, ultimoLoginEm: new Date() })
    .returning();
  if (novo!.papel === "investidor") {
    await db.insert(investidores).values({ usuarioId: novo!.id }).onConflictDoNothing();
  }
  return novo!;
}
