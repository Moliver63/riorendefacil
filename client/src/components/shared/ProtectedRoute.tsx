import { Redirect } from "wouter";
import type { Papel } from "~shared/const";
import { inicioDoPapel, useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** papéis que podem ver a página; vazio = qualquer usuário logado */
  roles?: Papel[];
}

/**
 * Guarda de rota (formato do MecProAI). É só navegação: toda procedure do
 * servidor valida o papel de novo.
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="carregando-tela">Carregando…</div>;
  if (!user) return <Redirect to={`/entrar?voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`} />;
  if (roles?.length && !roles.includes(user.papel)) return <Redirect to={inicioDoPapel(user.papel)} />;
  return <>{children}</>;
}
