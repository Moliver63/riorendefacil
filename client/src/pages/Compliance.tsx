import { useState } from "react";
import { Marca } from "../components/Layout";
import { trpc } from "../trpc";

const EXEMPLO =
  "Invista com o RioRendeFácil: rendimento garantido de 1,5% ao mês, sem risco e bem melhor que a poupança. Últimas vagas!";

/** Ferramenta interna: valida peças de anúncio e copy antes de publicar. */
export function Compliance() {
  const [texto, setTexto] = useState(EXEMPLO);
  const av = trpc.compliance.avaliar.useMutation();

  return (
    <div className="app">
      <header className="app__topo">
        <Marca />
        <span className="etiqueta">Uso interno</span>
      </header>
      <main className="app__in app__in--estreito">
        <h1 className="app__tit">Revisor de comunicação</h1>
        <p className="app__sub">
          Cole anúncio, post, e-mail ou mensagem de WhatsApp. O revisor aponta promessas proibidas e avisos obrigatórios.
          Não substitui o jurídico.
        </p>
        <textarea className="area" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn btn--primario" onClick={() => av.mutate({ texto })} disabled={av.isPending || !texto.trim()}>
          Revisar texto
        </button>

        {av.data && (
          <div className={`veredito ${av.data.aprovado ? "veredito--ok" : "veredito--bloq"}`}>
            <strong>{av.data.aprovado ? "Pode seguir para revisão jurídica" : "Bloqueado"}</strong>
            {av.data.achados.length === 0 && <p>Nenhum termo problemático encontrado.</p>}
            <ul>
              {av.data.achados.map((a) => (
                <li key={a.regra}>
                  <span className={`status ${a.severidade === "bloqueia" ? "status--atraso" : "status--alerta"}`}>
                    {a.severidade === "bloqueia" ? "bloqueia" : "alerta"}
                  </span>{" "}
                  <q>{a.trecho}</q>: {a.motivo}
                </li>
              ))}
            </ul>
            {av.data.avisosObrigatorios.map((a) => (
              <p key={a} className="veredito__aviso">
                Incluir aviso: {a}
              </p>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
