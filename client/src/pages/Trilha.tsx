import { Link } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

export default function Trilha() {
  const { data, isLoading } = trpc.trilha.estado.useQuery();
  const feitos = data?.modulos.filter((m) => m.concluido).length ?? 0;
  const total = data?.modulos.length ?? 4;

  return (
    <AreaLogada titulo="Antes de investir" subtitulo="Quatro módulos curtos. Cada um abre quando o anterior é concluído.">
      <Seo titulo="Trilha" indexar={false} />
      <div className="progresso" aria-label={`${feitos} de ${total} módulos concluídos`}>
        <div className="progresso__barra">
          <i style={{ width: `${(feitos / total) * 100}%` }} />
        </div>
        <span className="num">
          {feitos} de {total}
        </span>
      </div>

      {data?.completa && (
        <div className="aviso aviso--ok">
          Trilha concluída. O próximo passo é o <Link href="/perfil">questionário de perfil</Link>.
        </div>
      )}

      {isLoading ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <ol className="modulos">
          {data!.modulos.map((m, i) => (
            <li key={m.slug} className={m.concluido ? "feito" : m.liberado ? "aberto" : "travado"}>
              <span className="modulos__n num">{m.concluido ? "✓" : i + 1}</span>
              <div className="modulos__txt">
                <strong>{m.titulo}</strong>
                <span>
                  {m.minutos} min{m.concluido ? " · concluído" : !m.liberado ? " · conclua o anterior" : ""}
                </span>
              </div>
              {m.liberado ? (
                <Link href={`/trilha/${m.slug}`} className={`btn btn--peq ${m.concluido ? "btn--ghost" : "btn--primario"}`}>
                  {m.concluido ? "Rever" : "Começar"}
                </Link>
              ) : (
                <span className="modulos__cadeado" aria-hidden="true">🔒</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </AreaLogada>
  );
}
