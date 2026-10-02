/**
 * Saque do principal (puro, testado).
 *
 * No vencimento: a Rio recompra os títulos e o investidor recebe o saldo
 * (principal + juros ainda não sacados).
 *
 * Antes do vencimento (resgate antecipado, liquidado em D+60), o valor devido
 * segue a regra do tempo de permanência, e os juros já sacados são descontados:
 *   até 12 meses ........ principal, sem juros
 *   12 a 24 meses ....... principal corrigido pelo CDI do período
 *   24 a 36 meses ....... principal + 50% da performance acumulada
 */
import { aliquotaIR, mesesParaDiasCorridos } from "./finance";
import { RESGATE_ANTECIPADO } from "./lastroGraos";

export const PRAZO_PAGAMENTO_VENCIMENTO_DIAS = 7;

export interface EntradaResgatePrincipal {
  principalCentavos: number;
  prazoMeses: number;
  diasPermanencia: number;
  /** principal + juros não sacados, hoje */
  saldoCentavos: number;
  /** todo o rendimento gerado desde o início, sacado ou não */
  performanceCentavos: number;
  /** rendimento já pedido ou pago ao investidor */
  rendimentoSacadoCentavos: number;
  /** CDI anual do período (decimal), usado na faixa de 12 a 24 meses */
  cdiAnual: number;
}

export interface ResultadoResgatePrincipal {
  tipo: "vencimento" | "antecipado";
  regra: string;
  brutoCentavos: number;
  penalidadeCentavos: number;
  aliquotaIR: number;
  irCentavos: number;
  liquidoCentavos: number;
  prazoPagamentoDias: number;
}

export function calcularResgatePrincipal(e: EntradaResgatePrincipal): ResultadoResgatePrincipal {
  const diasPrazo = mesesParaDiasCorridos(e.prazoMeses);
  const aliquota = aliquotaIR(Math.max(e.diasPermanencia, 1));

  if (e.diasPermanencia >= diasPrazo) {
    const bruto = e.saldoCentavos;
    const ir = Math.round(Math.max(0, bruto - e.principalCentavos) * aliquota);
    return {
      tipo: "vencimento",
      regra: "Vencimento: recompra dos títulos pela Rio",
      brutoCentavos: bruto,
      penalidadeCentavos: 0,
      aliquotaIR: aliquota,
      irCentavos: ir,
      liquidoCentavos: bruto - ir,
      prazoPagamentoDias: PRAZO_PAGAMENTO_VENCIMENTO_DIAS,
    };
  }

  const [ate12, ate24, ate36] = RESGATE_ANTECIPADO.regras;
  let direito: number;
  let regra: string;
  if (e.diasPermanencia <= 365) {
    direito = e.principalCentavos;
    regra = `${ate12.faixa}: ${ate12.regra}`;
  } else if (e.diasPermanencia <= 730) {
    direito = e.principalCentavos * Math.pow(1 + e.cdiAnual, e.diasPermanencia / 365);
    regra = `${ate24.faixa}: ${ate24.regra}`;
  } else {
    direito = e.principalCentavos + 0.5 * e.performanceCentavos;
    regra = `${ate36.faixa}: ${ate36.regra}`;
  }
  const bruto = Math.max(0, Math.round(direito - e.rendimentoSacadoCentavos));
  const ir = Math.round(Math.max(0, bruto - e.principalCentavos) * aliquota);
  return {
    tipo: "antecipado",
    regra,
    brutoCentavos: bruto,
    penalidadeCentavos: Math.max(0, e.saldoCentavos - bruto),
    aliquotaIR: aliquota,
    irCentavos: ir,
    liquidoCentavos: bruto - ir,
    prazoPagamentoDias: RESGATE_ANTECIPADO.liquidacaoDias,
  };
}
