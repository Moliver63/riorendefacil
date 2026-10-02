import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./trpc";
import { Landing } from "./pages/Landing";
import { Investidor } from "./pages/Investidor";
import { Compliance } from "./pages/Compliance";
import "./styles.css";

function App() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  const [client] = useState(() => trpc.createClient({ links: [httpBatchLink({ url: "/trpc" })] }));
  return (
    <trpc.Provider client={client} queryClient={qc}>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/investidor" element={<Investidor />} />
            <Route path="/interno/compliance" element={<Compliance />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
