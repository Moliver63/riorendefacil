import { useState } from "react";
import { Link } from "wouter";
import { Marca } from "../components/Layout";
import { trpc } from "../lib/trpc";
import { Seo } from "../lib/seo";

const ERROS: Record<string, string> = {
  link_expirado: "Esse link já foi usado ou expirou. Peça um novo abaixo.",
  link_invalido: "Link inválido. Peça um novo abaixo.",
  link_falhou: "Não conseguimos concluir o acesso. Tente de novo.",
  estado_invalido: "A sessão de login expirou. Tente de novo.",
  google_indisponivel: "Entrar com Google ainda não está disponível. Use seu e-mail.",
  google_falhou: "Não conseguimos falar com o Google. Tente de novo ou use seu e-mail.",
  email_nao_verificado: "Seu e-mail do Google não está verificado. Use o acesso por e-mail.",
  conta_inativa: "Esta conta está desativada. Fale com a equipe.",
};

export default function Entrar() {
  const erro = new URLSearchParams(window.location.search).get("erro");
  const [email, setEmail] = useState("");
  const metodos = trpc.auth.metodos.useQuery();
  const pedir = trpc.auth.pedirLink.useMutation();

  return (
    <div className="entrar">
      <Seo titulo="Entrar" indexar={false} />
      <div className="entrar__caixa">
        <Marca />
        {pedir.isSuccess ? (
          <div role="status">
            <h1>Confira seu e-mail</h1>
            <p>
              Se <strong>{email}</strong> estiver correto, você recebe em instantes um link para entrar. Ele vale por 15
              minutos e só funciona uma vez.
            </p>
            {pedir.data.devLink && (
              <p className="entrar__dev">
                Ambiente de desenvolvimento sem e-mail configurado: <a href={pedir.data.devLink}>entrar por este link</a>.
              </p>
            )}
            <button className="btn btn--ghost" onClick={() => pedir.reset()}>
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <>
            <h1>Entrar ou criar acesso</h1>
            <p className="entrar__sub">Sem senha. Mandamos um link para o seu e-mail.</p>
            {erro && ERROS[erro] && <p className="aviso aviso--erro">{ERROS[erro]}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pedir.mutate({ email });
              }}
            >
              <label className="campo-form">
                E-mail
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
              </label>
              {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
              <button className="btn btn--primario btn--largo" disabled={pedir.isPending}>
                {pedir.isPending ? "Enviando…" : "Receber link de acesso"}
              </button>
            </form>
            {metodos.data?.google && (
              <>
                <div className="entrar__ou">
                  <span>ou</span>
                </div>
                <a className="btn btn--ghost btn--largo" href="/api/auth/google">
                  Continuar com Google
                </a>
              </>
            )}
          </>
        )}
        <p className="entrar__rodape">
          Ao entrar você concorda com o uso dos seus dados para acesso à plataforma. <Link href="/">Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}
