/**
 * Regras do lastro em operações de grãos, sem acesso a banco (testáveis).
 *
 * Três camadas por oferta:
 *  1. Operações: compra do produtor → transporte → venda → recebimento.
 *  2. Conta vinculada: todo dinheiro entra e sai por ela, em ordem de prioridade.
 *  3. Garantias: CCBs com imóvel, que formam o índice de cobertura.
 */

/** Prazos dos contratos. O principal é liquidado no vencimento com a recompra dos títulos pela Rio. */
export const PRAZOS_CONTRATO = [12, 24, 36] as const;
export const prazoValido = (meses: number) => (PRAZOS_CONTRATO as readonly number[]).includes(meses);

export const GRAOS = ["soja", "milho", "sorgo"] as const;
export type Grao = (typeof GRAOS)[number];
export const GRAO_ROTULO: Record<Grao, string> = { soja: "Soja", milho: "Milho", sorgo: "Sorgo" };

export const COMPRADOR_TIPOS = ["cerealista", "cooperativa", "industria", "trading", "outro"] as const;
export type CompradorTipo = (typeof COMPRADOR_TIPOS)[number];
export const COMPRADOR_ROTULO: Record<CompradorTipo, string> = {
  cerealista: "Cerealista",
  cooperativa: "Cooperativa",
  industria: "Indústria",
  trading: "Trading",
  outro: "Outro comprador",
};

