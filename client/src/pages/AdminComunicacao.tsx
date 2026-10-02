import { useState } from "react";
import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

const CANAIS = [
  ["meta_ads", "Anúncio Meta"],
  ["landing", "Site"],
  ["email", "E-mail"],
  ["whatsapp", "WhatsApp"],
  ["outro", "Outro"],
] as const;

export default function AdminComunicacao() {
  const utils = trpc.useUtils();
  const [texto, setTexto] = useState("");
  const [canal, setCanal] = useState<(typeof CANAIS)[number][0]>("meta_ads");
  const av = trpc.admin.comunicacao.avaliar.useMutation();
  const salvar = trpc.admin.comunicacao.salvar.useMutation({ onSuccess: () => utils.admin.comunicacao.listar.invalidate() });
  const lista = trpc.admin.comunicacao.listar.useQuery();

  return (
    <AreaLogada titulo="Comunicação" subtitulo="Toda peça passa pelo revisor antes de ir ao ar. O revisor não substitui o jurídico.">
      <Seo titulo="Comunicação" indexar={false} />
      <section className="bloco">
        <div className="linha-form">
          <select value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)} aria-label="Canal">
            {CANAIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <textarea className="area" rows={6} value={texto} onChange={(e) => { setTexto(e.target.value); av.reset(); }} placeholder="Cole aqui o texto do anúncio, post, e-mail ou mensagem" />
        <div className="linha-form">
          <button className="btn btn--ghost btn--peq" onClick={() => av.mutate({ texto })} disabled={!texto.trim() || av.isPending}>Revisar</button>
          <button className="btn btn--primario btn--peq" onClick={() => salvar.mutate({ canal, texto })} disabled={!av.data?.aprovado || salvar.isPending}>
            Salvar peça aprovada
          </button>
          {salvar.isSuccess && <span className="ok-inline">Salva</span>}
        </div>

        {av.data && (
          <div className={`veredito ${av.data.aprovado ? "veredito--ok" : "veredito--bloq"}`}>
            <strong>{av.data.aprovado ? "Pode seguir para revisão jurídica" : "Bloqueado"}</strong>
            {av.data.achados.length === 0 && <p>Nenhum termo problemático encontrado.</p>}
            <ul>
              {av.data.achados.map((a) => (
                <li key={a.regra}>
                  <span className={`status ${a.severidade === "bloqueia" ? "status--atraso" : "status--alerta"}`}>{a.severidade}</span> <q>{a.trecho}</q>: {a.motivo}
                </li>
              ))}
            </ul>
            {av.data.avisosObrigatorios.map((a) => <p key={a} className="veredito__aviso">Incluir aviso: {a}</p>)}
          </div>
        )}
      </section>

      {lista.data?.length ? (
        <section className="bloco">
          <h2>Peças salvas</h2>
          <ul className="pecas">
            {lista.data.map((p) => (
              <li key={p.id}>
                <span className="etiqueta">{CANAIS.find(([v]) => v === p.canal)?.[1] ?? p.canal}</span>
                <p>{p.texto}</p>
                <span className="sub">{new Date(p.criadoEm).toLocaleString("pt-BR")}{p.aprovadoJuridicoPor ? ` · jurídico: ${p.aprovadoJuridicoPor}` : " · aguardando jurídico"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AreaLogada>
  );
}
