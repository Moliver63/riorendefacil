import { Link } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

/** Módulo da trilha: só leitura, sem questionário. */
export default function Modulo({ slug }: { slug: string }) {
  const mod = trpc.trilha.modulo.useQuery({ slug });
  const perfil = trpc.investidor.perfil.useQuery();

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
  const cadastrado = Boolean(perfil.data?.cadastroCompletoEm);
  return (
    <AreaLogada titulo={m.titulo} subtitulo={`${m.minutos} minutos de leitura`}>
      <Seo titulo={m.titulo} indexar={false} />
      <article className="licao">
        {m.paragrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <nav className="licao__nav" aria-label="Navegação da trilha">
        {m.anterior ? <Link href={`/trilha/${m.anterior}`} className="btn btn--ghost">← Anterior</Link> : <Link href="/trilha" className="btn btn--ghost">← Trilha</Link>}
        {m.proximo ? (
          <Link href={`/trilha/${m.proximo}`} className="btn btn--primario">Próximo</Link>
        ) : cadastrado ? (
          <Link href="/ofertas" className="btn btn--primario">Ver ofertas</Link>
        ) : (
          <Link href="/cadastro" className="btn btn--primario">Fazer meu cadastro</Link>
        )}
      </nav>
    </AreaLogada>
  );
}
