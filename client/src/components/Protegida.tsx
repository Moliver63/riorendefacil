import { useEffect } from "react";
import { useLocation } from "wouter";
import type { Papel } from "@shared/const";
import { trpc } from "../lib/trpc";

/** Guarda de rota por papel. O servidor também valida: isto é só navegação. */
export function Protegida({ papeis, children }: { papeis: Papel[]; children: React.ReactNode }) {
  const { data: eu, isLoading } = trpc.auth.eu.useQuery();
  const [, navegar] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!eu) navegar(`/entrar?voltar=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    else if (!papeis.includes(eu.papel)) navegar(eu.papel === "investidor" ? "/painel" : "/admin", { replace: true });
  }, [eu, isLoading, papeis, navegar]);

  if (isLoading || !eu || !papeis.includes(eu.papel)) return <div className="carregando-tela">Carregando…</div>;
  return <>{children}</>;
}
