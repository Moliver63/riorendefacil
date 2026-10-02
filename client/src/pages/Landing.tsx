import { useState } from "react";
import { Link } from "wouter";
import { PaginaPublica, SeloEmissor } from "@/components/landing/SiteLayout";
import { Simulador } from "@/components/landing/Simulador";
import { FormContato, type SimulacaoLead } from "@/components/landing/FormContato";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarPct } from "~shared/finance";
import { ARTIGOS } from "~shared/conteudo";

const ETAPAS = [
  { n: "01", t: "O emissor origina o crédito", d: "Empresas do agro e do mercado imobiliário pedem crédito ao emissor licenciado. Só entram operações com garantia real e análise de capacidade de pagamento." },
  { n: "02", t: "Cada crédito vira uma CCB", d: "A Cédula de Crédito Bancário é título executivo: se o devedor não paga, a cobrança judicial é mais rápida. A garantia fica amarrada a ela." },
  { n: "03", t: "O dinheiro fica em conta vinculada", d: "Seu aporte e os pagamentos dos devedores passam por conta de garantia operada por um administrador independente, separada do caixa do emissor e do nosso." },
  { n: "04", t: "Você acompanha tudo aqui", d: "Cada CCB do pool aparece no painel com setor, garantia, LTV e situação de pagamento, inclusive as que atrasam." },
];

const RISCOS = [
  { t: "Risco de crédito", d: "Devedores podem atrasar ou não pagar. As garantias reduzem a perda, mas executar uma garantia leva tempo e pode não cobrir 100% do valor." },
  { t: "Sem FGC", d: "Diferente de CDB e poupança, CCB estruturada não tem cobertura do Fundo Garantidor de Créditos." },
  { t: "Liquidez do principal", d: "O valor aportado fica travado até o vencimento do contrato. Só o rendimento pode ser resgatado antes, e o pagamento depende do fluxo do pool." },
  { t: "Concentração", d: "O pool é diversificado entre devedores, mas concentrado em dois setores. Uma crise no agro ou no imobiliário afeta vários créditos ao mesmo tempo." },
];

const FAQ = [
  { p: "O RioRendeFácil é um banco?", r: "Não. Somos a tecnologia: site, simulador, cadastro, painel e documentos. Quem emite as CCBs, recebe os aportes em conta vinculada e responde pela operação é o emissor parceiro, identificado no rodapé." },
  { p: "Por que vocês mostram o rendimento líquido?", r: "Porque é o que chega na sua conta. Comparar valor bruto com poupança, que é isenta, faz qualquer produto parecer melhor do que é." },
  { p: "Preciso fazer a trilha antes de investir?", r: "Sim. Antes de manifestar interesse em aporte, você passa por quatro módulos curtos sobre CCB, riscos, lastro e imposto, e responde um questionário de perfil. Se o produto não combinar com você, avisamos." },
  { p: "O que acontece se um devedor atrasar?", r: "O atraso aparece no seu painel com o número de dias. O emissor aciona a cobrança e, se necessário, executa a garantia. Atrasos isolados são absorvidos pelo pool, mas reduzem o resultado." },
];

