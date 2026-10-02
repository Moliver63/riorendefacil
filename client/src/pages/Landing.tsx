import { useState } from "react";
import { Link } from "wouter";
import { PaginaPublica, SeloEmissor } from "@/components/landing/SiteLayout";
import { Simulador } from "@/components/landing/Simulador";
import { FormContato, type SimulacaoLead } from "@/components/landing/FormContato";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";
import { formatarCobertura } from "~shared/lastroGraos";
import { ARTIGOS } from "~shared/conteudo";

const ETAPAS = [
  { n: "01", t: "Seu aporte vai para a conta vinculada", d: "O dinheiro entra numa conta da oferta, com regras de uso, separada do caixa da Rio e do nosso. Só sai para comprar grão de operações aprovadas." },
  { n: "02", t: "A Rio compra o grão à vista", d: "Soja, milho e sorgo direto do produtor rural, com nota fiscal, origem e quantidade registradas. Pagar à vista garante preço melhor na compra." },
  { n: "03", t: "Vende para quem já foi analisado", d: "Cerealistas, cooperativas, indústrias e tradings aprovados compram o grão. A venda vira um recebível com valor e data." },
  { n: "04", t: "O comprador paga na conta vinculada", d: "Do recebimento saem, nesta ordem, custos autorizados, o seu principal e a sua remuneração. A margem da Rio vem por último." },
];

const RISCOS = [
  { t: "Sem FGC", d: "Diferente de CDB e poupança, este investimento não tem cobertura do Fundo Garantidor de Créditos. A proteção vem da garantia da Rio, das CCBs com imóvel, da conta vinculada e do seguro das cargas." },
  { t: "Risco da Rio", d: "A garantia e a recompra dos títulos dependem da saúde financeira da Rio. Se ela falhar, os imóveis em garantia são executados, o que leva tempo e pode não cobrir 100%." },
  { t: "Preço e comprador", d: "O preço do grão pode cair entre a compra e a venda, e um comprador pode atrasar. O seguro cobre a carga no transporte, não a oscilação de preço nem o atraso." },
  { t: "Liquidez do principal", d: "O principal fica até o vencimento, em 12, 24 ou 36 meses, quando a Rio recompra os títulos. Antes disso, só o rendimento pode ser resgatado, em até 7 dias." },
];

const FAQ = [
  { p: "O RioRendeFácil é um banco?", r: "Não. Somos a tecnologia: ofertas, cadastro, painel e documentos. A Rio faz a compra e a venda dos grãos, e o emissor parceiro estrutura a oferta. O dinheiro fica em conta vinculada, nunca com a plataforma." },
  { p: "Como sei que a operação existe?", r: "Cada operação aparece na ficha da oferta com grão, toneladas, origem, comprador, destino, valores e situação. Notas fiscais e comprovantes ficam com o emissor e a auditoria." },
  { p: "O que protege o meu dinheiro?", r: "A própria Rio garante a operação com CCBs lastreadas em imóveis. O dinheiro circula só pela conta vinculada, as cargas têm seguro no transporte e, no vencimento, a Rio recompra os títulos. Não há FGC. A ficha mostra o índice de cobertura das garantias, e abaixo do mínimo novas captações e compras param." },
  { p: "Quais são os prazos?", r: "12, 24 ou 36 meses. Os juros são creditados por dia e podem ser resgatados a qualquer momento, com pagamento em até 7 dias. O principal volta no vencimento, quando a Rio recompra os títulos." },
  { p: "E se eu precisar do principal antes?", r: "Dá para pedir o resgate antecipado, liquidado em até 60 dias. Até 12 meses de permanência, você recebe o principal sem juros; entre 12 e 24 meses, o principal corrigido pelo CDI do período; entre 24 e 36 meses, o principal mais metade da performance acumulada. Juros já sacados são descontados." },
  { p: "Quando a Rio ganha dinheiro?", r: "Por último. Da venda do grão saem primeiro os custos, depois o principal e a remuneração dos investidores. Só o que sobra vira margem da Rio, e o sistema bloqueia retirada antes disso." },
  { p: "Preciso fazer a trilha antes de investir?", r: "Sim. São quatro módulos curtos e um questionário de perfil. Se o produto não combinar com você, avisamos antes de qualquer reserva." },
];

