import { Link } from "wouter";
import type { Saidas } from "@/lib/trpc";
import { formatarBRL, formatarPct, linhaTabelaProgressiva, tetoDaFaixa, type Faixa } from "~shared/finance";
import { PRAZOS_CONTRATO, RESGATE_ANTECIPADO, WATERFALL, formatarCobertura } from "~shared/lastroGraos";

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

/** Carteira de CCBs que garante a oferta, no formato de quadro resumo com valor de resgate no vencimento. */
export function TabelaGarantias({ garantias }: { garantias: Ficha["garantias"] }) {
  if (!garantias.length) return <p className="bloco__nota">Nenhuma CCB registrada.</p>;
  const custo = garantias.reduce((t, g) => t + g.valorCcbCentavos, 0);
  const resgate = garantias.reduce((t, g) => t + (g.valorResgateCentavos ?? 0), 0);
  const avaliacao = garantias.reduce((t, g) => t + (g.avaliacaoCentavos ?? 0), 0);
  return (
    <>
      <dl className="quadro-ccb">
        <div><dt>Valor atual da carteira</dt><dd className="num">{formatarBRL(custo)}</dd></div>
        <div><dt>Valor de resgate no vencimento</dt><dd className="num">{resgate ? formatarBRL(resgate) : "–"}</dd></div>
        <div><dt>Imóveis em garantia</dt><dd className="num">{formatarBRL(avaliacao)}<small>{custo ? ` · ${formatarPct(avaliacao / custo, 0)} da carteira` : ""}</small></dd></div>
      </dl>
      <div className="tabela-wrap">
        <table className="tabela tabela--ops">
          <thead><tr><th>Ativo</th><th>Emissão e vencimento</th><th className="dir">Custo de aquisição</th><th className="dir">Resgate</th><th>Garantia colateral</th><th className="dir">LTV</th><th>Situação</th></tr></thead>
          <tbody>
            {garantias.map((g) => (
              <tr key={g.codigo}>
                <td><strong className="mono">{g.codigo}</strong><span className="sub">{g.serie ?? "Série única"}</span></td>
                <td>{dataBR(g.emissao)}<span className="sub">vence {dataBR(g.vencimento)}</span></td>
                <td className="dir num">{formatarBRL(g.valorCcbCentavos)}</td>
                <td className="dir num">{g.valorResgateCentavos ? formatarBRL(g.valorResgateCentavos) : "–"}</td>
                <td>{g.tipo}<span className="sub">{g.descricao}{g.avaliacaoCentavos ? ` · avaliação ${formatarBRL(g.avaliacaoCentavos)}` : ""}</span></td>
                <td className="dir num">{g.ltv !== null ? formatarPct(g.ltv, 0) : "–"}</td>
                <td><span className={`status ${g.situacao === "adimplente" ? "status--adimplente" : "status--atraso"}`}>{g.situacao === "adimplente" ? "Em dia" : g.situacao}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Tabela progressiva: para cada faixa de aporte e prazo, juros do mês e valor acumulado no vencimento. */
export function TabelaProgressiva({ faixas, prazoResgateDias }: { faixas: Faixa[]; prazoResgateDias: number }) {
  const minimos = [...new Set(faixas.map((f) => f.minimoCentavos))].sort((a, b) => a - b);
  const grupos = minimos
    .map((m) => ({
      minimo: m,
      linhas: PRAZOS_CONTRATO.map((p) => {
        const taxa = tetoDaFaixa(faixas, m, p);
        return taxa === null ? null : linhaTabelaProgressiva(m, p, taxa);
      }).filter((l): l is NonNullable<typeof l> => l !== null),
    }))
    .filter((g) => g.linhas.length);
  return (
    <div className="tabela-wrap">
      <table className="tabela tabela-prog">
        <thead>
          <tr><th>Aporte</th><th>Prazo</th><th className="dir">Taxa mensal nominal</th><th className="dir">Juros no mês<small>31 dias</small></th><th>Liquidez dos juros</th><th className="dir">Acumulado no vencimento</th></tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.minimo}>
            {g.linhas.map((l, i) => (
              <tr key={l.prazoMeses}>
                {i === 0 && <th scope="rowgroup" rowSpan={g.linhas.length} className="num">{formatarBRL(g.minimo)}</th>}
                <td className="num">{l.prazoMeses} meses</td>
                <td className="dir num">{formatarPct(l.taxaMensal, 2)}</td>
                <td className="dir num">{formatarBRL(l.jurosMesCentavos)}</td>
                <td>D+{prazoResgateDias}</td>
                <td className="dir num"><strong>{formatarBRL(l.resgateVencimentoCentavos)}</strong></td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function RegrasResgateAntecipado() {
  return (
    <div className="resgate-antecipado">
      <p>Saque do principal antes do prazo contratado: liquidado em D+{RESGATE_ANTECIPADO.liquidacaoDias} a partir do pedido, com a penalidade descontada da performance.</p>
      <ol>
        {RESGATE_ANTECIPADO.regras.map((r) => <li key={r.faixa}><strong>{r.faixa}</strong><span>{r.regra}</span></li>)}
      </ol>
      <p className="bloco__nota">{RESGATE_ANTECIPADO.nota}</p>
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
        <div><dt>Prazos</dt><dd className="num">12, 24 ou 36 <small>meses</small></dd></div>
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
  { t: "Sem FGC", d: "Este investimento não tem cobertura do Fundo Garantidor de Créditos. A proteção vem da garantia da própria Rio, das CCBs lastreadas em imóveis, da conta vinculada e do seguro das cargas." },
  { t: "Risco da Rio", d: "A garantia e a recompra dos títulos dependem da capacidade de pagamento da Rio. Se ela falhar, as garantias em imóveis são executadas, o que leva tempo e pode não recuperar tudo." },
  { t: "Preço e comprador", d: "O preço do grão pode cair entre a compra e a venda, e um comprador pode atrasar. A carga tem seguro no transporte, mas oscilação de preço e atraso não são cobertos pelo seguro." },
  { t: "Liquidez do principal", d: "O principal fica até o vencimento, em 12, 24 ou 36 meses, quando a Rio recompra os títulos. Sair antes é possível em D+60, com penalidade sobre o rendimento." },
];
