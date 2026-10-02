import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { aplicarMigracoes, tipoBanco } from "../db";
import { cabecalhosSeguranca } from "./security";
import { limiteApi, limiteFormulario, limiteLogin, limitePorProcedure } from "./rateLimit";
import { serveStatic, setupVite } from "./vite";
import googleRouter from "../auth/google";
import linkRouter from "../auth/link";
import cronRouter from "../routes/cron";
import { seoRouter } from "../routes/seo";

export function criarApp() {
  const app = express();
  if (ENV.isProduction) app.set("trust proxy", 1); // Render fica atrás de proxy
  app.disable("x-powered-by");

  app.use(cabecalhosSeguranca);
  app.use(cookieParser());
  // Parser antes das rotas (lição do MecProAI: registrado depois, req.body fica undefined)
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", banco: tipoBanco }));

  app.use("/api/auth", googleRouter);
  app.use("/api/auth", linkRouter);
  app.use("/api/cron", cronRouter);
  app.use(seoRouter);

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
    console.error("[erro]", err);
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
  server.listen(ENV.port, () => console.log(`[rrf] rodando em http://localhost:${ENV.port} (${tipoBanco})`));
}

if (!ENV.isTest) {
  iniciar().catch((e) => {
    console.error("[FATAL] falha ao iniciar:", e);
    process.exit(1);
  });
  process.on("unhandledRejection", (r) => console.error("[unhandledRejection]", r));
}