export default function Home() {
  const [sim, setSim] = useState<SimulacaoLead>();
  const status = trpc.plataforma.status.useQuery();
  const ofertas = trpc.plataforma.ofertas.useQuery();
  const destaque = ofertas.data?.[0];

  return (
    <PaginaPublica>
      <Seo
        titulo="RioRendeFácil · Renda fixa lastreada em grãos que você enxerga"
        descricao="Renda fixa lastreada em operações reais de soja, milho e sorgo. Cada operação visível, conta vinculada, garantias em imóveis e riscos explicados antes de qualquer aporte."
      />
      <section className="hero">
        <div className="hero__in">
          <div className="hero__texto">
            <p className="sobretitulo">Renda fixa lastreada em grãos</p>
            <h1>
              Seu dinheiro em operações de grão <em>que você enxerga.</em>
            </h1>
            <p className="hero__lead">
              O capital financia a compra à vista de soja, milho e sorgo e a revenda a compradores analisados. Você vê cada
              operação, a conta vinculada e as garantias em imóveis, e o investidor recebe antes da margem da Rio.
            </p>
            <div className="hero__acoes">
              <Link href="/ofertas" className="btn btn--primario">Ver ofertas</Link>
              <a href="#riscos" className="btn btn--ghost">Ler os riscos primeiro</a>
            </div>
            <SeloEmissor />
          </div>

          <aside className="cartao-pool" aria-label="Operações da oferta">
            <div className="cartao-pool__topo">
              <span>{destaque ? `${destaque.codigo} · operações` : "Operações"}</span>
              {destaque?.exemplo && <span className="etiqueta">exemplo</span>}
            </div>
            <ul>
              {(destaque?.operacoes ?? []).slice(0, 4).map((o) => (
                <li key={o.codigo}>
                  <span className={`aloc__ponto aloc--${o.grao}`} aria-hidden="true" />
                  <div>
                    <strong>{o.graoRotulo} · {o.toneladas.toLocaleString("pt-BR")} t</strong>
                    <span>{o.origem.replace(/^Produtor rural, /, "")}{o.destino ? ` → ${o.destino}` : ""}</span>
                  </div>
                  <div className="cartao-pool__dir">
                    <span className="num">{o.margemPct !== null ? `margem ${formatarPct(o.margemPct, 1)}` : formatarBRL(o.valorCompraCentavos)}</span>
                    <span className={`status ${o.status === "recebida" ? "status--adimplente" : o.status === "atrasada" ? "status--atraso" : o.status === "vendida" ? "status--alerta" : "status--neutro"}`}>{o.statusRotulo}</span>
                  </div>
                </li>
              ))}
            </ul>
            {destaque && (
              <p className="cartao-pool__nota">
                Cobertura de garantias {formatarCobertura(destaque.posicao.cobertura)} · mínimo {formatarCobertura(destaque.posicao.coberturaMinima)}.{" "}
                <Link href={`/ofertas/${destaque.id}`}>Ver a ficha completa</Link>
              </p>
            )}
          </aside>
        </div>
      </section>

      <section id="como-funciona" className="secao">
        <div className="secao__in">
          <header className="secao__cab">
            <p className="sobretitulo">Como funciona</p>
            <h2>Do produtor ao comprador, com o dinheiro sempre na conta vinculada</h2>
            <p>A segurança não vem do site. Vem do grão comprado, do recebível da venda, das garantias e da ordem em que o dinheiro é pago. A gente mostra cada uma dessas peças.</p>
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
            <p>Taxa mensal nominal com juros creditados por dia e capitalizados, como na tabela progressiva da Rio. IR pela tabela regressiva. Simulação ilustrativa, sem garantia de rentabilidade futura.</p>
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
            <li><span className="num">1</span>Como funciona o lastro em grãos</li>
            <li><span className="num">2</span>Garantias e riscos, sem rodeio</li>
            <li><span className="num">3</span>Como ler operações e garantias</li>
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
            <h2>Renda fixa e agro sem jargão</h2>
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
