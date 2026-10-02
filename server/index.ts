import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./router";

const app = express();
app.disable("x-powered-by");

// Parser de JSON registrado ANTES das rotas (lição do MecProAI: registrar
// depois do mount deixa req.body undefined).
app.use(express.json({ limit: "200kb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use("/trpc", createExpressMiddleware({ router: appRouter }));

if (process.env.NODE_ENV === "production") {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dir, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(dir, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`[api] ouvindo em :${port}`));
