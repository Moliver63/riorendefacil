/**
 * Link mágico: entrada por e-mail sem senha. Nada de senha guardada, nada de
 * senha fraca. O token vai só no e-mail; no banco fica apenas o hash.
 */
import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { linksAcesso } from "../../shared/schema";
import { LINK_ACESSO_MINUTOS } from "../../shared/const";
import { ENV } from "../_core/env";
import { gravarSessao, sha256, tokenAleatorio } from "../_core/sessao";
import { emailLinkAcesso, enviarEmail } from "../lib/email";
import { auditar } from "../lib/auditoria";
import { encontrarOuCriarUsuario, normalizarEmail } from "./contas";

/** Cria o link e envia por e-mail. Retorna o link só em teste/dev sem Resend. */
export async function criarLinkAcesso(emailBruto: string, ip: string): Promise<string> {
  const email = normalizarEmail(emailBruto);
  const token = tokenAleatorio(32);
  await db.insert(linksAcesso).values({
    email,
    tokenHash: sha256(token),
    expiraEm: new Date(Date.now() + LINK_ACESSO_MINUTOS * 60_000),
    ip: ip.slice(0, 64),
  });
  const link = `${ENV.appUrl}/api/auth/link?t=${encodeURIComponent(token)}`;
  await enviarEmail({ para: email, assunto: "Seu link de acesso ao RioRendeFácil", html: emailLinkAcesso(link, LINK_ACESSO_MINUTOS) });
  return link;
}

/** Consome o token (uso único). Retorna o e-mail se válido. */
export async function consumirLinkAcesso(token: string): Promise<string | null> {
  const hash = sha256(token);
  const [linha] = await db
    .update(linksAcesso)
    .set({ usadoEm: new Date() })
    .where(and(eq(linksAcesso.tokenHash, hash), isNull(linksAcesso.usadoEm), gt(linksAcesso.expiraEm, new Date())))
    .returning({ email: linksAcesso.email });
  return linha?.email ?? null;
}

const router = Router();

router.get("/link", async (req, res) => {
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!token || token.length > 100) return res.redirect("/entrar?erro=link_invalido");
  try {
    const email = await consumirLinkAcesso(token);
    if (!email) return res.redirect("/entrar?erro=link_expirado");
    const usuario = await encontrarOuCriarUsuario({ email });
    if (!usuario.ativo) return res.redirect("/entrar?erro=conta_inativa");
    await gravarSessao(req, res, { sub: usuario.id, papel: usuario.papel, v: usuario.versaoSessao });
    await auditar({ atorId: usuario.id, acao: "login_link", entidade: "usuario", entidadeId: usuario.id, ip: req.ip });
    res.redirect(usuario.papel === "investidor" ? "/painel" : "/admin");
  } catch (e) {
    console.error("[link] falha:", e);
    res.redirect("/entrar?erro=link_falhou");
  }
});

export default router;
