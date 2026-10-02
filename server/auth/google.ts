/**
 * Login com Google (OAuth 2.0, fluxo authorization code) sem passport.
 * O parâmetro `state` vai num cookie httpOnly e é conferido no retorno,
 * protegendo contra CSRF no login.
 */
import { Router } from "express";
import { COOKIE_OAUTH_STATE } from "../../shared/const";
import { ENV, googleConfigurado } from "../_core/env";
import { gravarSessao, iguaisSeguro, opcoesCookie, tokenAleatorio } from "../_core/sessao";
import { limiteLogin } from "../_core/rateLimit";
import { encontrarOuCriarUsuario } from "./contas";
import { auditar } from "../lib/auditoria";

const router = Router();
const callback = () => `${ENV.appUrl}/api/auth/google/callback`;

router.get("/google", limiteLogin, (req, res) => {
  if (!googleConfigurado()) return res.redirect("/entrar?erro=google_indisponivel");
  const state = tokenAleatorio(24);
  res.cookie(COOKIE_OAUTH_STATE, state, { ...opcoesCookie(req), maxAge: 10 * 60_000 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: callback(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  res.redirect(url.toString());
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const esperado = req.cookies?.[COOKIE_OAUTH_STATE];
  res.clearCookie(COOKIE_OAUTH_STATE, opcoesCookie(req));

  if (error) return res.redirect(`/entrar?erro=google_${encodeURIComponent(error)}`);
  if (!code || !state || !esperado || !iguaisSeguro(state, esperado)) {
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
        redirect_uri: callback(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) throw new Error(`token ${tokenResp.status}`);
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
    res.redirect(usuario.papel === "investidor" ? "/painel" : "/admin");
  } catch (e) {
    console.error("[google] falha no callback:", e);
    res.redirect("/entrar?erro=google_falhou");
  }
});

export default router;