export const STATUS_OPERACAO = ["em_analise", "comprada", "em_transporte", "vendida", "atrasada", "recebida", "cancelada"] as const;
export type StatusOperacao = (typeof STATUS_OPERACAO)[number];
export const STATUS_OPERACAO_ROTULO: Record<StatusOperacao, string> = {
  em_analise: "Em análise",
  comprada: "Grão comprado",
  em_transporte: "Em transporte",
  vendida: "Vendida, a receber",
  atrasada: "Recebimento atrasado",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

/** Para onde cada status pode ir. */
export const TRANSICOES: Record<StatusOperacao, readonly StatusOperacao[]> = {
  em_analise: ["comprada", "cancelada"],
  comprada: ["em_transporte", "vendida"],
  em_transporte: ["vendida"],
  vendida: ["recebida", "atrasada"],
  atrasada: ["recebida"],
  recebida: [],
  cancelada: [],
};

export const podeMudar = (de: StatusOperacao, para: StatusOperacao) => TRANSICOES[de].includes(para);

/** Ordem de pagamentos da conta vinculada (waterfall). */
export const WATERFALL = [
  "Recebimento do comprador do grão",
  "Impostos e custos autorizados da operação",
  "Principal dos investidores",
  "Remuneração dos investidores",
  "Margem da Rio",
] as const;

export const TIPOS_LANCAMENTO = [
  "aporte",
  "compra_graos",
  "custos",
  "recebimento_venda",
  "pagamento_rendimento",
  "pagamento_principal",
  "margem_rio",
  "ajuste",
] as const;
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export const LANCAMENTO_ROTULO: Record<TipoLancamento, string> = {
  aporte: "Aporte de investidor",
  compra_graos: "Compra de grãos",
  custos: "Impostos e custos",
  recebimento_venda: "Recebimento de venda",
  pagamento_rendimento: "Rendimento pago a investidor",
  pagamento_principal: "Principal devolvido a investidor",
  margem_rio: "Margem da Rio",
  ajuste: "Ajuste",
};

/** Sinal obrigatório de cada tipo. `ajuste` aceita os dois. */
export const SINAL: Record<TipoLancamento, 1 | -1 | 0> = {
  aporte: 1,
  recebimento_venda: 1,
  compra_graos: -1,
  custos: -1,
  pagamento_rendimento: -1,
  pagamento_principal: -1,
  margem_rio: -1,
  ajuste: 0,
};

/** Converte um valor positivo digitado no valor com sinal do lançamento. */
export function valorComSinal(tipo: TipoLancamento, valorCentavos: number): number {
  const s = SINAL[tipo];
  return s === 0 ? valorCentavos : s * Math.abs(valorCentavos);
}

export interface OperacaoResumo {
  grao: string;
  status: string;
  valorCompraCentavos: number;
  custosCentavos: number;
  valorVendaCentavos: number | null;
  valorRecebidoCentavos: number;
}

export interface GarantiaResumo {
  situacao: string;
  garantiaValorCentavos: number | null;
  valorElegivelCentavos: number | null;
}

/** Situações em que a garantia ainda protege a oferta. */
const GARANTIA_VALIDA = new Set(["adimplente", "atraso", "renegociada"]);

export const valorElegivel = (g: GarantiaResumo) =>
  GARANTIA_VALIDA.has(g.situacao) ? (g.valorElegivelCentavos ?? g.garantiaValorCentavos ?? 0) : 0;

/** Dinheiro que saiu da conta e está aplicado na operação. */
export const capitalDaOperacao = (o: OperacaoResumo) => o.valorCompraCentavos + o.custosCentavos;

/** Margem bruta da operação, quando já há preço de venda. */
export function margemDaOperacao(o: OperacaoResumo): { centavos: number; pct: number } | null {
  if (o.valorVendaCentavos == null) return null;
  const capital = capitalDaOperacao(o);
  const centavos = o.valorVendaCentavos - capital;
  return { centavos, pct: capital > 0 ? centavos / capital : 0 };
}

export interface PosicaoOferta {
  saldoContaCentavos: number;
  /** comprada ou em transporte: valor pago + custos */
  emOperacaoCentavos: number;
  /** vendida: falta receber do comprador */
  aReceberCentavos: number;
  /** atrasada: não entra na conta de ativos (critério conservador) */
  emAtrasoCentavos: number;
  ativosCentavos: number;
  obrigacoesCentavos: number;
  garantiasElegiveisCentavos: number;
  principalComprometidoCentavos: number;
  /** null quando não há principal comprometido */
  cobertura: number | null;
  coberturaMinima: number;
  travada: boolean;
  /** quanto da margem a Rio pode retirar sem passar na frente do investidor */
  margemLiberavelCentavos: number;
}

/**
 * Fotografia financeira da oferta.
 * `obrigacoes` = principal dos contratos ativos + rendimento acumulado ainda não pago.
 */
export function posicaoDaOferta(p: {
  saldoContaCentavos: number;
  operacoes: OperacaoResumo[];
  garantias: GarantiaResumo[];
  principalComprometidoCentavos: number;
  obrigacoesCentavos: number;
  coberturaMinima: number;
}): PosicaoOferta {
  let emOperacao = 0;
  let aReceber = 0;
  let emAtraso = 0;
  for (const o of p.operacoes) {
    if (o.status === "comprada" || o.status === "em_transporte") emOperacao += capitalDaOperacao(o);
    else if (o.status === "vendida") aReceber += Math.max(0, (o.valorVendaCentavos ?? 0) - o.valorRecebidoCentavos);
    else if (o.status === "atrasada") emAtraso += Math.max(0, (o.valorVendaCentavos ?? 0) - o.valorRecebidoCentavos);
  }
  const garantias = p.garantias.reduce((s, g) => s + valorElegivel(g), 0);
  const cobertura = p.principalComprometidoCentavos > 0 ? garantias / p.principalComprometidoCentavos : null;
  const travada = cobertura !== null && cobertura < p.coberturaMinima;
  const ativos = p.saldoContaCentavos + emOperacao + aReceber;
  const folga = ativos - p.obrigacoesCentavos;
  const margemLiberavel = travada ? 0 : Math.max(0, Math.min(p.saldoContaCentavos, folga));
  return {
    saldoContaCentavos: p.saldoContaCentavos,
    emOperacaoCentavos: emOperacao,
    aReceberCentavos: aReceber,
    emAtrasoCentavos: emAtraso,
    ativosCentavos: ativos,
    obrigacoesCentavos: p.obrigacoesCentavos,
    garantiasElegiveisCentavos: garantias,
    principalComprometidoCentavos: p.principalComprometidoCentavos,
    cobertura,
    coberturaMinima: p.coberturaMinima,
    travada,
    margemLiberavelCentavos: margemLiberavel,
  };
}

/** Cobertura se entrar mais `novoPrincipal`. Usada para travar contratos novos. */
export function coberturaProjetada(garantiasCentavos: number, principalAtualCentavos: number, novoPrincipalCentavos: number) {
  const total = principalAtualCentavos + novoPrincipalCentavos;
  return total > 0 ? garantiasCentavos / total : null;
}

export interface FatiaAlocacao {
  rotulo: string;
  grao: Grao | "caixa" | "a_receber";
  centavos: number;
  operacoes: number;
}

/**
 * Onde está o dinheiro de um contrato: a parte proporcional dele em cada grão
 * com operação aberta, no que falta receber e no caixa da conta vinculada.
 */
export function alocacaoDoContrato(p: {
  principalContratoCentavos: number;
  principalTotalCentavos: number;
  saldoContaCentavos: number;
  operacoes: OperacaoResumo[];
}): FatiaAlocacao[] {
  if (p.principalTotalCentavos <= 0 || p.principalContratoCentavos <= 0) return [];
  const fracao = p.principalContratoCentavos / p.principalTotalCentavos;
  const porGrao = new Map<Grao, { centavos: number; n: number }>();
  let aReceber = 0;
  let nReceber = 0;
  for (const o of p.operacoes) {
    if (o.status === "comprada" || o.status === "em_transporte") {
      const g = o.grao as Grao;
      const atual = porGrao.get(g) ?? { centavos: 0, n: 0 };
      porGrao.set(g, { centavos: atual.centavos + capitalDaOperacao(o), n: atual.n + 1 });
    } else if (o.status === "vendida" || o.status === "atrasada") {
      aReceber += Math.max(0, (o.valorVendaCentavos ?? 0) - o.valorRecebidoCentavos);
      nReceber += 1;
    }
  }
  const fatias: FatiaAlocacao[] = [];
  for (const g of GRAOS) {
    const v = porGrao.get(g);
    if (v && v.centavos > 0) fatias.push({ rotulo: GRAO_ROTULO[g], grao: g, centavos: Math.round(v.centavos * fracao), operacoes: v.n });
  }
  if (aReceber > 0) fatias.push({ rotulo: "Vendido, a receber", grao: "a_receber", centavos: Math.round(aReceber * fracao), operacoes: nReceber });
  if (p.saldoContaCentavos > 0) fatias.push({ rotulo: "Caixa na conta vinculada", grao: "caixa", centavos: Math.round(p.saldoContaCentavos * fracao), operacoes: 0 });
  return fatias;
}

export const formatarCobertura = (c: number | null) => (c === null ? "–" : `${Math.round(c * 100)}%`);
