/**
 * Rotas REST de sessão (formato do MecProAI: o hook useAuth lê /api/auth/me).
 * O login em si fica em linkAcesso.ts (e-mail) e oauthGoogle.ts (Google).
 */
import { Router } from "express";
import { usuarioDaRequisicao } from "./context";
import { limparSessao } from "./sessao";

const router = Router();

/** Usuário da sessão atual. 200 com null quando não há sessão, nunca 401 (evita ruído no console). */
router.get("/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const u = await usuarioDaRequisicao(req);
    res.json(u ? { id: u.id, email: u.email, nome: u.nome, papel: u.papel } : null);
  } catch {
    res.json(null);
  }
});

router.post("/logout", (req, res) => {
  limparSessao(req, res);
  res.json({ ok: true });
});

export default router;
