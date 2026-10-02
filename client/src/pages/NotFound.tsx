import { Link } from "wouter";
import { PaginaPublica } from "@/components/landing/SiteLayout";
import { Seo } from "@/components/SEO";

export default function NaoEncontrado() {
  return (
    <PaginaPublica>
      <Seo titulo="Página não encontrada" indexar={false} />
      <section className="secao">
        <div className="secao__in secao__in--estreito">
          <p className="sobretitulo">Erro 404</p>
          <h1 className="titulo-pagina">Essa página não existe</h1>
          <p style={{ margin: "16px 0 28px", color: "var(--suave)" }}>O link pode estar errado ou a página mudou de lugar.</p>
          <Link href="/" className="btn btn--primario">Voltar ao início</Link>
        </div>
      </section>
    </PaginaPublica>
  );
}
