import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { Marca } from "@/components/landing/SiteLayout";

type Item = { href: string; rotulo: string; papeis?: string[] };

const MENU_INVESTIDOR: Item[] = [
  { href: "/painel", rotulo: "Carteira" },
  { href: "/ofertas", rotulo: "Investir" },
  { href: "/trilha", rotulo: "Trilha" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/perfil", rotulo: "Perfil" },
];

const MENU_ADMIN: Item[] = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/leads", rotulo: "Leads" },
  { href: "/admin/comunicacao", rotulo: "Comunicação" },
  { href: "/admin/investidores", rotulo: "Investidores", papeis: ["admin"] },
  { href: "/admin/operacoes", rotulo: "Operações", papeis: ["admin"] },
  { href: "/admin/movimentacoes", rotulo: "Movimentações", papeis: ["admin"] },
  { href: "/admin/ofertas", rotulo: "Ofertas e garantias", papeis: ["admin"] },
  { href: "/admin/usuarios", rotulo: "Usuários", papeis: ["admin"] },
  { href: "/admin/auditoria", rotulo: "Auditoria", papeis: ["admin"] },
];

/** Moldura da área logada (investidor e equipe). */
export function AreaLogada({ titulo, subtitulo, acoes, children }: { titulo: string; subtitulo?: string; acoes?: React.ReactNode; children: React.ReactNode }) {
  const { user: eu, logout } = useAuth();
  const [loc, navegar] = useLocation();
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    setSaindo(true);
    await logout();
    navegar("/");
  };

  const menu = (eu?.papel === "investidor" ? MENU_INVESTIDOR : MENU_ADMIN).filter((i) => !i.papeis || (eu && i.papeis.includes(eu.papel)));

  return (
    <div className="app">
      <header className="app__topo">
        <Marca />
        <nav className="app__nav" aria-label="Área logada">
          {menu.map((i) => (
            <Link key={i.href} href={i.href} className={loc === i.href || (i.href !== "/admin" && loc.startsWith(i.href + "/")) ? "ativo" : ""} aria-current={loc === i.href ? "page" : undefined}>
              {i.rotulo}
            </Link>
          ))}
        </nav>
        <div className="app__conta">
          <span className="app__email" title={eu?.email}>
            {eu?.nome ?? eu?.email}
          </span>
          <button className="btn btn--ghost btn--peq" onClick={sair} disabled={saindo}>
            Sair
          </button>
        </div>
      </header>
      <main className="app__in">
        <div className="app__cab">
          <div>
            <h1 className="app__tit">{titulo}</h1>
            {subtitulo && <p className="app__sub">{subtitulo}</p>}
          </div>
          {acoes}
        </div>
        <ErrorBoundary context={titulo}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}
