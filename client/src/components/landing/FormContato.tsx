import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { rastrear } from "@/lib/analytics";

export type SimulacaoLead = { aporte: number; prazo: number; saldoLiquido: number };

export function FormContato({ simulacao }: { simulacao?: SimulacaoLead }) {
  const criar = trpc.leads.criar.useMutation({ onSuccess: () => rastrear("lead") });
  const [consent, setConsent] = useState(false);

  if (criar.isSuccess) {
    return (
      <div className="form form--ok" role="status">
        <h3>Recebemos seu contato</h3>
        <p>
          Um especialista vai falar com você para entender seu momento e explicar a estrutura. Nenhum aporte acontece
          antes de você ler o contrato e os riscos com calma.
        </p>
        <p>
          Enquanto isso, <Link href="/entrar">crie seu acesso</Link> e faça a trilha "Antes de investir". São poucos minutos.
        </p>
      </div>
    );
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const utm = Object.fromEntries(new URLSearchParams(window.location.search));
        criar.mutate({
          nome: String(f.get("nome") ?? ""),
          email: String(f.get("email") ?? ""),
          telefone: String(f.get("telefone") ?? "").replace(/\D/g, ""),
          faixaPatrimonio: String(f.get("faixa") ?? "") || undefined,
          consentimento: true,
          utm,
          simulacao,
        });
      }}
    >
      <div className="form__grade">
        <label>
          Nome completo
          <input name="nome" required minLength={3} autoComplete="name" />
        </label>
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          WhatsApp
          <input name="telefone" type="tel" required minLength={10} autoComplete="tel" placeholder="(47) 99999-9999" />
        </label>
        <label>
          Quanto pensa em alocar
          <select name="faixa" defaultValue="">
            <option value="">Prefiro conversar antes</option>
            <option>Até R$ 50 mil</option>
            <option>R$ 50 mil a R$ 250 mil</option>
            <option>R$ 250 mil a R$ 1 mi</option>
            <option>Acima de R$ 1 mi</option>
          </select>
        </label>
      </div>
      <label className="form__check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>
          Autorizo o uso dos meus dados para contato sobre a plataforma, conforme a Política de Privacidade. Entendo que o
          contato não é oferta de investimento.
        </span>
      </label>
      {criar.error && <p className="form__erro">{criar.error.message}</p>}
      <button className="btn btn--primario btn--largo" disabled={!consent || criar.isPending}>
        {criar.isPending ? "Enviando…" : "Falar com especialista"}
      </button>
    </form>
  );
}
