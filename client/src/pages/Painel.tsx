import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { SeloEmissor } from "@/components/landing/SiteLayout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";

type ContratoPainel = Saidas["investidor"]["painel"]["contratos"][number];

const data = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "a definir");

/** Próximo passo do onboarding: trilha → perfil → cadastro → conversa. */
function ProximoPasso({ temContrato }: { temContrato: boolean }) {
  const perfil = trpc.investidor.perfil.useQuery();
  const trilha = trpc.trilha.estado.useQuery();
  if (!perfil.data || !trilha.data || temContrato) return null;

  const feitos = trilha.data.modulos.filter((m) => m.concluido).length;
  const passos = [
    { feito: trilha.data.completa, titulo: "Trilha Antes de investir", det: `${feitos} de ${trilha.data.modulos.length} módulos`, href: "/trilha" },
    { feito: perfil.data.suitability !== "nao_avaliado", titulo: "Questionário de perfil", det: "5 perguntas", href: "/perfil" },
    { feito: Boolean(perfil.data.cadastroCompletoEm), titulo: "Cadastro do investidor", det: "dados para o contrato", href: "/cadastro" },
    { feito: Boolean(perfil.data.interesseAporteEm), titulo: "Conversa com especialista", det: perfil.data.interesseAporteEm ? "pedido enviado" : "manifestar interesse", href: "/perfil" },
  ];
  const atual = passos.findIndex((p) => !p.feito);
  if (atual === -1) {
    return (
      <section className="bloco">
        <p className="aviso aviso--ok" style={{ margin: 0 }}>
          Tudo pronto do seu lado. Um especialista vai entrar em contato para apresentar o contrato.
        </p>
      </section>
    );
  }
  return (
    <section className="bloco">
      <div className="bloco__cab"><h2>Seus próximos passos</h2></div>
      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.titulo} className={p.feito ? "feito" : i === atual ? "atual" : ""}>
            <span className="passos__n num">{p.feito ? "✓" : i + 1}</span>
            <div><strong>{p.titulo}</strong><span>{p.det}</span></div>
            {i === atual && <Link href={p.href} className="btn btn--primario btn--peq">Continuar</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Largura real do contêiner, para o SVG desenhar em pixels (texto legível no celular e no desktop). */
function useLargura<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

/** Curva do rendimento acumulado (SVG puro), com marcador de hoje. */
function GraficoEvolucao({ c, hoje }: { c: ContratoPainel; hoje: string }) {
  const [ref, L] = useLargura<HTMLElement>(640);
  const pts = c.evolucao;
  if (pts.length < 2) return null;
  const A = L < 480 ? 200 : 240;
  const m = { e: L < 480 ? 56 : 72, d: 12, t: 28, b: 28 };
  const max = Math.max(...pts.map((p) => p.rendimentoCentavos), 1);
  const t0 = new Date(pts[0]!.data).getTime(), t1 = new Date(pts.at(-1)!.data).getTime();
  const x = (iso: string) => m.e + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (L - m.e - m.d);
  const y = (v: number) => m.t + (1 - v / max) * (A - m.t - m.b);
  const linha = pts.map((p, i) => `${i ? "L" : "M"}${x(p.data).toFixed(1)},${y(p.rendimentoCentavos).toFixed(1)}`).join(" ");
  const hojeX = Math.min(Math.max(x(hoje), m.e), L - m.d);
  const hojeY = y(c.rendimentoBrutoCentavos);
  const ancora = hojeX < m.e + 60 ? "start" : hojeX > L - 60 ? "end" : "middle";
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const curto = (v: number) => (v >= 10_000_00 ? `R$ ${(v / 100_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatarBRL(v).replace(",00", ""));
  return (
    <figure className="grafico" ref={ref}>
      <figcaption>Rendimento bruto acumulado até o vencimento ({formatarBRL(max)})</figcaption>
      <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Rendimento acumulado: ${formatarBRL(c.rendimentoBrutoCentavos)} até hoje, ${formatarBRL(max)} no vencimento`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="grafico__grade" />
            <text x={m.e - 8} y={y(v) + 4} textAnchor="end" className="grafico__eixo">{curto(v)}</text>
          </g>
        ))}
        <path d={`${linha} L${x(pts.at(-1)!.data)},${y(0)} L${x(pts[0]!.data)},${y(0)} Z`} className="grafico__area" />
        <path d={linha} className="grafico__linha" />
        <line x1={hojeX} x2={hojeX} y1={m.t - 8} y2={A - m.b} className="grafico__hoje" />
        <circle cx={hojeX} cy={hojeY} r={5} className="grafico__ponto" />
        <text x={hojeX} y={m.t - 14} textAnchor={ancora} className="grafico__eixo grafico__eixo--hoje">hoje · {formatarBRL(c.rendimentoBrutoCentavos)}</text>
        <text x={m.e} y={A - 8} className="grafico__eixo">{data(pts[0]!.data)}</text>
        <text x={L - m.d} y={A - 8} textAnchor="end" className="grafico__eixo">{data(pts.at(-1)!.data)}</text>
      </svg>
    </figure>
  );
}

