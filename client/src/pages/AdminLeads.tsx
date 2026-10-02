import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { STATUS_LEAD, STATUS_LEAD_ROTULO, type StatusLead } from "~shared/const";

type Lead = Saidas["admin"]["leads"]["listar"][number];

const fone = (t: string) => t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");

function LinhaLead({ l }: { l: Lead }) {
  const utils = trpc.useUtils();
  const [notas, setNotas] = useState(l.notas ?? "");
  const [aberto, setAberto] = useState(false);
  const atualizar = trpc.admin.leads.atualizar.useMutation({ onSuccess: () => utils.admin.leads.listar.invalidate() });
  const simulacao = l.simulacao as { aporte?: number; prazo?: number } | null;

  return (
    <>
      <tr>
        <td>
          <strong>{l.nome}</strong>
          <span className="sub">{l.email}</span>
        </td>
        <td>
          <a href={`https://wa.me/55${l.telefone}`} target="_blank" rel="noreferrer">{fone(l.telefone)}</a>
        </td>
        <td>{l.faixaPatrimonio ?? "–"}{simulacao?.aporte ? <span className="sub">simulou R$ {simulacao.aporte.toLocaleString("pt-BR")} / {simulacao.prazo}m</span> : null}</td>
        <td>{new Date(l.criadoEm).toLocaleDateString("pt-BR")}</td>
        <td>
          <select
            value={l.status}
            onChange={(e) => atualizar.mutate({ id: l.id, status: e.target.value as StatusLead })}
            aria-label={`Status de ${l.nome}`}
          >
            {STATUS_LEAD.map((s) => (
              <option key={s} value={s}>{STATUS_LEAD_ROTULO[s]}</option>
            ))}
          </select>
        </td>
        <td className="dir">
          <button className="btn btn--ghost btn--peq" onClick={() => setAberto((a) => !a)}>{aberto ? "Fechar" : "Notas"}</button>
        </td>
      </tr>
      {aberto && (
        <tr className="linha-extra">
          <td colSpan={6}>
            <textarea className="area" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Anotações da conversa" />
            <button className="btn btn--primario btn--peq" onClick={() => atualizar.mutate({ id: l.id, notas })} disabled={atualizar.isPending}>
              Salvar notas
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminLeads() {
  const [filtro, setFiltro] = useState<StatusLead | "">("");
  const { data, isLoading } = trpc.admin.leads.listar.useQuery(filtro ? { status: filtro } : {});

  return (
    <AreaLogada
      titulo="Leads"
      subtitulo="Quem pediu contato pelo site ou pelos anúncios."
      acoes={
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as StatusLead | "")} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {STATUS_LEAD.map((s) => <option key={s} value={s}>{STATUS_LEAD_ROTULO[s]}</option>)}
        </select>
      }
    >
      <Seo titulo="Leads" indexar={false} />
      <section className="bloco">
        {isLoading ? (
          <p className="carregando">Carregando…</p>
        ) : !data?.length ? (
          <Vazio titulo="Nenhum lead por aqui" />
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>WhatsApp</th><th>Faixa</th><th>Chegou em</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {data.map((l) => <LinhaLead key={l.id} l={l} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AreaLogada>
  );
}