export default function Home() {
  const [sim, setSim] = useState<SimulacaoLead>();
  const status = trpc.plataforma.status.useQuery();
  const lastro = trpc.plataforma.lastro.useQuery();

  return (
    <PaginaPublica>
      <Seo
        titulo="RioRendeFácil · Renda fixa com lastro que você enxerga"
        descricao="Crédito privado com lastro real: cada CCB do pool visível, rentabilidade mostrada já líquida de IR e riscos explicados antes de qualquer aporte."
      />
      <section className="hero">
        <div className="hero__in">
          <div className="hero__texto">
            <p className="sobretitulo">Crédito privado com lastro real</p>
            <h1>
              Renda fixa com lastro <em>que você enxerga.</em>
            </h1>
            <p className="hero__lead">
              Cada crédito do pool aparece no seu painel: quem deve, qual a garantia e se está pagando em dia. O
              rendimento já vem mostrado líquido de IR, e você entende os riscos antes de qualquer número.
            </p>
            <div className="hero__acoes">
              <a href="#simulador" className="btn btn--primario">Simular agora</a>
              <a href="#riscos" className="btn btn--ghost">Ler os riscos primeiro</a>
            </div>
            <SeloEmissor />
          </div>

          <aside className="cartao-pool" aria-label="Composição do pool">
            <div className="cartao-pool__topo">
              <span>Composição do pool</span>
              {lastro.data?.exemplo && <span className="etiqueta">exemplo</span>}
            </div>
            <ul>
              {(lastro.data?.itens ?? []).map((c) => (
                <li key={c.codigo}>
                  <span className={`ponto ponto--${c.setor}`} aria-hidden="true" />
                  <div>
                    <strong>{c.devedor}</strong>
                    <span>{c.garantia}</span>
                  </div>
                  <div className="cartao-pool__dir">
                    <span className="num">LTV {formatarPct(c.ltv, 0)}</span>
                    <span className={`status status--${c.situacao === "adimplente" ? "adimplente" : "atraso"}`}>
                      {c.situacao === "adimplente" ? "Em dia" : `${c.diasAtraso} dias de atraso`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="cartao-pool__nota">Mostramos os atrasos também. Transparência que esconde o problema não serve para nada.</p>
          </aside>
        </div>
      </section>

      <section id="como-funciona" className="secao">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Como funciona</p>
            <h2>Quatro peças, cada uma com um responsável</h2>
            <p>A segurança não vem do site. Vem de quem origina, de como o crédito é formalizado e de onde o dinheiro fica. A gente mostra cada uma dessas peças.</p>
          </header>
          <ol className="etapas">
            {ETAPAS.map((e) => (
              <li key={e.n}>
                <span className="etapas__n num">{e.n}</span>
                <h3>{e.t}</h3>
                <p>{e.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="simulador" className="secao secao--tinta">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Simulador</p>
            <h2>Quanto chega na sua conta, já sem o IR</h2>
            <p>Taxa diária equivalente composta, mês comercial de 30 dias, IR pela tabela regressiva. Simulação ilustrativa, sem garantia de rentabilidade futura.</p>
          </header>
          <Simulador
            onSimular={(s) => {
              setSim(s);
              document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </section>

      <section className="secao">
        <div className="secao__in secao__in--duas">
          <header className="secao__cab">
            <p className="sobretitulo">Antes de investir</p>
            <h2>Uma trilha curta antes de qualquer aporte</h2>
            <p>Ninguém investe aqui sem entender o que está comprando. São quatro módulos de poucos minutos, com perguntas no fim de cada um, e um questionário de perfil.</p>
            <Link href="/entrar" className="btn btn--primario" style={{ marginTop: 24 }}>
              Começar a trilha
            </Link>
          </header>
          <ol className="lista-trilha">
            <li><span className="num">1</span>O que é uma CCB</li>
            <li><span className="num">2</span>Os riscos, sem rodeio</li>
            <li><span className="num">3</span>Como ler o lastro no painel</li>
            <li><span className="num">4</span>Rendimento líquido e imposto</li>
          </ol>
        </div>
      </section>

      <section id="riscos" className="secao secao--areia">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Riscos</p>
            <h2>Leia isto antes de qualquer número</h2>
            <p>Rentabilidade acima da renda fixa tradicional existe porque o risco também é maior. Estes são os principais.</p>
          </header>
          <div className="riscos">
            {RISCOS.map((r) => (
              <article key={r.t}>
                <h3>{r.t}</h3>
                <p>{r.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="secao">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Conteúdo</p>
            <h2>Crédito privado sem jargão</h2>
          </header>
          <div className="cards-artigos">
            {ARTIGOS.slice(0, 3).map((a) => (
              <Link key={a.slug} href={`/conteudo/${a.slug}`} className="card-artigo">
                <span className="card-artigo__min">{a.minutos} min de leitura</span>
                <h3>{a.titulo}</h3>
                <p>{a.resumo}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="secao secao--areia">
        <div className="secao__in secao__in--estreito">
          <header className="secao__cab">
            <p className="sobretitulo">Dúvidas</p>
            <h2>Perguntas diretas</h2>
          </header>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.p}>
                <summary>{f.p}</summary>
                <p>{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="secao secao--tinta">
        <div className="secao__in secao__in--duas">
          <header className="secao__cab">
            <p className="sobretitulo">Contato</p>
            <h2>Primeiro uma conversa, depois um contrato</h2>
            <p>
              Um especialista entende seu momento, apresenta a estrutura e os documentos. Você decide com tempo.
              {status.data && !status.data.captacaoLiberada && <> Enquanto o emissor parceiro não é apresentado, recebemos apenas manifestações de interesse.</>}
            </p>
          </header>
          <FormContato simulacao={sim} />
        </div>
      </section>
    </PaginaPublica>
  );
}