function FormResgate({ c, habilitado, previsto, onFeito }: { c: ContratoPainel; habilitado: boolean; previsto: string; onFeito: () => void }) {
  const [valor, setValor] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const centavos = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const valido = centavos > 0 && centavos <= c.disponivelCentavos;
  const previa = trpc.investidor.previaResgate.useQuery({ contratoId: c.id, valorCentavos: centavos }, { enabled: valido });
  const pedir = trpc.investidor.solicitarResgate.useMutation({ onSuccess: onFeito });

  if (!habilitado) return <p className="bloco__nota">Resgates abrem quando o emissor parceiro estiver habilitado na plataforma.</p>;
  if (pedir.isSuccess) {
    return <p className="aviso aviso--ok">Pedido enviado. Previsão de pagamento: {data(pedir.data.previstoPara)}, valor líquido {formatarBRL(pedir.data.liquidoCentavos)}.</p>;
  }
  return (
    <form className="resgate" onSubmit={(e) => { e.preventDefault(); if (valido) pedir.mutate({ contratoId: c.id, valorCentavos: centavos, idempotencyKey: chave }); }}>
      <label className="campo-form">
        Valor bruto a resgatar
        <div className="resgate__linha">
          <span>R$</span>
          <input value={valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setValor(e.target.value)} aria-describedby="resgate-max" />
          <button type="button" className="btn btn--ghost btn--peq" onClick={() => setValor((c.disponivelCentavos / 100).toFixed(2).replace(".", ","))}>Tudo</button>
        </div>
      </label>
      <span id="resgate-max" className="bloco__nota">Disponível: {formatarBRL(c.disponivelCentavos)}</span>
      {centavos > c.disponivelCentavos && <p className="aviso aviso--erro">Acima do disponível.</p>}
      {valido && previa.data && (
        <dl className="resgate__previa">
          <div><dt>IR retido ({formatarPct(previa.data.aliquota, 1)})</dt><dd className="num">− {formatarBRL(previa.data.irCentavos)}</dd></div>
          <div><dt>Você recebe</dt><dd className="num"><strong>{formatarBRL(previa.data.liquidoCentavos)}</strong></dd></div>
          <div><dt>Previsão</dt><dd>{data(previsto)}</dd></div>
        </dl>
      )}
      {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
      <button className="btn btn--primario" disabled={!valido || pedir.isPending}>{pedir.isPending ? "Enviando…" : "Pedir resgate"}</button>
    </form>
  );
}

function Extrato({ contratoId }: { contratoId: number }) {
  const { data: linhas } = trpc.investidor.extrato.useQuery({ contratoId });
  if (!linhas?.length) return <p className="bloco__nota">Sem lançamentos.</p>;
  return (
    <ul className="extrato">
      {linhas.map((l, i) => (
        <li key={i} className={l.status === "recusado" ? "extrato--recusado" : ""}>
          <span className="extrato__data num">{data(l.data)}</span>
          <span className="extrato__desc">{l.descricao}</span>
          <span className={`extrato__valor num ${l.valorCentavos < 0 ? "neg" : "pos"}`}>{l.valorCentavos < 0 ? "−" : "+"} {formatarBRL(Math.abs(l.valorCentavos))}</span>
        </li>
      ))}
    </ul>
  );
}

function ContratoAtivo({ c, painel }: { c: ContratoPainel; painel: Saidas["investidor"]["painel"] }) {
  const utils = trpc.useUtils();
  const [aba, setAba] = useState<"evolucao" | "resgate" | "extrato">("evolucao");
  return (
    <section className="bloco contrato">
      <div className="bloco__cab">
        <div>
          <h2>{c.oferta}</h2>
          <span className="bloco__det">Contrato #{c.id} · {formatarPct(c.taxaMensal)} a.m. · {data(c.inicio)} a {data(c.vencimento)}</span>
        </div>
        <Link href={`/contrato/${c.id}`} className="btn btn--ghost btn--peq">Ver contrato</Link>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Saldo aportado</span><strong className="num">{formatarBRL(c.principalCentavos)}</strong><small>Disponível no vencimento, {data(c.vencimento)}</small></div>
        <div className="kpi kpi--dest"><span>Rendimento disponível</span><strong className="num">{formatarBRL(c.disponivelCentavos)}</strong><small>Se pedir hoje, pago em {data(painel.pagamentoSePedirHoje)}</small></div>
        <div className="kpi"><span>Saldo total</span><strong className="num">{formatarBRL(c.principalCentavos + c.disponivelCentavos)}</strong><small>Rendimento bruto acumulado {formatarBRL(c.rendimentoBrutoCentavos)} · já resgatado {formatarBRL(c.resgatadoCentavos)}</small></div>
      </div>
      <div className="abas" role="tablist">
        {(["evolucao", "resgate", "extrato"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "on" : ""} onClick={() => setAba(a)}>
            {a === "evolucao" ? "Evolução" : a === "resgate" ? "Pedir resgate" : "Extrato"}
          </button>
        ))}
      </div>
      {aba === "evolucao" && <GraficoEvolucao c={c} hoje={painel.hoje} />}
      {aba === "resgate" && (
        <FormResgate c={c} habilitado={painel.resgateHabilitado} previsto={painel.pagamentoSePedirHoje}
          onFeito={() => { void utils.investidor.painel.invalidate(); void utils.investidor.extrato.invalidate(); void utils.investidor.resgates.invalidate(); }} />
      )}
      {aba === "extrato" && <Extrato contratoId={c.id} />}
    </section>
  );
}

