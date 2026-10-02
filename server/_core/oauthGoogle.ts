/**
 * Login com Google (OAuth 2.0, authorization code), no mesmo formato de rotas
 * do MecProAI: GET /api/auth/google e GET /api/auth/google/callback.
 *
 * Diferença em relação ao MecProAI: o `state` é um valor aleatório guardado em
 * cookie httpOnly e conferido no retorno (proteção contra login forjado). O
 * destino pós-login ("voltar") viaja no mesmo cookie, nunca na URL do Google.
 */
import { Router, type Request } from "express";
import { COOKIE_OAUTH_STATE } from "../../shared/const";
import { ENV, googleConfigurado } from "./env";
import { gravarSessao, iguaisSeguro, opcoesCookie, tokenAleatorio } from "./sessao";
import { limiteLogin } from "./rateLimit";
import { encontrarOuCriarUsuario } from "../contas";
import { auditar } from "../auditoria";
import { log } from "../logger";

const router = Router();

/** URL de retorno cadastrada no Google Cloud. GOOGLE_CALLBACK_URL sobrescreve (como no MecProAI). */
export const urlCallbackGoogle = () => ENV.googleCallbackUrl || `${ENV.appUrl}/api/auth/google/callback`;

/** Só aceita caminho interno ("/painel"), nunca URL externa nem "//dominio". Evita redirecionamento aberto. */
export function destinoSeguro(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 300) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.startsWith("/api/")) return null;
  return v;
}

type EstadoOAuth = { s: string; v: string | null };

function lerEstado(req: Request): EstadoOAuth | null {
  const bruto = req.cookies?.[COOKIE_OAUTH_STATE];
  if (typeof bruto !== "string") return null;
  try {
    const e = JSON.parse(Buffer.from(bruto, "base64url").toString("utf8")) as EstadoOAuth;
    return typeof e.s === "string" ? { s: e.s, v: destinoSeguro(e.v) } : null;
  } catch {
    return null;
  }
}

router.get("/google", limiteLogin, (req, res) => {
  if (!googleConfigurado()) return res.redirect("/entrar?erro=google_indisponivel");

  const estado: EstadoOAuth = { s: tokenAleatorio(24), v: destinoSeguro(req.query.voltar) };
  res.cookie(COOKIE_OAUTH_STATE, Buffer.from(JSON.stringify(estado)).toString("base64url"), {
    ...opcoesCookie(req),
    maxAge: 10 * 60_000,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: urlCallbackGoogle(),
    response_type: "code",
    scope: "openid email profile",
    state: estado.s,
    prompt: "select_account",
  }).toString();
  res.redirect(url.toString());
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const esperado = lerEstado(req);
  res.clearCookie(COOKIE_OAUTH_STATE, opcoesCookie(req));

  // Pessoa clicou em "Cancelar" na tela do Google
  if (error === "access_denied") return res.redirect("/entrar?erro=google_cancelado");
  if (error) return res.redirect("/entrar?erro=google_falhou");
  if (!code || !state || !esperado || !iguaisSeguro(state, esperado.s)) {
    return res.redirect("/entrar?erro=estado_invalido");
  }

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: urlCallbackGoogle(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) {
      const corpo = (await tokenResp.json().catch(() => ({}))) as { error?: string };
      // invalid_grant = código já usado ou expirado (voltar/atualizar a página do callback)
      log.warn("google", "troca de código falhou", { status: tokenResp.status, erro: corpo.error });
      return res.redirect(corpo.error === "invalid_grant" ? "/entrar?erro=google_expirado" : "/entrar?erro=google_falhou");
    }
    const { access_token } = (await tokenResp.json()) as { access_token: string };

    const perfilResp = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!perfilResp.ok) throw new Error(`userinfo ${perfilResp.status}`);
    const perfil = (await perfilResp.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };

    if (!perfil.email || !perfil.email_verified) return res.redirect("/entrar?erro=email_nao_verificado");

    const usuario = await encontrarOuCriarUsuario({ email: perfil.email, nome: perfil.name, googleSub: perfil.sub });
    if (!usuario.ativo) return res.redirect("/entrar?erro=conta_inativa");

    await gravarSessao(req, res, { sub: usuario.id, papel: usuario.papel, v: usuario.versaoSessao });
    await auditar({ atorId: usuario.id, acao: "login_google", entidade: "usuario", entidadeId: usuario.id, ip: req.ip });
    log.info("google", "login concluído", { usuarioId: usuario.id, papel: usuario.papel, voltar: Boolean(esperado.v) });
    res.redirect(esperado.v ?? (usuario.papel === "investidor" ? "/painel" : "/admin"));
  } catch (e) {
    log.error("google", "falha no callback", String(e));
    res.redirect("/entrar?erro=google_falhou");
  }
});

export default router;
