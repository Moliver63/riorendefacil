import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { inicioDoPapel, useAuth } from "@/hooks/useAuth";
import { AVISO_RISCO } from "~shared/complianceGuard";

/** Selo da marca: quadrado marinho com três barras douradas em degrau (rendimento que cresce). */
export function SeloMarca({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="var(--tinta)" />
      <rect x="0.75" y="0.75" width="28.5" height="28.5" rx="7.25" fill="none" stroke="var(--cobre)" strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="8" y="16" width="3.4" height="7" rx="1" fill="var(--cobre)" />
      <rect x="13.3" y="12" width="3.4" height="11" rx="1" fill="var(--cobre)" />
      <rect x="18.6" y="7" width="3.4" height="16" rx="1" fill="var(--cobre)" />
    </svg>
  );
}

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className={`marca ${claro ? "marca--claro" : ""}`} aria-label="CCB Rio Bank, início">
      <SeloMarca />
      <span>
        <span className="marca__ccb">CCB</span>Rio <em>Bank</em>
      </span>
    </Link>
  );
}

export function Topo() {
  const { user: eu } = useAuth();
  const [loc] = useLocation();
  const ancora = (id: string) => (loc === "/" ? `#${id}` : `/#${id}`);
  const destino = eu ? inicioDoPapel(eu.papel) : "/entrar";

  return (
    <header className="topo">
      <div className="topo__in">
        <Marca />
        <nav className="topo__nav" aria-label="Principal">
          <Link href="/ofertas">Ofertas</Link>
          <a href={ancora("como-funciona")}>Como funciona</a>
          <a href={ancora("simulador")}>Simulador</a>
          <a href={ancora("riscos")}>Riscos</a>
          <Link href="/conteudo">Conteúdo</Link>
        </nav>
        <div className="topo__acoes">
          <Link href={destino} className="btn btn--ghost">
            {eu ? "Minha área" : "Entrar"}
          </Link>
          <a href={ancora("contato")} className="btn btn--primario">
            Falar com especialista
          </a>
        </div>
      </div>
    </header>
  );
}

/** Espaço do emissor parceiro: vazio até a autorização formal existir. */
export function SeloEmissor() {
  const { data } = trpc.plataforma.status.useQuery();
  const e = data?.emissor;
  if (e?.autorizado && e.nome) {
    return (
      <div className="selo">
        {e.logoUrl && <img src={e.logoUrl} alt={`Logo ${e.nome}`} height={32} />}
        <div>
          <span className="selo__rot">Emissor da oferta</span>
          <strong>{e.nome}</strong>
          {e.cnpj && <span className="selo__det">CNPJ {e.cnpj}</span>}
          {e.registroCVM && <span className="selo__det">Registro CVM {e.registroCVM}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="selo selo--vazio" role="note">
      <span className="selo__rot">Emissor parceiro</span>
      <strong>Em definição</strong>
      <span className="selo__det">A captação abre só depois do emissor licenciado ser apresentado aqui.</span>
    </div>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape__in">
        <div className="rodape__col">
          <Marca claro />
          <p>
            Apesar do nome, o CCB Rio Bank não é banco, corretora nem emissor: é uma plataforma de tecnologia. A oferta e as garantias
            são estruturadas pelo emissor parceiro, e os recursos transitam apenas por conta vinculada.
          </p>
        </div>
        <nav className="rodape__links" aria-label="Rodapé">
          <Link href="/ofertas">Ofertas</Link>
          <Link href="/conteudo">Conteúdo</Link>
          <Link href="/conteudo/o-que-e-ccb">O que é CCB</Link>
          <Link href="/conteudo/investimento-sem-fgc">Investimento sem FGC</Link>
          <Link href="/entrar">Entrar</Link>
        </nav>
        <SeloEmissor />
      </div>
      <p className="rodape__aviso">
        {AVISO_RISCO} Este site tem caráter informativo e não constitui oferta, recomendação ou solicitação de compra de
        valor mobiliário. Condições, garantias e riscos de cada operação constam dos documentos próprios, apresentados
        individualmente.
      </p>
      <p className="rodape__cred">Desenvolvido por Lab Quântico de Software</p>
    </footer>
  );
}

export function PaginaPublica({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topo />
      <main>{children}</main>
      <Rodape />
    </>
  );
}
