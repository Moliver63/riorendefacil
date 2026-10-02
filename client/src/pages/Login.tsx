import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Marca } from "@/components/landing/SiteLayout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { inicioDoPapel, useAuth } from "@/hooks/useAuth";

const ERROS: Record<string, string> = {
  link_expirado: "Esse link já foi usado ou expirou. Peça um novo.",
  link_invalido: "Link inválido. Peça um novo.",
  link_falhou: "Não conseguimos concluir o acesso. Tente de novo.",
  estado_invalido: "A tentativa de login expirou. Clique em Continuar com Google de novo.",
  google_indisponivel: "Entrar com Google ainda não está disponível. Use seu e-mail.",
  google_falhou: "Não conseguimos falar com o Google. Tente de novo ou use seu e-mail.",
  google_expirado: "O retorno do Google expirou. Clique em Continuar com Google de novo.",
  google_cancelado: "Login com Google cancelado.",
  email_nao_verificado: "Seu e-mail do Google não está verificado. Use o acesso por e-mail.",
  conta_inativa: "Esta conta está desativada. Fale com a equipe.",
};

/** Logo oficial do Google ("G" em quatro cores), conforme as diretrizes de marca do botão. */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const erro = params.get("erro");
  const voltar = params.get("voltar");
  const [, navegar] = useLocation();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const metodos = trpc.auth.metodos.useQuery();
  const pedir = trpc.auth.pedirLink.useMutation();

  // Já logado: não mostra a tela de entrada
  useEffect(() => {
    if (user) navegar(voltar && voltar.startsWith("/") && !voltar.startsWith("//") ? voltar : inicioDoPapel(user.papel), { replace: true });
  }, [user, voltar, navegar]);

  const google = metodos.data?.google ?? false;
  const hrefGoogle = voltar ? `/api/auth/google?voltar=${encodeURIComponent(voltar)}` : "/api/auth/google";
  // Sem Google configurado, o e-mail vira o único método e aparece aberto
  const emailAberto = mostrarEmail || (metodos.isSuccess && !google) || erro?.startsWith("link_");

  if (pedir.isSuccess) {
    return (
      <div className="entrar">
        <Seo titulo="Entrar" indexar={false} />
        <div className="entrar__caixa" role="status">
          <Marca />
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
      </div>
    );
  }

  return (
    <div className="entrar">
      <Seo titulo="Entrar" indexar={false} />
      <div className="entrar__caixa">
        <Marca />
        <h1>Entrar ou criar acesso</h1>
        <p className="entrar__sub">Sem senha. Na primeira vez, sua conta é criada automaticamente.</p>
        {erro && ERROS[erro] && <p className="aviso aviso--erro">{ERROS[erro]}</p>}

        {google && (
          <a className="btn-google" href={hrefGoogle}>
            <LogoGoogle />
            <span>Continuar com Google</span>
          </a>
        )}

        {google && !emailAberto && (
          <button type="button" className="entrar__alternativa" onClick={() => setMostrarEmail(true)}>
            Prefiro receber um link no e-mail
          </button>
        )}

        {emailAberto && (
          <>
            {google && (
              <div className="entrar__ou">
                <span>ou pelo e-mail</span>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pedir.mutate({ email });
              }}
            >
              <label className="campo-form">
                E-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus={mostrarEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </label>
              {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
              <button className={`btn btn--largo ${google ? "btn--ghost" : "btn--primario"}`} disabled={pedir.isPending}>
                {pedir.isPending ? "Enviando…" : "Receber link de acesso"}
              </button>
            </form>
          </>
        )}

        <p className="entrar__rodape">
          Ao entrar você concorda com o uso dos seus dados para acesso à plataforma. <Link href="/">Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}
