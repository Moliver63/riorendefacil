import { useEffect, useRef, useState } from "react";
import { formatarBRL, formatarPct, taxaAnualEquivalente } from "~shared/finance";
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
}

const dataBR = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
const mesAno = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "");
const curto = (c: number) =>
  c >= 1_000_000_00 ? `R$ ${(c / 100_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : `R$ ${Math.round(c / 100_000).toLocaleString("pt-BR")} mil`;

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
  const pts = p.pontos;
  if (pts.length < 2) return null;

  const estreito = L < 520;
  const A = estreito ? 240 : 300;
  const m = { e: estreito ? 58 : 76, d: 16, t: 20, b: 34 };
  const max = Math.max(...pts.map((x) => x.projetadoCentavos)) * 1.04;
  const ticks = marcas(max);
  const topo = ticks.at(-1)!;
  const n = pts.length - 1;
  const x = (i: number) => m.e + (i / n) * (L - m.e - m.d);
  const y = (v: number) => m.t + (1 - v / topo) * (A - m.t - m.b);

  const projetada = pts.map((pt, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(pt.projetadoCentavos).toFixed(1)}`).join(" ");
  const reais = pts.map((pt, i) => ({ i, v: pt.realizadoCentavos })).filter((r): r is { i: number; v: number } => r.v !== null);
  // ponto de hoje entre dois meses: interpola pela data
  const t0 = new Date(pts[0]!.data).getTime();
  const t1 = new Date(pts[n]!.data).getTime();
  const iHoje = Math.min(n, Math.max(0, ((new Date(p.hoje).getTime() - t0) / (t1 - t0)) * n));
  const realizada = [...reais.map((r) => `${x(r.i).toFixed(1)},${y(r.v).toFixed(1)}`), `${x(iHoje).toFixed(1)},${y(p.saldoCentavos).toFixed(1)}`]
    .map((c, k) => `${k ? "L" : "M"}${c}`)
    .join(" ");
  const area = `${realizada} L${x(iHoje).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
  const passoRotulo = estreito ? Math.ceil(n / 2) : n <= 12 ? 3 : 6;

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
        <div><dt>Saldo hoje</dt><dd className="num">{formatarBRL(p.saldoCentavos)}</dd><small>principal + juros não sacados</small></div>
        <div><dt>Juros nos próximos 30 dias</dt><dd className="num">{formatarBRL(p.jurosProximoMesCentavos)}</dd><small>creditados por dia, saque em D+{p.prazoResgateDias}</small></div>
        <div><dt>Acumulado no vencimento</dt><dd className="num">{formatarBRL(p.valorNoVencimentoCentavos)}</dd><small>{p.vencimento ? `em ${dataBR(p.vencimento)}, ` : ""}se não houver saques</small></div>
        <div><dt>Taxa</dt><dd className="num">{formatarPct(p.taxaMensal)} <small>a.m. nominal</small></dd><small>{formatarPct(p.taxaMensalEfetiva, 3)} efetiva · {formatarPct(taxaAnualEquivalente(p.taxaMensal))} a.a.</small></div>
      </dl>

      <figure className="evo__fig" ref={ref}>
        <figcaption className="evo__legenda">
          <span><i className="evo__chave evo__chave--real" aria-hidden="true" />Realizado até hoje</span>
          <span><i className="evo__chave evo__chave--proj" aria-hidden="true" />Projeção sem saques</span>
          <span><i className="evo__chave evo__chave--princ" aria-hidden="true" />Principal</span>
        </figcaption>
        <div className="evo__plot">
          <svg
            width={L}
            height={A}
            viewBox={`0 0 ${L} ${A}`}
            role="img"
            aria-label={`Saldo hoje ${formatarBRL(p.saldoCentavos)}. Projeção sem saques: ${formatarBRL(p.valorNoVencimentoCentavos)} no vencimento.`}
            onPointerMove={mover}
            onPointerLeave={() => setFoco(null)}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} className="evo__grade" />
                <text x={m.e - 10} y={y(v) + 4} textAnchor="end" className="evo__eixo">{v === 0 ? "R$ 0" : curto(v)}</text>
              </g>
            ))}
            {pts.map((pt, i) =>
              (i % passoRotulo === 0 && (n - i >= passoRotulo / 2 || i === 0)) || i === n ? (
                <text key={i} x={x(i)} y={A - 10} textAnchor={i === 0 ? "start" : i === n ? "end" : "middle"} className="evo__eixo">
                  {i === 0 ? "início" : `${i}º mês`}
                </text>
              ) : null,
            )}
            <line x1={m.e} x2={L - m.d} y1={y(p.principalCentavos)} y2={y(p.principalCentavos)} className="evo__principal" />
            <path d={area} className="evo__area" />
            <path d={projetada} className="evo__proj" />
            <path d={realizada} className="evo__real" />
            <line x1={x(iHoje)} x2={x(iHoje)} y1={m.t} y2={y(0)} className="evo__hoje" />
            <circle cx={x(iHoje)} cy={y(p.saldoCentavos)} r={5} className="evo__ponto" />
            <circle cx={x(n)} cy={y(pts[n]!.projetadoCentavos)} r={4} className="evo__ponto evo__ponto--proj" />
            {!estreito && (
              <text x={x(n) - 8} y={y(pts[n]!.projetadoCentavos) - 10} textAnchor="end" className="evo__rot">
                {formatarBRL(pts[n]!.projetadoCentavos)}
              </text>
            )}
            {pf && foco !== null && (
              <g>
                <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={y(0)} className="evo__mira" />
                <circle cx={x(foco)} cy={y(pf.projetadoCentavos)} r={4} className="evo__ponto evo__ponto--proj" />
                {pf.realizadoCentavos !== null && <circle cx={x(foco)} cy={y(pf.realizadoCentavos)} r={4} className="evo__ponto" />}
              </g>
            )}
          </svg>
          {pf && foco !== null && (
            <div className="evo__dica" style={{ left: Math.min(Math.max(x(foco), 90), L - 90) }} role="status">
              <strong>{foco === 0 ? "Início" : `${foco}º mês`} · {mesAno(pf.data)}</strong>
              {pf.realizadoCentavos !== null && <span><i className="evo__chave evo__chave--real" />Realizado {formatarBRL(pf.realizadoCentavos)}</span>}
              <span><i className="evo__chave evo__chave--proj" />Projeção {formatarBRL(pf.projetadoCentavos)}</span>
              <span className="evo__dica-sub">Juros acumulados {formatarBRL(pf.projetadoCentavos - p.principalCentavos)}</span>
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
              {pts.slice(1).map((pt, k) => (
                <tr key={pt.mes}>
                  <td className="num">{pt.mes}º</td>
                  <td className="num">{dataBR(pt.data)}</td>
                  <td className="dir num">{formatarBRL(pt.projetadoCentavos - pts[k]!.projetadoCentavos)}</td>
                  <td className="dir num">{formatarBRL(pt.projetadoCentavos)}</td>
                  <td className="dir num">{pt.realizadoCentavos !== null ? formatarBRL(pt.realizadoCentavos) : "–"}</td>
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
