import { Link } from "wouter";
import type { Saidas } from "@/lib/trpc";
import { formatarBRL, formatarPct } from "~shared/finance";
import { WATERFALL, formatarCobertura } from "~shared/lastroGraos";

export type Ficha = Saidas["plataforma"]["oferta"];
type Operacao = Ficha["operacoes"][number];

export const dataBR = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "–");
export const brlCurto = (c: number) =>
  c >= 1_000_000_00 ? `R$ ${(c / 100_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : c >= 10_000_00 ? `R$ ${Math.round(c / 100_000)} mil` : formatarBRL(c);

/* ───────── Fatias de alocação: mesma cor para a mesma coisa em todo o site ───────── */
export type ChaveFatia = "soja" | "milho" | "sorgo" | "a_receber" | "caixa" | "atraso";
export interface Fatia { chave: ChaveFatia; rotulo: string; centavos: number; det?: string }

/** Ordem fixa (validada para daltonismo nesta sequência). Atraso usa a cor de status. */
const ORDEM: ChaveFatia[] = ["soja", "milho", "sorgo", "a_receber", "caixa", "atraso"];

export function fatiasDaFicha(f: Ficha): Fatia[] {
  const porGrao = new Map<string, { c: number; n: number }>();
  for (const o of f.operacoes) {
    if (o.status === "comprada" || o.status === "em_transporte") {
      const a = porGrao.get(o.grao) ?? { c: 0, n: 0 };
      porGrao.set(o.grao, { c: a.c + o.valorCompraCentavos + o.custosCentavos, n: a.n + 1 });
    }
  }
  const fatias: Fatia[] = [];
  for (const [g, v] of porGrao) fatias.push({ chave: g as ChaveFatia, rotulo: `${g[0]!.toUpperCase()}${g.slice(1)}`, centavos: v.c, det: `grão comprado · ${v.n} ${v.n === 1 ? "operação" : "operações"}` });
  if (f.posicao.aReceberCentavos > 0) fatias.push({ chave: "a_receber", rotulo: "Vendido, a receber", centavos: f.posicao.aReceberCentavos });
  if (f.posicao.saldoContaCentavos > 0) fatias.push({ chave: "caixa", rotulo: "Caixa na conta vinculada", centavos: f.posicao.saldoContaCentavos });
  if (f.posicao.emAtrasoCentavos > 0) fatias.push({ chave: "atraso", rotulo: "Recebimento atrasado", centavos: f.posicao.emAtrasoCentavos, det: "fora da conta de ativos" });
  return fatias.sort((a, b) => ORDEM.indexOf(a.chave) - ORDEM.indexOf(b.chave));
}

/** Barra empilhada com legenda que traz o valor de cada fatia (a cor nunca é a única pista). */
export function BarraAlocacao({ fatias, titulo }: { fatias: Fatia[]; titulo: string }) {
  const total = fatias.reduce((s, f) => s + f.centavos, 0);
  if (!total) return <p className="bloco__nota">Ainda não há dinheiro alocado.</p>;
  return (
    <figure className="aloc">
      <figcaption className="aloc__titulo">{titulo}</figcaption>
      <div className="aloc__barra" role="img" aria-label={fatias.map((f) => `${f.rotulo} ${formatarBRL(f.centavos)}`).join(", ")}>
        {fatias.map((f) => (
          <span key={f.chave} className={`aloc__seg aloc--${f.chave}`} style={{ flexGrow: f.centavos }} title={`${f.rotulo}: ${formatarBRL(f.centavos)} (${formatarPct(f.centavos / total, 0)})`} />
        ))}
      </div>
      <ul className="aloc__legenda">
        {fatias.map((f) => (
          <li key={f.chave}>
            <span className={`aloc__ponto aloc--${f.chave}`} aria-hidden="true" />
            <span className="aloc__rot">{f.rotulo}{f.det && <small>{f.det}</small>}</span>
            <span className="num aloc__val">{formatarBRL(f.centavos)}<small>{formatarPct(f.centavos / total, 0)}</small></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Índice de cobertura com a linha da trava. */
export function MedidorCobertura({ cobertura, minima }: { cobertura: number | null; minima: number }) {
  const escala = Math.max(2, (cobertura ?? 0) + 0.2, minima + 0.4);
  const pct = (x: number) => `${Math.min(100, (x / escala) * 100)}%`;
  const ok = cobertura === null || cobertura >= minima;
  return (
    <div className="cobertura">
      <div className="cobertura__cab">
        <strong className="num">{formatarCobertura(cobertura)}</strong>
        <span className={`status ${ok ? "status--adimplente" : "status--atraso"}`}>{cobertura === null ? "Sem captação ainda" : ok ? "✓ Acima do mínimo" : "✕ Abaixo do mínimo: captação suspensa"}</span>
      </div>
      <div className="cobertura__trilho" role="img" aria-label={`Cobertura ${formatarCobertura(cobertura)}, mínimo ${formatarCobertura(minima)}`}>
        {cobertura !== null && <span className={`cobertura__barra ${ok ? "" : "cobertura__barra--baixa"}`} style={{ width: pct(cobertura) }} />}
        <span className="cobertura__trava" style={{ left: pct(minima) }}><small>trava {formatarCobertura(minima)}</small></span>
      </div>
      <p className="bloco__nota">Garantias elegíveis divididas pelo principal captado. Abaixo de {formatarCobertura(minima)}, novas captações e novas compras de grão param até a garantia ser recomposta.</p>
    </div>
  );
}

/** O caminho do dinheiro numa operação. */
export function FluxoOperacao({ cicloDias }: { cicloDias: number }) {
  const passos = [
    { t: "Seu aporte", d: "Entra na conta vinculada da oferta, nunca no caixa da Rio." },
    { t: "Compra à vista", d: "Soja, milho ou sorgo direto do produtor, com nota fiscal." },
    { t: "Transporte", d: "Transportadora e destino registrados." },
    { t: "Venda", d: "Para cerealista, cooperativa, indústria ou trading aprovados." },
    { t: "Recebimento", d: "O comprador paga na conta vinculada." },
    { t: "Ordem de pagamento", d: "Investidor primeiro, margem da Rio por último." },
  ];
  return (
    <div>
      <ol className="fluxo">
        {passos.map((p, i) => (
          <li key={p.t}>
            <span className="fluxo__n num">{i + 1}</span>
            <strong>{p.t}</strong>
            <span>{p.d}</span>
          </li>
        ))}
      </ol>
      <p className="bloco__nota">Ciclo médio de {cicloDias} dias entre comprar o grão e receber a venda. O mesmo capital gira várias vezes durante o contrato.</p>
    </div>
  );
}

const STATUS_CLASSE: Record<string, string> = {
  recebida: "status--adimplente",
  vendida: "status--alerta",
  comprada: "status--neutro",
  em_transporte: "status--neutro",
  em_analise: "status--neutro",
  atrasada: "status--atraso",
};

export function TabelaOperacoes({ operacoes }: { operacoes: Operacao[] }) {
  if (!operacoes.length) return <p className="bloco__nota">Nenhuma operação registrada ainda.</p>;
  return (
    <div className="tabela-wrap">
      <table className="tabela tabela--ops">
        <thead>
          <tr><th>Operação</th><th>Origem</th><th className="dir">Compra</th><th>Comprador</th><th className="dir">Venda</th><th>Situação</th></tr>
        </thead>
        <tbody>
          {operacoes.map((o) => (
            <tr key={o.codigo}>
              <td><strong className="mono">{o.codigo}</strong><span className="sub">{o.graoRotulo} · {o.toneladas.toLocaleString("pt-BR")} t</span></td>
              <td>{o.origem.split(", ").slice(1).join(", ")}<span className="sub">{o.origem.split(", ")[0]} · {dataBR(o.dataCompra)}</span></td>
              <td className="dir num">{formatarBRL(o.valorCompraCentavos)}{o.custosCentavos > 0 && <span className="sub">+ {formatarBRL(o.custosCentavos)} custos</span>}</td>
              <td>{o.comprador ? o.comprador.split(": ").slice(-1)[0] : <span className="sub">a definir</span>}{(o.comprador || o.destino) && <span className="sub">{[o.comprador?.split(": ")[0], o.destino].filter(Boolean).join(" · ")}</span>}</td>
              <td className="dir num">{o.valorVendaCentavos ? formatarBRL(o.valorVendaCentavos) : "–"}{o.margemPct !== null && <span className="sub">margem {formatarPct(o.margemPct, 1)}</span>}</td>
              <td><span className={`status ${STATUS_CLASSE[o.status] ?? ""}`}>{o.statusRotulo}</span>{o.status === "vendida" || o.status === "atrasada" ? <span className="sub">vence {dataBR(o.vencimentoRecebimento)}</span> : o.status === "recebida" ? <span className="sub">em {dataBR(o.dataRecebimento)}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaGarantias({ garantias }: { garantias: Ficha["garantias"] }) {
  if (!garantias.length) return <p className="bloco__nota">Nenhuma garantia registrada.</p>;
  return (
    <div className="tabela-wrap">
      <table className="tabela">
        <thead><tr><th>CCB</th><th>Garantia</th><th className="dir">Avaliação</th><th className="dir">Elegível</th><th className="dir">LTV</th><th>Situação</th></tr></thead>
        <tbody>
          {garantias.map((g) => (
            <tr key={g.codigo}>
              <td className="mono">{g.codigo}</td>
              <td>{g.descricao}<span className="sub">{g.tipo}{g.registro ? ` · ${g.registro}` : ""}</span></td>
              <td className="dir num">{g.avaliacaoCentavos ? formatarBRL(g.avaliacaoCentavos) : "–"}</td>
              <td className="dir num"><strong>{formatarBRL(g.elegivelCentavos)}</strong></td>
              <td className="dir num">{g.ltv !== null ? formatarPct(g.ltv, 0) : "–"}</td>
              <td><span className={`status ${g.situacao === "adimplente" ? "status--adimplente" : "status--atraso"}`}>{g.situacao === "adimplente" ? "Em dia" : g.situacao}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrdemPagamentos() {
  return (
    <ol className="waterfall">
      {WATERFALL.map((w, i) => <li key={w}><span className="num">{i + 1}</span>{w}</li>)}
    </ol>
  );
}

/** Cartão da prateleira. */
export function CardOferta({ f }: { f: Ficha }) {
  const captado = f.posicao.principalComprometidoCentavos;
  const alvo = f.captacaoAlvoCentavos;
  return (
    <article className="card-oferta">
      <header className="card-oferta__cab">
        <span className="mono card-oferta__cod">{f.codigo}</span>
        {f.exemplo ? <span className="etiqueta">exemplo</span> : f.captacaoLiberada ? <span className="status status--adimplente">Reservas abertas</span> : <span className="status status--alerta">Reservas suspensas</span>}
      </header>
      <h3>{f.nome}</h3>
      <p className="card-oferta__lastro">{f.graos.map((g) => g.rotulo).join(", ") || "Grãos"} · {f.operacoes.length} operações · {f.garantias.length} garantias</p>
      <dl className="card-oferta__num">
        <div><dt>Taxa</dt><dd className="num">{f.taxaDesde === f.taxaAte ? formatarPct(f.taxaAte) : `${formatarPct(f.taxaDesde)} a ${formatarPct(f.taxaAte)}`} <small>a.m.</small></dd></div>
        <div><dt>Mínimo</dt><dd className="num">{brlCurto(f.aplicacaoMinimaCentavos)}</dd></div>
        <div><dt>Prazo</dt><dd className="num">{f.prazoMinimoMeses}+ meses</dd></div>
        <div><dt>Cobertura</dt><dd className="num">{formatarCobertura(f.posicao.cobertura)}</dd></div>
      </dl>
      {alvo ? (
        <div className="progresso" aria-label={`Captado ${formatarBRL(captado)} de ${formatarBRL(alvo)}`}>
          <span style={{ width: `${Math.min(100, (captado / alvo) * 100)}%` }} />
          <small className="num">{brlCurto(captado)} de {brlCurto(alvo)} captados</small>
        </div>
      ) : null}
      <Link href={`/ofertas/${f.id}`} className="btn btn--primario btn--largo">Ver ficha da oferta</Link>
    </article>
  );
}

export const RISCOS_GRAOS = [
  { t: "Preço e quebra", d: "O preço do grão pode cair entre a compra e a venda, e pode haver perda de peso ou qualidade no transporte." },
  { t: "Comprador", d: "O comprador pode atrasar ou não pagar. O recebível e as garantias reduzem a perda, mas cobrar e executar leva tempo." },
  { t: "Garantias", d: "Imóveis podem valer menos na hora da execução. Por isso só uma parte da avaliação conta como elegível." },
  { t: "Sem FGC e liquidez do principal", d: "Não há cobertura do Fundo Garantidor de Créditos. O principal fica até o vencimento; só o rendimento pode ser resgatado antes." },
];
