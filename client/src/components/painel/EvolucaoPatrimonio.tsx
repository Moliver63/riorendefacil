import { useEffect, useRef, useState } from "react";
import { fatorRio, formatarPct, taxaAnualEquivalente } from "~shared/finance";
import { formatarCurto, formatarMoeda, type Moeda } from "~shared/moeda";
import { RESGATE_ANTECIPADO } from "~shared/lastroGraos";

export interface PontoEvolucao {
  data: string;
  mes: number;
  projetadoCentavos: number;
  realizadoCentavos: number | null;
}

interface Props {
  principalCentavos: number;
  taxaMensal: number;
  taxaMensalEfetiva: number;
  saldoCentavos: number;
  jurosProximoMesCentavos: number;
  valorNoVencimentoCentavos: number;
  prazoResgateDias: number;
  vencimento: string | null;
  hoje: string;
  pontos: PontoEvolucao[];
  moeda?: Moeda;
}

export const PERIODOS = [
  { id: "3m", rotulo: "3 meses", meses: 3 },
  { id: "6m", rotulo: "6 meses", meses: 6 },
  { id: "12m", rotulo: "12 meses", meses: 12 },
  { id: "tudo", rotulo: "Contrato inteiro", meses: 0 },
] as const;
export type Periodo = (typeof PERIODOS)[number]["id"];

const menosMeses = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};
const diasEntre = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86_400_000);

/**
 * Pontos da janela escolhida. "Contrato inteiro" mostra do início ao vencimento
 * com a projeção; as janelas de 3, 6 e 12 meses mostram o histórico até hoje,
 * terminando num ponto calculado para a data de hoje (mes = -1).
 */
export function pontosDoPeriodo(pontos: PontoEvolucao[], periodo: Periodo, hoje: string, ctx: { principalCentavos: number; taxaMensal: number; saldoCentavos: number }): PontoEvolucao[] {
  const def = PERIODOS.find((x) => x.id === periodo)!;
  if (!def.meses || pontos.length < 2) return pontos;
  const corte = menosMeses(hoje, def.meses);
  const passados = pontos.filter((pt) => pt.data <= hoje);
  let janela = passados.filter((pt) => pt.data >= corte);
  if (!janela.length && passados.length) janela = [passados.at(-1)!];
  const inicio = pontos[0]!.data;
  const pontoHoje: PontoEvolucao = {
    data: hoje,
    mes: -1,
    projetadoCentavos: Math.round(ctx.principalCentavos * fatorRio(ctx.taxaMensal, Math.max(0, diasEntre(inicio, hoje)))),
    realizadoCentavos: ctx.saldoCentavos,
  };
  return janela.at(-1)?.data === hoje ? janela : [...janela, pontoHoje];
}

/** Marcas do eixo entre um piso e um teto, de 4 a 6 valores redondos. */
function marcasFaixa(min: number, max: number): number[] {
  const bruto = (max - min) / 4 || max / 4 || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const r: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) r.push(v);
  return r;
}

const dataBR = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
const mesAno = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "");

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

/** Escala "bonita" para o eixo: 4 a 5 marcas redondas. */
function marcas(max: number): number[] {
  const bruto = max / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto;
  const n = Math.ceil(max / passo);
  return Array.from({ length: n + 1 }, (_, i) => i * passo);
}

/**
 * Evolução do patrimônio no contrato: linha projetada (sem saques, como na tabela
 * progressiva) até o vencimento e linha realizada até hoje (desconta os resgates).
 */
