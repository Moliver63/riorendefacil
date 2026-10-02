import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AreaLogada } from "../../components/AreaLogada";
import { trpc } from "../../lib/trpc";
import { Seo } from "../../lib/seo";
import { rastrear } from "../../lib/analytics";

export default function Modulo({ slug }: { slug: string }) {
  const utils = trpc.useUtils();
  const [, navegar] = useLocation();
  const mod = trpc.trilha.modulo.useQuery({ slug });
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const responder = trpc.trilha.responder.useMutation({
    onSuccess: (r) => {
      void utils.trilha.estado.invalidate();
      void utils.investidor.perfil.invalidate();
      if (r.trilhaCompleta) rastrear("trilha_concluida");
    },
  });

  if (mod.error) {
    return (
      <AreaLogada titulo="Módulo indisponível">
        <p className="aviso aviso--erro">{mod.error.message}</p>
        <Link href="/trilha" className="btn btn--ghost">Voltar à trilha</Link>
      </AreaLogada>
    );
  }
  if (!mod.data) return <AreaLogada titulo="Carregando…"><p className="carregando">Carregando…</p></AreaLogada>;

  const m = mod.data;
  const r = responder.data;
  const gab = new Map(r?.gabarito.map((g) => [g.id, g]));
  const todas = m.perguntas.every((p) => respostas[p.id] !== undefined);

  return (
    <AreaLogada titulo={m.titulo} subtitulo={`${m.minutos} minutos de leitura`}>
      <Seo titulo={m.titulo} indexar={false} />
      <article className="licao">
        {m.paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <section className="bloco">
        <div className="bloco__cab">
          <h2>Confira o que ficou</h2>
          <span className="bloco__det">Acerte 2 de 3 para concluir</span>
        </div>
        <form
          className="quiz"
          onSubmit={(e) => {
            e.preventDefault();
            responder.mutate({ slug, respostas });
          }}
        >
          {m.perguntas.map((p, n) => {
            const g = gab.get(p.id);
            return (
              <fieldset key={p.id} className={g ? (g.acertou ? "certo" : "errado") : ""} disabled={Boolean(r?.aprovado)}>
                <legend>
                  {n + 1}. {p.enunciado}
                </legend>
                {p.opcoes.map((o, i) => (
                  <label key={i} className={g && i === g.correta && r?.aprovado ? "gabarito" : ""}>
                    <input
                      type="radio"
                      name={p.id}
                      checked={respostas[p.id] === i}
                      onChange={() => {
                        setRespostas((s) => ({ ...s, [p.id]: i }));
                        if (r && !r.aprovado) responder.reset();
                      }}
                    />
                    {o}
                  </label>
                ))}
                {g && (r?.aprovado || !g.acertou) && <p className="quiz__exp">{g.explicacao}</p>}
              </fieldset>
            );
          })}

          {r && !r.aprovado && (
            <p className="aviso aviso--erro">
              Você acertou {r.acertos} de {r.total}. Releia o texto e tente de novo.
            </p>
          )}
          {r?.aprovado ? (
            <div className="aviso aviso--ok">
              {r.trilhaCompleta ? "Trilha concluída. Próximo passo: questionário de perfil." : `Módulo concluído com ${r.acertos} de ${r.total}.`}
              <button type="button" className="btn btn--primario btn--peq" onClick={() => navegar(r.trilhaCompleta ? "/perfil" : "/trilha")}>
                {r.trilhaCompleta ? "Ir para o perfil" : "Próximo módulo"}
              </button>
            </div>
          ) : (
            <button className="btn btn--primario" disabled={!todas || responder.isPending}>
              {responder.isPending ? "Corrigindo…" : "Enviar respostas"}
            </button>
          )}
        </form>
      </section>
    </AreaLogada>
  );
}
