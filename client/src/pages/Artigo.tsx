import { Link } from "wouter";
import { PaginaPublica } from "@/components/landing/SiteLayout";
import { Seo, jsonLdSeguro } from "@/components/SEO";
import { ARTIGOS, artigoPorSlug } from "~shared/conteudo";
import NaoEncontrado from "@/pages/NotFound";

export default function Artigo({ params }: { params: { slug: string } }) {
  const a = artigoPorSlug(params.slug);
  if (!a) return <NaoEncontrado />;
  const outros = ARTIGOS.filter((x) => x.slug !== a.slug).slice(0, 2);
  const data = new Date(a.publicadoEm + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <PaginaPublica>
      <Seo titulo={a.titulo} descricao={a.resumo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.titulo,
            description: a.resumo,
            datePublished: a.publicadoEm,
            publisher: { "@type": "Organization", name: "RioRendeFácil" },
          }),
        }}
      />
      <article className="artigo">
        <Link href="/conteudo" className="artigo__voltar">← Conteúdo</Link>
        <h1>{a.titulo}</h1>
        <p className="artigo__meta">
          {data} · {a.minutos} min de leitura
        </p>
        <p className="artigo__resumo">{a.resumo}</p>
        {a.secoes.map((s, i) => (
          <section key={i}>
            {s.titulo && <h2>{s.titulo}</h2>}
            {s.paragrafos.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
        <aside className="artigo__cta">
          <strong>Quer entender a estrutura com calma?</strong>
          <p>Veja as ofertas abertas, com operações, garantias e riscos. Para reservar, basta o cadastro.</p>
          <Link href="/ofertas" className="btn btn--primario">Ver ofertas</Link>
        </aside>
        {outros.length > 0 && (
          <div className="artigo__outros">
            <span className="sobretitulo">Leia também</span>
            {outros.map((o) => (
              <Link key={o.slug} href={`/conteudo/${o.slug}`}>{o.titulo}</Link>
            ))}
          </div>
        )}
      </article>
    </PaginaPublica>
  );
}