export function EvolucaoPatrimonio(p: Props) {
  const [ref, L] = useLargura<HTMLDivElement>(720);
  const [foco, setFoco] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const fm = (v: number) => formatarMoeda(v, p.moeda ?? "BRL");
  const curto = (v: number) => formatarCurto(v, p.moeda ?? "BRL");
  if (p.pontos.length < 2) return null;
  const pts = pontosDoPeriodo(p.pontos, periodo, p.hoje, p);
  const janela = periodo !== "tudo";

  const estreito = L < 520;
  const A = estreito ? 240 : 300;
  const m = { e: estreito ? 64 : 84, d: 16, t: 20, b: 34 };
  const valores = pts.flatMap((x) => [x.projetadoCentavos, x.realizadoCentavos ?? x.projetadoCentavos]);
  let ticks: number[];
  if (janela) {
    const lo = Math.min(...valores, p.saldoCentavos);
    const hi = Math.max(...valores, p.saldoCentavos);
    const folga = Math.max((hi - lo) * 0.12, hi * 0.002);
    ticks = marcasFaixa(Math.max(0, lo - folga), hi + folga);
  } else {
    ticks = marcas(Math.max(...pts.map((x) => x.projetadoCentavos)) * 1.04);
  }
  const piso = ticks[0]!;
  const topo = ticks.at(-1)!;
  const n = Math.max(1, pts.length - 1);
  const x = (i: number) => m.e + (i / n) * (L - m.e - m.d);
  const y = (v: number) => m.t + (1 - (v - piso) / (topo - piso)) * (A - m.t - m.b);
  const rotuloPonto = (pt: PontoEvolucao, i: number) => (pt.mes === -1 ? "hoje" : janela ? mesAno(pt.data) : i === 0 ? "início" : `${pt.mes}º mês`);

  const projetada = pts.map((pt, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(pt.projetadoCentavos).toFixed(1)}`).join(" ");
  const reais = pts.map((pt, i) => ({ i, v: pt.realizadoCentavos })).filter((r): r is { i: number; v: number } => r.v !== null);
  // ponto de hoje entre dois meses: interpola pela data
  const t0 = new Date(pts[0]!.data).getTime();
  const t1 = new Date(pts[n]!.data).getTime();
  const iHoje = Math.min(n, Math.max(0, ((new Date(p.hoje).getTime() - t0) / (t1 - t0)) * n));
  const realizada = [...reais.map((r) => `${x(r.i).toFixed(1)},${y(r.v).toFixed(1)}`), `${x(iHoje).toFixed(1)},${y(p.saldoCentavos).toFixed(1)}`]
    .map((c, k) => `${k ? "L" : "M"}${c}`)
    .join(" ");
  const area = `${realizada} L${x(iHoje).toFixed(1)},${y(piso)} L${x(0)},${y(piso)} Z`;
  const passoRotulo = janela ? (estreito ? Math.max(1, Math.ceil(n / 3)) : n <= 7 ? 1 : 2) : estreito ? Math.ceil(n / 2) : n <= 12 ? 3 : 6;
  const principalVisivel = p.principalCentavos >= piso && p.principalCentavos <= topo;

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const i = Math.round(((px - m.e) / (L - m.e - m.d)) * n);
    setFoco(Math.min(n, Math.max(0, i)));
  }
  const pf = foco !== null ? pts[foco]! : null;

  return (
    <div className="evo">
      <dl className="evo__kpis">
        <div><dt>Saldo hoje</dt><dd className="num">{fm(p.saldoCentavos)}</dd><small>principal + juros não sacados</small></div>
        <div><dt>Juros nos próximos 30 dias</dt><dd className="num">{fm(p.jurosProximoMesCentavos)}</dd><small>creditados por dia, saque em D+{p.prazoResgateDias}</small></div>
        <div><dt>Acumulado no vencimento</dt><dd className="num">{fm(p.valorNoVencimentoCentavos)}</dd><small>{p.vencimento ? `em ${dataBR(p.vencimento)}, ` : ""}se não houver saques</small></div>
        <div><dt>Taxa</dt><dd className="num">{formatarPct(p.taxaMensal)} <small>a.m. nominal</small></dd><small>{formatarPct(p.taxaMensalEfetiva, 3)} efetiva · {formatarPct(taxaAnualEquivalente(p.taxaMensal))} a.a.</small></div>
      </dl>

      <figure className="evo__fig" ref={ref}>
        <div className="evo__periodos" role="group" aria-label="Período do gráfico">
          {PERIODOS.map((op) => (
            <button key={op.id} type="button" className={periodo === op.id ? "on" : ""} aria-pressed={periodo === op.id} onClick={() => { setPeriodo(op.id); setFoco(null); }}>
              {op.rotulo}
            </button>
          ))}
        </div>
        <figcaption className="evo__legenda">
          <span><i className="evo__chave evo__chave--real" aria-hidden="true" />Realizado até hoje</span>
          <span><i className="evo__chave evo__chave--proj" aria-hidden="true" />{janela ? "Sem saques" : "Projeção sem saques"}</span>
          {principalVisivel && <span><i className="evo__chave evo__chave--princ" aria-hidden="true" />Principal</span>}
        </figcaption>
        <div className="evo__plot">
          <svg
            width={L}
            height={A}
            viewBox={`0 0 ${L} ${A}`}
            role="img"
            aria-label={`Saldo hoje ${fm(p.saldoCentavos)}. Projeção sem saques: ${fm(p.valorNoVencimentoCentavos)} no vencimento.`}
            onPointerMove={mover}
            onPointerLeave={() => setFoco(null)}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="evo__grade" />
                <text x={m.e - 10} y={y(v) + 4} textAnchor="end" className="evo__eixo">{curto(v)}</text>
              </g>
            ))}
            {pts.map((pt, i) =>
              (i % passoRotulo === 0 && (n - i >= passoRotulo / 2 || i === 0)) || i === n ? (
                <text key={i} x={x(i)} y={A - 10} textAnchor={i === 0 ? "start" : i === n ? "end" : "middle"} className="evo__eixo">
                  {rotuloPonto(pt, i)}
                </text>
              ) : null,
            )}
            {principalVisivel && <line x1={m.e} x2={L - m.d} y1={y(p.principalCentavos)} y2={y(p.principalCentavos)} className="evo__principal" />}
            <path d={area} className="evo__area" />
            <path d={projetada} className="evo__proj" />
            <path d={realizada} className="evo__real" />
            <line x1={x(iHoje)} x2={x(iHoje)} y1={m.t} y2={y(piso)} className="evo__hoje" />
            <circle cx={x(iHoje)} cy={y(p.saldoCentavos)} r={5} className="evo__ponto" />
            {!janela && <circle cx={x(n)} cy={y(pts[n]!.projetadoCentavos)} r={4} className="evo__ponto evo__ponto--proj" />}
            {!estreito && !janela && (
              <text x={x(n) - 8} y={y(pts[n]!.projetadoCentavos) - 10} textAnchor="end" className="evo__rot">
                {fm(pts[n]!.projetadoCentavos)}
              </text>
            )}
            {pf && foco !== null && (
              <g>
                <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={y(piso)} className="evo__mira" />
                <circle cx={x(foco)} cy={y(pf.projetadoCentavos)} r={4} className="evo__ponto evo__ponto--proj" />
                {pf.realizadoCentavos !== null && <circle cx={x(foco)} cy={y(pf.realizadoCentavos)} r={4} className="evo__ponto" />}
              </g>
            )}
          </svg>
          {pf && foco !== null && (
            <div className="evo__dica" style={{ left: Math.min(Math.max(x(foco), 90), L - 90) }} role="status">
              <strong>{pf.mes === -1 ? "Hoje" : pf.mes === 0 ? "Início" : `${pf.mes}º mês`} · {mesAno(pf.data)}</strong>
              {pf.realizadoCentavos !== null && <span><i className="evo__chave evo__chave--real" />Realizado {fm(pf.realizadoCentavos)}</span>}
              <span><i className="evo__chave evo__chave--proj" />Projeção {fm(pf.projetadoCentavos)}</span>
              <span className="evo__dica-sub">Juros acumulados {fm(pf.projetadoCentavos - p.principalCentavos)}</span>
            </div>
          )}
        </div>
      </figure>

      <details className="evo__tabela">
        <summary>Ver a projeção mês a mês</summary>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Mês</th><th>Data</th><th className="dir">Juros no mês</th><th className="dir">Saldo projetado</th><th className="dir">Realizado</th></tr></thead>
            <tbody>
              {p.pontos.slice(1).map((pt, k) => (
                <tr key={pt.mes}>
                  <td className="num">{pt.mes}º</td>
                  <td className="num">{dataBR(pt.data)}</td>
                  <td className="dir num">{fm(pt.projetadoCentavos - p.pontos[k]!.projetadoCentavos)}</td>
                  <td className="dir num">{fm(pt.projetadoCentavos)}</td>
                  <td className="dir num">{pt.realizadoCentavos !== null ? fm(pt.realizadoCentavos) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="bloco__nota">
        Projeção pré-fixada pela taxa do contrato, sem saques, igual à tabela progressiva. Valores brutos de IR. Saída antecipada do principal: D+
        {RESGATE_ANTECIPADO.liquidacaoDias}, com penalidade sobre a performance.
      </p>
    </div>
  );
}