const STATUS_CLASSE: Record<string, string> = { ativo: "status--adimplente", cancelado: "status--atraso", aguardando_assinatura: "status--alerta", aguardando_aporte: "status--alerta" };

export default function Painel() {
  const painel = trpc.investidor.painel.useQuery();
  const lastro = trpc.plataforma.lastro.useQuery();
  const contratos = painel.data?.contratos ?? [];
  const ativos = contratos.filter((c) => c.status === "ativo");
  const pendentes = contratos.filter((c) => c.status === "aguardando_assinatura" || c.status === "aguardando_aporte");
  const totais = useMemo(() => ({
    aportado: ativos.reduce((s, c) => s + c.principalCentavos, 0),
    disponivel: ativos.reduce((s, c) => s + c.disponivelCentavos, 0),
  }), [ativos]);

  return (
    <AreaLogada titulo="Minha carteira" subtitulo={ativos.length > 1 ? `${ativos.length} contratos ativos · ${formatarBRL(totais.aportado)} aportado · ${formatarBRL(totais.disponivel)} disponível` : "Contratos, rendimento e o lastro do pool."}>
      <Seo titulo="Minha carteira" indexar={false} />
      <ProximoPasso temContrato={contratos.some((c) => c.status !== "cancelado")} />

      {pendentes.map((c) => (
        <section key={c.id} className="bloco bloco--pendente">
          <div className="bloco__cab">
            <div>
              <h2>Contrato #{c.id} · {formatarBRL(c.principalCentavos)}</h2>
              <span className="bloco__det">{formatarPct(c.taxaMensal)} a.m. · {c.prazoMeses} meses · {c.oferta}</span>
            </div>
            <span className={`status ${STATUS_CLASSE[c.status] ?? ""}`}>{c.statusRotulo}</span>
          </div>
          <p className="bloco__nota">
            {c.status === "aguardando_assinatura"
              ? "Leia o contrato com calma. A assinatura é feita com o especialista."
              : "Contrato assinado. Assim que o aporte for confirmado na conta vinculada do emissor, o rendimento começa a contar."}
          </p>
          <Link href={`/contrato/${c.id}`} className="btn btn--primario btn--peq" style={{ marginTop: 12 }}>Ler o contrato</Link>
        </section>
      ))}

      {painel.isLoading ? <p className="carregando">Carregando…</p> : ativos.length === 0 && pendentes.length === 0 ? (
        <section className="bloco">
          <Vazio titulo="Você ainda não tem contratos">
            <p>Quando um contrato for gerado para você, ele aparece aqui. Depois do aporte confirmado, você acompanha o rendimento do dia.</p>
          </Vazio>
        </section>
      ) : null}

      {painel.data && ativos.map((c) => <ContratoAtivo key={c.id} c={c} painel={painel.data!} />)}

      <section className="bloco">
        <div className="bloco__cab">
          <h2>Lastro do pool</h2>
          <span className="bloco__det">{lastro.data?.exemplo ? <span className="etiqueta">exemplo</span> : `${lastro.data?.itens.length ?? 0} CCBs`}</span>
        </div>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>CCB</th><th>Devedor</th><th>Garantia</th><th className="dir">LTV</th><th>Situação</th></tr></thead>
            <tbody>
              {(lastro.data?.itens ?? []).map((l) => (
                <tr key={l.codigo}>
                  <td className="mono">{l.codigo}</td>
                  <td><span className={`ponto ponto--${l.setor}`} aria-hidden="true" /> {l.devedor}</td>
                  <td>{l.garantia}</td>
                  <td className="dir num">{formatarPct(l.ltv, 0)}</td>
                  <td><span className={`status status--${l.situacao === "adimplente" ? "adimplente" : "atraso"}`}>{l.situacao === "adimplente" ? "Em dia" : `${l.diasAtraso} dias de atraso`}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bloco__nota">LTV é o valor do crédito dividido pelo valor da garantia. Quanto menor, maior a folga.</p>
      </section>

      <section className="bloco bloco--duas">
        <div>
          <h2>Quem está por trás</h2>
          <p className="bloco__nota" style={{ marginTop: 8 }}>O RioRendeFácil é a tecnologia. O emissor parceiro emite as CCBs e os recursos ficam em conta vinculada em nome dele, nunca na plataforma.</p>
        </div>
        <SeloEmissor />
      </section>
    </AreaLogada>
  );
}
