import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/trpc";
import { Marca } from "./Layout";

type Item = { href: string; rotulo: string; papeis?: string[] };

const MENU_INVESTIDOR: Item[] = [
  { href: "/painel", rotulo: "Carteira" },
  { href: "/trilha", rotulo: "Trilha" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/perfil", rotulo: "Perfil" },
];

const MENU_ADMIN: Item[] = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/leads", rotulo: "Leads" },
  { href: "/admin/comunicacao", rotulo: "Comunicação" },
  { href: "/admin/ofertas", rotulo: "Ofertas e lastro", papeis: ["admin"] },
  { href: "/admin/usuarios", rotulo: "Usuários", papeis: ["admin"] },
  { href: "/admin/auditoria", rotulo: "Auditoria", papeis: ["admin"] },
];

/** Moldura da área logada (investidor e equipe). */
export function AreaLogada({ titulo, subtitulo, acoes, children }: { titulo: string; subtitulo?: string; acoes?: React.ReactNode; children: React.ReactNode }) {
  const { data: eu } = trpc.auth.eu.useQuery();
  const [loc, navegar] = useLocation();
  const qc = useQueryClient();
  const sair = trpc.auth.sair.useMutation({
    onSuccess: () => {
      qc.clear();
      navegar("/");
    },
  });

  const menu = (eu?.papel === "investidor" ? MENU_INVESTIDOR : MENU_ADMIN).filter((i) => !i.papeis || (eu && i.papeis.includes(eu.papel)));

  return (
    <div className="app">
      <header className="app__topo">
        <Marca />
        <nav className="app__nav" aria-label="Área logada">
          {menu.map((i) => (
            <Link key={i.href} href={i.href} className={loc === i.href ? "ativo" : ""} aria-current={loc === i.href ? "page" : undefined}>
              {i.rotulo}
            </Link>
          ))}
        </nav>
        <div className="app__conta">
          <span className="app__email" title={eu?.email}>
            {eu?.nome ?? eu?.email}
          </span>
          <button className="btn btn--ghost btn--peq" onClick={() => sair.mutate()} disabled={sair.isPending}>
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
        {children}
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
