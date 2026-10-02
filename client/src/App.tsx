import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "@/lib/trpc";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import CookieConsent from "@/components/shared/CookieConsent";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

// Pages - Public (no bundle inicial)
import Landing from "@/pages/Landing";
import Conteudo from "@/pages/Conteudo";
import Artigo from "@/pages/Artigo";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Ofertas from "@/pages/Ofertas";
import OfertaDetalhe from "@/pages/OfertaDetalhe";

// Pages - Investidor (carregadas sob demanda)
const Painel = lazy(() => import("@/pages/Painel"));
const Trilha = lazy(() => import("@/pages/Trilha"));
const TrilhaModulo = lazy(() => import("@/pages/TrilhaModulo"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Documentos = lazy(() => import("@/pages/Documentos"));
const Cadastro = lazy(() => import("@/pages/Cadastro"));
const ContratoDocumento = lazy(() => import("@/pages/ContratoDocumento"));

// Pages - Equipe e Admin (carregadas sob demanda)
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminLeads = lazy(() => import("@/pages/AdminLeads"));
const AdminComunicacao = lazy(() => import("@/pages/AdminComunicacao"));
const AdminOfertas = lazy(() => import("@/pages/AdminOfertas"));
const AdminUsuarios = lazy(() => import("@/pages/AdminUsuarios"));
const AdminAuditoria = lazy(() => import("@/pages/AdminAuditoria"));
const AdminInvestidores = lazy(() => import("@/pages/AdminInvestidores"));
const AdminResgates = lazy(() => import("@/pages/AdminResgates"));
const AdminOperacoes = lazy(() => import("@/pages/AdminOperacoes"));

const INVESTIDOR = ["investidor"] as const;
const EQUIPE = ["assessor", "admin"] as const;
const ADMIN = ["admin"] as const;

function RolarAoTopo() {
  const [loc] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [loc]);
  return null;
}

/** Todas as rotas do site. O mapa completo, com as APIs, está em docs/ROTAS.md. */
function Rotas() {
  return (
    <Switch>
      {/* ── Público ── */}
      <Route path="/" component={Landing} />
      <Route path="/conteudo" component={Conteudo} />
      <Route path="/conteudo/:slug" component={Artigo} />
      <Route path="/entrar" component={Login} />
      <Route path="/ofertas" component={Ofertas} />
      <Route path="/ofertas/:id">{(p) => <OfertaDetalhe id={Number(p.id)} />}</Route>

      {/* ── Investidor ── */}
      <Route path="/painel">{() => <ProtectedRoute roles={[...INVESTIDOR]}><Painel /></ProtectedRoute>}</Route>
      <Route path="/trilha">{() => <ProtectedRoute roles={[...INVESTIDOR]}><Trilha /></ProtectedRoute>}</Route>
      <Route path="/trilha/:slug">{(p) => <ProtectedRoute roles={[...INVESTIDOR]}><TrilhaModulo slug={p.slug} /></ProtectedRoute>}</Route>
      <Route path="/perfil">{() => <ProtectedRoute roles={[...INVESTIDOR]}><Perfil /></ProtectedRoute>}</Route>
      <Route path="/documentos">{() => <ProtectedRoute roles={[...INVESTIDOR]}><Documentos /></ProtectedRoute>}</Route>
      <Route path="/cadastro">{() => <ProtectedRoute roles={[...INVESTIDOR]}><Cadastro /></ProtectedRoute>}</Route>
      <Route path="/contrato/:id">{(p) => <ProtectedRoute roles={[...INVESTIDOR]}><ContratoDocumento id={Number(p.id)} /></ProtectedRoute>}</Route>

      {/* ── Equipe (assessor e admin) ── */}
      <Route path="/admin">{() => <ProtectedRoute roles={[...EQUIPE]}><AdminDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/leads">{() => <ProtectedRoute roles={[...EQUIPE]}><AdminLeads /></ProtectedRoute>}</Route>
      <Route path="/admin/comunicacao">{() => <ProtectedRoute roles={[...EQUIPE]}><AdminComunicacao /></ProtectedRoute>}</Route>

      {/* ── Só admin ── */}
      <Route path="/admin/ofertas">{() => <ProtectedRoute roles={[...ADMIN]}><AdminOfertas /></ProtectedRoute>}</Route>
      <Route path="/admin/usuarios">{() => <ProtectedRoute roles={[...ADMIN]}><AdminUsuarios /></ProtectedRoute>}</Route>
      <Route path="/admin/auditoria">{() => <ProtectedRoute roles={[...ADMIN]}><AdminAuditoria /></ProtectedRoute>}</Route>
      <Route path="/admin/investidores">{() => <ProtectedRoute roles={[...ADMIN]}><AdminInvestidores /></ProtectedRoute>}</Route>
      <Route path="/admin/operacoes">{() => <ProtectedRoute roles={[...ADMIN]}><AdminOperacoes /></ProtectedRoute>}</Route>
      <Route path="/admin/resgates">{() => <ProtectedRoute roles={[...ADMIN]}><AdminResgates /></ProtectedRoute>}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary context="app">
          <RolarAoTopo />
          <Suspense fallback={<div className="carregando-tela">Carregando…</div>}>
            <Rotas />
          </Suspense>
          <CookieConsent />
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
