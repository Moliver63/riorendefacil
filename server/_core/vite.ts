/**
 * Servidor único (padrão Caro): em desenvolvimento o Vite roda como middleware
 * do Express; em produção o Express serve o build estático. Um só processo,
 * uma só porta, sem proxy.
 */
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { htmlComMeta } from "../routes/seo";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ehNavegacao = (url: string) =>
  !url.startsWith("/api/") && !url.startsWith("/@") && !url.startsWith("/node_modules/") && !/\.[a-z0-9]+(\?|$)/i.test(url);

export async function setupVite(app: Express, server: Server) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.join(raiz, "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (!ehNavegacao(req.originalUrl)) return next();
    try {
      const template = await fs.promises.readFile(path.join(raiz, "client/index.html"), "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, htmlComMeta(template, req.originalUrl));
      res.status(200).type("html").end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const dist = path.join(raiz, "dist/public");
  const indexPath = path.join(dist, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`[static] build não encontrado em ${dist}. Rode "npm run build".`);
  }
  const template = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf-8") : "<!doctype html><title>build ausente</title>";

  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || !ehNavegacao(req.originalUrl)) return next();
    res.status(200).type("html").set("Cache-Control", "no-cache").end(htmlComMeta(template, req.originalUrl));
  });
}
