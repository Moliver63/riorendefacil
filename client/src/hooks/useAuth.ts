import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Papel } from "~shared/const";

export type UsuarioSessao = { id: number; email: string; nome: string | null; papel: Papel };

export const CHAVE_AUTH = ["auth", "me"] as const;

/** Sessão atual via REST /api/auth/me (mesmo formato do MecProAI). */
export function useAuth() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: CHAVE_AUTH,
    queryFn: async (): Promise<UsuarioSessao | null> => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) return null;
        return (await res.json()) as UsuarioSessao | null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    qc.clear();
    qc.setQueryData(CHAVE_AUTH, null);
  }

  const user = data ?? null;
  return { user, isLoading, isAuthenticated: Boolean(user), logout };
}

/** Para onde mandar o usuário depois do login, conforme o papel. */
export const inicioDoPapel = (papel: Papel) => (papel === "investidor" ? "/painel" : "/admin");
