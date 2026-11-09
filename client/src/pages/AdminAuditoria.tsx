import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

const ENTIDADES = [
  { id: "", rotulo: "Tudo" },
  { id: "contrato", rotulo: "Aplicações" },
  { id: "cotacao", rotulo: "Cotações" },
  { id: "ccb", rotulo: "CCBs" },
  { id: "oferta", rotulo: "Ofertas" },
  { id: "resgate", rotulo: "Resgates" },
  { id: "usuario", rotulo: "Usuários" },
];

const curto = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "vazio";
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

/** Mostra o que mudou: "campo: antes → depois" quando a ação registrou o valor anterior. */
function Detalhe({ dados }: { dados: unknown }) {
  if (!dados || typeof dados !== "object" || !Object.keys(dados).length) return <span className="sub">–</span>;
  const d = dados as Record<string, unknown>;
  const pares: [string, { antes: unknown; depois: unknown }][] = [];
  const alt = d.alteracoes as Record<string, { antes: unknown; depois: unknown }> | undefined;
  if (alt && typeof alt === "object") pares.push(...Object.entries(alt));
  for (const [k, v] of Object.entries(d)) {
    if (k !== "alteracoes" && v && typeof v === "object" && "antes" in (v as object) && "depois" in (v as object)) pares.push([k, v as { antes: unknown; depois: unknown }]);
  }
  if (pares.length) {
    return (
      <ul className="audit-mudancas">
        {pares.map(([k, v]) => (
          <li key={k}><span className="mono">{k}</span> <s>{curto(v.antes)}</s> → <strong>{curto(v.depois)}</strong></li>
        ))}
      </ul>
    );
  }
  if (alt && !pares.length) return <span className="sub">sem mudança de valor</span>;
  return <span className="sub mono">{curto(dados)}</span>;
}

export default function AdminAuditoria() {
  const [entidade, setEntidade] = useState("");
  const { data, isLoading } = trpc.admin.auditoria.useQuery({ entidade: entidade || undefined });
  return (
    <AreaLogada titulo="Auditoria" subtitulo="Registro permanente de logins, alterações financeiras e documentos, com responsável, data e valor anterior. Os 200 eventos mais recentes.">
      <Seo titulo="Auditoria" indexar={false} />
      <div className="filtros" role="group" aria-label="Filtrar por tipo">
        {ENTIDADES.map((e) => (
          <button key={e.id} className={`btn btn--peq ${entidade === e.id ? "btn--primario" : "btn--ghost"}`} onClick={() => setEntidade(e.id)}>{e.rotulo}</button>
        ))}
      </div>
      <section className="bloco">
        {isLoading ? (
          <p className="carregando">Carregando…</p>
        ) : !data?.length ? (
          <Vazio titulo="Nenhum evento registrado" />
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>O que mudou</th><th>Responsável</th><th>IP</th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{new Date(a.criadoEm).toLocaleString("pt-BR")}</td>
                    <td className="mono">{a.acao}</td>
                    <td>{a.entidade}{a.entidadeId ? ` #${a.entidadeId}` : ""}</td>
                    <td><Detalhe dados={a.dados} /></td>
                    <td>{a.atorEmail ?? (a.atorId ? `#${a.atorId}` : "sistema")}</td>
                    <td className="mono">{a.ip ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AreaLogada>
  );
}
