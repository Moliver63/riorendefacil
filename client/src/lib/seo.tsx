import { useEffect } from "react";

/**
 * Atualiza título e meta tags em navegação SPA (padrão Caro). O servidor já
 * injeta as tags certas no primeiro carregamento para os robôs.
 */
export function Seo({ titulo, descricao, indexar = true }: { titulo: string; descricao?: string; indexar?: boolean }) {
  useEffect(() => {
    document.title = titulo.includes("RioRendeFácil") ? titulo : `${titulo} · RioRendeFácil`;
    const meta = (nome: string, valor: string) => {
      let tag = document.querySelector(`meta[name="${nome}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", nome);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", valor);
    };
    if (descricao) meta("description", descricao);
    meta("robots", indexar ? "index, follow" : "noindex, nofollow");
  }, [titulo, descricao, indexar]);
  return null;
}

/** JSON-LD com escape de "<" (proteção da Caro contra quebra de script). */
export function jsonLdSeguro(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}
