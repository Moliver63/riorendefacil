import React from "react";

interface State {
  hasError: boolean;
}

/**
 * Captura erro de renderização, mostra uma tela amigável e avisa o servidor
 * (best effort) para o erro aparecer nos logs do Render. Padrão do MecProAI.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode; context?: string }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message);
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: error.message.slice(0, 500),
        pilha: (info.componentStack ?? "").slice(0, 1500),
        contexto: this.props.context ?? null,
        url: window.location.pathname,
      }),
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="erro-tela" role="alert">
        <strong>Algo deu errado nesta tela</strong>
        <p>O erro já foi registrado. Recarregue a página para tentar de novo.</p>
        <button className="btn btn--primario" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}
