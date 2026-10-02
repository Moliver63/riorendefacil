import { Link } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

export default function Trilha() {
  const { data, isLoading } = trpc.trilha.estado.useQuery();

  return (
    <AreaLogada titulo="Antes de investir" subtitulo="Quatro leituras curtas sobre como o investimento funciona, as garantias e os riscos. Leia na ordem que quiser.">
      <Seo titulo="Trilha" indexar={false} />

      {isLoading ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <ol className="modulos">
          {data!.modulos.map((m, i) => (
            <li key={m.slug} className="aberto">
              <span className="modulos__n num">{i + 1}</span>
              <div className="modulos__txt">
                <strong>{m.titulo}</strong>
                <span>{m.minutos} min de leitura</span>
              </div>
              <Link href={`/trilha/${m.slug}`} className="btn btn--peq btn--ghost">Ler</Link>
            </li>
          ))}
        </ol>
      )}
    </AreaLogada>
  );
}
