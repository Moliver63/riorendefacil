import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import App from "./App";
import { trpc } from "./lib/trpc";
import { carregarAnalytics } from "./lib/analytics";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Não insiste em erros 4xx (padrão Caro)
      retry: (falhas, erro) => {
        const status = (erro as { data?: { httpStatus?: number } })?.data?.httpStatus;
        if (status && status >= 400 && status < 500) return false;
        return falhas < 2;
      },
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
    }),
  ],
});

carregarAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
