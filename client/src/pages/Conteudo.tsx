import { Link } from "wouter";
import { PaginaPublica } from "@/components/landing/SiteLayout";
import { Seo } from "@/components/SEO";
import { ARTIGOS } from "~shared/conteudo";

export default function Conteudo() {
  return (
    <PaginaPublica>
      <Seo titulo="Conteúdo" descricao="Crédito privado explicado sem jargão: CCB, garantias, LTV, FGC e conta vinculada." />
      <section className="secao">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Conteúdo</p>
            <h1 className="titulo-pagina">Crédito privado sem jargão</h1>
            <p>Textos curtos para entender a estrutura antes de decidir. Nenhum deles é recomendação de investimento.</p>
          </header>
          <div className="cards-artigos">
            {ARTIGOS.map((a) => (
              <Link key={a.slug} href={`/conteudo/${a.slug}`} className="card-artigo">
                <span className="card-artigo__min">{a.minutos} min de leitura</span>
                <h2>{a.titulo}</h2>
                <p>{a.resumo}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PaginaPublica>
  );
}
