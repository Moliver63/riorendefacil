import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router";
import { createContext } from "./context";
import { ENV } from "./env";
import { aplicarMigracoes, tipoBanco } from "../db";
import { cabecalhosSeguranca } from "./security";
import { limiteApi, limiteErroCliente, limiteFormulario, limiteLogin, limitePorProcedure } from "./rateLimit";
import { serveStatic, setupVite } from "./vite";
import googleRouter from "./oauthGoogle";
import linkRouter from "./linkAcesso";
import authRoutes from "./authRoutes";
import cronRouter from "./cronRouter";
import { seoRouter } from "./seo";
import { log } from "../logger";

export function criarApp() {
  const app = express();
  if (ENV.isProduction) app.set("trust proxy", 1); // Render fica atrás de proxy
  app.disable("x-powered-by");

  app.use(cabecalhosSeguranca);
  app.use(cookieParser());
  // Parser antes das rotas (lição do MecProAI: registrado depois, req.body fica undefined)
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", banco: tipoBanco }));

  // ─── Rotas REST ─────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes); //   GET /api/auth/me · POST /api/auth/logout
  app.use("/api/auth", linkRouter); //   GET /api/auth/link?t=...
  app.use("/api/auth", googleRouter); // GET /api/auth/google · /api/auth/google/callback
  app.use("/api/cron", cronRouter); //  POST /api/cron/lembretes
  app.use(seoRouter); //                 GET /sitemap.xml · /robots.txt

  // Sourcemaps "hidden" nunca são servidos (padrão MecProAI)
  app.use((req, res, next) => (req.path.endsWith(".map") ? res.sendStatus(404) : next()));

  // Erros de tela enviados pelo ErrorBoundary vão para os logs do Render (padrão MecProAI)
  app.post("/api/client-error", limiteErroCliente, (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const curto = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
    log.error("client", curto(b.mensagem, 500) ?? "erro sem mensagem", {
      url: curto(b.url, 300),
      contexto: curto(b.contexto, 100),
      pilha: curto(b.pilha, 1500),
    });
    res.sendStatus(204);
  });

  // ─── tRPC: todas as procedures em server/_core/router.ts ───────────────────

  app.use(
    "/api/trpc",
    limiteApi,
    limitePorProcedure({
      "auth.pedirLink": limiteLogin,
      "leads.criar": limiteFormulario,
    }),
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  // Última linha de defesa: erro não tratado vira 500 sem derrubar o processo.
  const erro: ErrorRequestHandler = (err, _req, res, _next) => {
    log.error("http", "erro não tratado", String(err?.stack ?? err));
    if (!res.headersSent) res.status(500).json({ erro: "Erro interno do servidor." });
  };
  app.use("/api", erro);

  return app;
}

async function iniciar() {
  await aplicarMigracoes();
  const app = criarApp();
  const server = createServer(app);
  if (ENV.isProduction) serveStatic(app);
  else await setupVite(app, server);
  server.listen(ENV.port, () => log.info("rrf", `rodando em http://localhost:${ENV.port} (${tipoBanco})`));
}

if (!ENV.isTest) {
  iniciar().catch((e) => {
    log.error("rrf", "falha ao iniciar", String(e?.stack ?? e));
    process.exit(1);
  });
  process.on("unhandledRejection", (r) => log.error("rrf", "unhandledRejection", String(r)));
}
