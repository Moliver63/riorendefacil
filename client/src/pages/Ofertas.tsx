import { Link } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { PaginaPublica } from "@/components/landing/SiteLayout";
import { Seo } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CardOferta } from "@/components/oferta/Ficha";

/** Moldura certa para quem está logado como investidor ou visitando. */
export function MolduraOferta({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.papel === "investidor") return <AreaLogada titulo={titulo} subtitulo={subtitulo}>{children}</AreaLogada>;
  return (
    <PaginaPublica>
      <div className="pagina-oferta">
        <header className="app__cab">
          <div>
            <h1 className="app__tit">{titulo}</h1>
            {subtitulo && <p className="app__sub">{subtitulo}</p>}
          </div>
        </header>
        {children}
      </div>
    </PaginaPublica>
  );
}

export default function Ofertas() {
  const ofertas = trpc.plataforma.ofertas.useQuery();
  const exemplo = ofertas.data?.every((f) => f.exemplo);
  return (
    <MolduraOferta titulo="Ofertas" subtitulo="Renda fixa lastreada em operações reais de soja, milho e sorgo. Cada oferta mostra as operações, as garantias e a conta vinculada.">
      <Seo titulo="Ofertas" descricao="Ofertas de renda fixa lastreadas em operações de grãos, com operações, garantias e cobertura visíveis." />
      {exemplo && (
        <p className="aviso">
          Esta é uma oferta de exemplo para você conhecer o formato. As reservas abrem quando o emissor parceiro estiver habilitado.
        </p>
      )}
      {ofertas.isLoading ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <div className="prateleira">
          {ofertas.data?.map((f) => <CardOferta key={f.id} f={f} />)}
        </div>
      )}
      <p className="bloco__nota" style={{ marginTop: 24 }}>
        Rentabilidade contratada não é garantia de retorno. Não há cobertura do FGC. Antes de reservar, leia os riscos na ficha e as{" "}
        <Link href="/trilha">leituras Antes de investir</Link>.
      </p>
    </MolduraOferta>
  );
}
