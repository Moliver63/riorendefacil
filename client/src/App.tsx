import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import Home from "./routes/Home";
import Conteudo from "./routes/Conteudo";
import Artigo from "./routes/Artigo";
import Entrar from "./routes/Entrar";
import NaoEncontrado from "./routes/NaoEncontrado";
import { Protegida } from "./components/Protegida";
import { Consentimento } from "./components/Consentimento";

// Área logada e admin carregados sob demanda (padrão Caro): quem só visita
// o site nunca baixa esse código.
const Painel = lazy(() => import("./routes/investidor/Painel"));
const Trilha = lazy(() => import("./routes/investidor/Trilha"));
const Modulo = lazy(() => import("./routes/investidor/Modulo"));
const Perfil = lazy(() => import("./routes/investidor/Perfil"));
const Documentos = lazy(() => import("./routes/investidor/Documentos"));
const AdminInicio = lazy(() => import("./routes/admin/AdminInicio"));
const AdminLeads = lazy(() => import("./routes/admin/AdminLeads"));
const AdminOfertas = lazy(() => import("./routes/admin/AdminOfertas"));
const AdminComunicacao = lazy(() => import("./routes/admin/AdminComunicacao"));
const AdminUsuarios = lazy(() => import("./routes/admin/AdminUsuarios"));
const AdminAuditoria = lazy(() => import("./routes/admin/AdminAuditoria"));

function Carregando() {
  return <div className="carregando-tela">Carregando…</div>;
}

function RolarAoTopo() {
  const [loc] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [loc]);
  return null;
}

export default function App() {
  return (
    <>
      <RolarAoTopo />
      <Suspense fallback={<Carregando />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/conteudo" component={Conteudo} />
          <Route path="/conteudo/:slug" component={Artigo} />
          <Route path="/entrar" component={Entrar} />

          <Route path="/painel">{() => <Protegida papeis={["investidor"]}><Painel /></Protegida>}</Route>
          <Route path="/trilha">{() => <Protegida papeis={["investidor"]}><Trilha /></Protegida>}</Route>
          <Route path="/trilha/:slug">{(p) => <Protegida papeis={["investidor"]}><Modulo slug={p.slug} /></Protegida>}</Route>
          <Route path="/perfil">{() => <Protegida papeis={["investidor"]}><Perfil /></Protegida>}</Route>
          <Route path="/documentos">{() => <Protegida papeis={["investidor"]}><Documentos /></Protegida>}</Route>

          <Route path="/admin">{() => <Protegida papeis={["assessor", "admin"]}><AdminInicio /></Protegida>}</Route>
          <Route path="/admin/leads">{() => <Protegida papeis={["assessor", "admin"]}><AdminLeads /></Protegida>}</Route>
          <Route path="/admin/comunicacao">{() => <Protegida papeis={["assessor", "admin"]}><AdminComunicacao /></Protegida>}</Route>
          <Route path="/admin/ofertas">{() => <Protegida papeis={["admin"]}><AdminOfertas /></Protegida>}</Route>
          <Route path="/admin/usuarios">{() => <Protegida papeis={["admin"]}><AdminUsuarios /></Protegida>}</Route>
          <Route path="/admin/auditoria">{() => <Protegida papeis={["admin"]}><AdminAuditoria /></Protegida>}</Route>

          <Route component={NaoEncontrado} />
        </Switch>
      </Suspense>
      <Consentimento />
    </>
  );
}
