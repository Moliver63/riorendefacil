/**
 * SEO no servidor: sitemap, robots e meta tags injetadas no HTML para bots
 * que não executam JavaScript (WhatsApp, Facebook, LinkedIn). Padrão Caro.
 */
import { Router } from "express";
import { ARTIGOS, artigoPorSlug } from "../../shared/conteudo";
import { ENV } from "./env";

const PAGINAS = [
  { caminho: "/", prioridade: "1.0", frequencia: "weekly" },
  { caminho: "/conteudo", prioridade: "0.8", frequencia: "weekly" },
  { caminho: "/entrar", prioridade: "0.3", frequencia: "monthly" },
];

export const seoRouter = Router();

seoRouter.get("/sitemap.xml", (_req, res) => {
  const urls = [
    ...PAGINAS.map((p) => `<url><loc>${ENV.appUrl}${p.caminho}</loc><changefreq>${p.frequencia}</changefreq><priority>${p.prioridade}</priority></url>`),
    ...ARTIGOS.map(
      (a) => `<url><loc>${ENV.appUrl}/conteudo/${a.slug}</loc><lastmod>${a.publicadoEm}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
    ),
  ];
  res
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
});

seoRouter.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /painel",
      "Disallow: /trilha",
      "Disallow: /api/",
      `Sitemap: ${ENV.appUrl}/sitemap.xml`,
    ].join("\n"),
  );
});

type Meta = { titulo: string; descricao: string; indexar: boolean };

const PADRAO: Meta = {
  titulo: "RioRendeFácil · Renda fixa com lastro que você enxerga",
  descricao:
    "Tecnologia para investir em crédito privado com lastro real: cada CCB do pool visível, rentabilidade mostrada já líquida de IR e riscos explicados antes de qualquer aporte.",
  indexar: true,
};

export function metaParaUrl(url: string): Meta {
  const caminho = url.split("?")[0] ?? "/";
  const artigo = caminho.match(/^\/conteudo\/([a-z0-9-]+)$/);
  if (artigo) {
    const a = artigoPorSlug(artigo[1]!);
    if (a) return { titulo: `${a.titulo} · RioRendeFácil`, descricao: a.resumo, indexar: true };
  }
  if (caminho === "/conteudo") {
    return { titulo: "Conteúdo · RioRendeFácil", descricao: "Crédito privado explicado sem jargão: CCB, garantias, LTV, FGC e conta vinculada.", indexar: true };
  }
  if (/^\/(admin|painel|trilha|perfil)/.test(caminho)) return { ...PADRAO, indexar: false };
  return PADRAO;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Substitui título e meta tags do index.html conforme a URL. */
export function htmlComMeta(template: string, url: string): string {
  const m = metaParaUrl(url);
  const canonical = `${ENV.appUrl}${url.split("?")[0]}`;
  const tags = [
    `<title>${esc(m.titulo)}</title>`,
    `<meta name="description" content="${esc(m.descricao)}" />`,
    `<meta name="robots" content="${m.indexar ? "index, follow" : "noindex, nofollow"}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(m.titulo)}" />`,
    `<meta property="og:description" content="${esc(m.descricao)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${ENV.appUrl}/og.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ");
  return template.replace(/<!--meta-->[\s\S]*?<!--\/meta-->/, `<!--meta-->\n    ${tags}\n    <!--/meta-->`);
}
