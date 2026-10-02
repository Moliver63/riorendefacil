import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";
import type { AppRouter } from "../../../server/_core/router";

export const trpc = createTRPCReact<AppRouter>();
export type Saidas = inferRouterOutputs<AppRouter>;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Não insiste em erros 4xx: validação, sem permissão, não encontrado
      retry: (falhas, erro) => {
        const status = (erro as { data?: { httpStatus?: number } })?.data?.httpStatus;
        if (status && status >= 400 && status < 500) return false;
        return falhas < 2;
      },
    },
  },
});

// Mesma origem em dev e produção: o Vite roda como middleware do Express.
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(url, options) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        return fetch(url, { ...options, credentials: "include", signal: options?.signal ?? controller.signal }).finally(() =>
          clearTimeout(timer),
        );
      },
    }),
  ],
});
