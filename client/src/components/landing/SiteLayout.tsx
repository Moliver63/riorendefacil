import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { inicioDoPapel, useAuth } from "@/hooks/useAuth";
import { AVISO_RISCO } from "~shared/complianceGuard";

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className={`marca ${claro ? "marca--claro" : ""}`} aria-label="RioRendeFácil, início">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="currentColor" opacity="0.12" />
        <path d="M4 17c3-3 6-3 9 0s6 3 11-2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M4 11c3-3 6-3 9 0s6 3 11-2" stroke="var(--cobre)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
      <span>
        RioRende<em>Fácil</em>
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
          <span className="selo__rot">Emissor das CCBs</span>
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
            O RioRendeFácil é uma plataforma de tecnologia. Não é banco, corretora nem emissor. As CCBs são emitidas e
            custodiadas pelo emissor parceiro, e os recursos transitam apenas por conta vinculada em nome dele.
          </p>
        </div>
        <nav className="rodape__links" aria-label="Rodapé">
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
