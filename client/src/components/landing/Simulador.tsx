import { PRAZOS_CONTRATO } from "~shared/lastroGraos";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatarBRL, formatarPct } from "~shared/finance";

const APORTES = [5_000, 10_000, 30_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export function Simulador({ onSimular }: { onSimular?: (s: { aporte: number; prazo: number; saldoLiquido: number }) => void }) {
  const [idxAporte, setIdxAporte] = useState(4);
  const [prazo, setPrazo] = useState(12);
  const [liquido, setLiquido] = useState(true);
  const aporte = APORTES[idxAporte] ?? 100_000;

  const status = trpc.plataforma.status.useQuery();
  const q = trpc.simulador.calcular.useQuery(
    { aporteCentavos: aporte * 100, prazoMeses: prazo },
    { placeholderData: (prev) => prev },
  );
  const d = q.data;

  const r = d?.elegivel ? d.resultado : null;
  const saldo = r ? (liquido ? r.saldoLiquidoCentavos : r.saldoBrutoCentavos) : 0;
  const rend = r ? (liquido ? r.rendimentoLiquidoCentavos : r.rendimentoBrutoCentavos) : 0;

  const barras = useMemo(() => {
    if (!d?.elegivel || !r) return [];
    const itens = [{ nome: "Nesta simulação", valor: r.saldoLiquidoCentavos, destaque: true }].concat(
      d.comparacao.map((c) => ({ nome: c.nome, valor: c.saldoLiquidoCentavos, destaque: false })),
    );
    const max = Math.max(...itens.map((i) => i.valor - r.aporteCentavos), 1);
    return itens.map((i) => ({ ...i, pct: Math.max(4, ((i.valor - r.aporteCentavos) / max) * 100) }));
  }, [d, r]);

  return (
    <div className="sim">
      <div className="sim__controles">
        <div className="campo">
          <div className="campo__topo">
            <label htmlFor="aporte">Valor do aporte</label>
            <output className="num">{formatarBRL(aporte * 100)}</output>
          </div>
          <input
            id="aporte"
            type="range"
            min={0}
            max={APORTES.length - 1}
            step={1}
            value={idxAporte}
            onChange={(e) => setIdxAporte(Number(e.target.value))}
          />
          <div className="campo__escala">
            <span>R$ 5 mil</span>
            <span>R$ 1 mi</span>
          </div>
        </div>

        <div className="campo">
          <div className="campo__topo">
            <span id="prazo" className="campo__rot">Prazo</span>
            <output className="num">{prazo} meses</output>
          </div>
          <div className="prazos" role="radiogroup" aria-labelledby="prazo">
            {PRAZOS_CONTRATO.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={prazo === p} className={prazo === p ? "on" : ""} onClick={() => setPrazo(p)}>
                {p} meses
              </button>
            ))}
          </div>
        </div>

        {d?.elegivel && (
          <div className="faixa">
            <div>
              <span className="faixa__rot">Teto da sua faixa</span>
              <strong className="num">{formatarPct(d.teto)} a.m.</strong>
              <span className="faixa__det num">{formatarPct(d.resultado.taxaAnual)} a.a. equivalente</span>
            </div>
            {d.proxima && (
              <p className="faixa__prox">
                Faixa seguinte: a partir de {formatarBRL(d.proxima.minimoCentavos)} e {d.proxima.prazoMinimoMeses} meses,
                teto de {formatarPct(d.proxima.taxaMensalTeto)} a.m.
              </p>
            )}
          </div>
        )}

        {d?.elegivel && d.exemplo && (
          <p className="sim__exemplo">
            Taxas de exemplo para demonstração. O quadro oficial será o do emissor parceiro.
          </p>
        )}
      </div>

      <div className="sim__resultado" aria-live="polite">
        <div className="alternar" role="group" aria-label="Base de cálculo">
          <button className={liquido ? "on" : ""} onClick={() => setLiquido(true)} aria-pressed={liquido}>
            Líquido de IR
          </button>
          <button className={!liquido ? "on" : ""} onClick={() => setLiquido(false)} aria-pressed={!liquido}>
            Bruto
          </button>
        </div>

        {r ? (
          <>
            <span className="sim__rot">Saldo ao final, {liquido ? "já descontado o IR" : "antes do IR"}</span>
            <strong className="sim__saldo num">{formatarBRL(saldo)}</strong>
            <dl className="sim__linhas">
              <div>
                <dt>Rendimento</dt>
                <dd className="num">+ {formatarBRL(rend)}</dd>
              </div>
              <div>
                <dt>IR retido ({formatarPct(r.aliquotaIR, 1)})</dt>
                <dd className="num">− {formatarBRL(r.irCentavos)}</dd>
              </div>
              <div>
                <dt>Resgate do rendimento</dt>
                <dd>D+{status.data?.prazoResgateDias ?? 7}</dd>
              </div>
            </dl>

            <div className="comp">
              <span className="comp__tit">
                Mesmo valor e prazo, todos líquidos de IR · ref. {status.data?.referencias.dataReferencia}
              </span>
              {barras.map((b) => (
                <div key={b.nome} className={`comp__lin ${b.destaque ? "comp__lin--dest" : ""}`}>
                  <span className="comp__nome">{b.nome}</span>
                  <span className="comp__barra">
                    <i style={{ width: `${b.pct}%` }} />
                  </span>
                  <span className="comp__val num">{formatarBRL(b.valor)}</span>
                </div>
              ))}
              <p className="comp__nota">
                Poupança é isenta de IR para pessoa física e tem cobertura do FGC. Esta operação não tem FGC e envolve
                risco de crédito.
              </p>
            </div>

            {onSimular && (
              <button className="btn btn--primario btn--largo" onClick={() => onSimular({ aporte, prazo, saldoLiquido: r.saldoLiquidoCentavos })}>
                Quero entender essa estrutura
              </button>
            )}
          </>
        ) : d && !d.elegivel ? (
          <p>Aporte mínimo de {formatarBRL(d.minimoCentavos)}.</p>
        ) : (
          <p className="carregando">Calculando…</p>
        )}
      </div>
    </div>
  );
}
