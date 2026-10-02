/**
 * Cron (padrão Caro): endpoints chamados pelo Render Cron Job, protegidos por
 * CRON_SECRET no header Authorization. Nunca expostos ao navegador.
 */
import { Router } from "express";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { investidores, leads, progressoTrilha, usuarios } from "../schema";
import { ENV } from "./env";
import { iguaisSeguro } from "./sessao";
import { emailLembreteLeadParado, emailLembreteTrilha, enviarEmail } from "./email";

const cronRouter = Router();

/** Executa os lembretes. Exportado para os testes. */
export async function executarLembretes(agora = new Date()) {
  // 1. Leads "novo" há mais de 24h sem lembrete: avisa a equipe uma única vez.
  const limiteLead = new Date(agora.getTime() - 24 * 3_600_000);
  const parados = await db
    .update(leads)
    .set({ lembreteEnviadoEm: agora })
    .where(and(eq(leads.status, "novo"), isNull(leads.lembreteEnviadoEm), lt(leads.criadoEm, limiteLead)))
    .returning({ id: leads.id });
  if (parados.length) {
    for (const para of ENV.emailsAssessores) {
      await enviarEmail({ para, assunto: `${parados.length} lead(s) aguardando contato`, html: emailLembreteLeadParado(parados.length) });
    }
  }

  // 2. Investidores que começaram a trilha há 3+ dias e não terminaram: um lembrete.
  //    (padrão "checkout abandonado" da Caro, aplicado ao onboarding)
  const limiteTrilha = new Date(agora.getTime() - 3 * 86_400_000);
  const pendentes = await db
    .select({ invId: investidores.id, email: usuarios.email, nome: usuarios.nome })
    .from(investidores)
    .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
    .where(
      and(
        isNull(investidores.trilhaConcluidaEm),
        isNull(investidores.lembreteTrilhaEnviadoEm),
        sql`exists (select 1 from ${progressoTrilha} p where p.usuario_id = ${usuarios.id})`,
        sql`(select min(p.concluido_em) from ${progressoTrilha} p where p.usuario_id = ${usuarios.id}) < ${limiteTrilha.toISOString()}`,
      ),
    );
  for (const p of pendentes) {
    await enviarEmail({ para: p.email, assunto: "Falta pouco para concluir sua trilha", html: emailLembreteTrilha(p.nome) });
    await db.update(investidores).set({ lembreteTrilhaEnviadoEm: agora }).where(eq(investidores.id, p.invId));
  }

  return { leadsParados: parados.length, lembretesTrilha: pendentes.length };
}

cronRouter.post("/lembretes", async (req, res) => {
  if (!ENV.cronSecret) return res.status(503).json({ erro: "Cron não configurado no servidor." });
  const auth = req.header("authorization") ?? "";
  if (!iguaisSeguro(auth, `Bearer ${ENV.cronSecret}`)) return res.sendStatus(401);
  try {
    res.json(await executarLembretes());
  } catch (e) {
    console.error("[cron] falha nos lembretes:", e);
    res.status(500).json({ erro: "Falha ao processar." });
  }
});

export default cronRouter;
