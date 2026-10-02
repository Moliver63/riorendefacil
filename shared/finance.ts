/**
 * Núcleo financeiro do RioRendeFácil.
 *
 * Regras de cálculo (todas puras, sem I/O, testadas em finance.test.ts):
 * - Valores monetários trabalham em centavos (inteiros) na borda, e em número
 *   de ponto flutuante só dentro do cálculo; o arredondamento é sempre no final.
 * - Taxa mensal é convertida para taxa diária EQUIVALENTE composta:
 *   (1 + m)^(1/30) - 1, mês comercial de 30 dias. Isso evita o atalho
 *   "taxa mensal ÷ 30" capitalizada diariamente, que entrega mais do que a taxa
 *   mensal anunciada e infla a comparação com o mercado.
 * - Rentabilidade é sempre exibida BRUTA e LÍQUIDA de IR (tabela regressiva).
 *   O padrão da interface é o líquido.
 */

export const DIAS_MES_COMERCIAL = 30;

export type Faixa = {
  /** valor mínimo do aporte em centavos */
  minimoCentavos: number;
  /** prazo mínimo em meses para essa faixa valer */
  prazoMinimoMeses: number;
  /** taxa mensal máxima em decimal (0.015 = 1,5% a.m.) */
  taxaMensalTeto: number;
};

/** Tabela regressiva de IR sobre renda fixa (prazo em dias corridos). */
export function aliquotaIR(diasCorridos: number): number {
  if (diasCorridos <= 180) return 0.225;
  if (diasCorridos <= 360) return 0.2;
  if (diasCorridos <= 720) return 0.175;
  return 0.15;
}

/** Converte meses em dias corridos (ano de 365,25 dias), para fins de IR. */
export function mesesParaDiasCorridos(meses: number): number {
  return Math.round((meses * 365.25) / 12);
}

export function taxaDiariaEquivalente(taxaMensal: number): number {
  if (taxaMensal < 0) throw new Error("Taxa mensal não pode ser negativa");
  return Math.pow(1 + taxaMensal, 1 / DIAS_MES_COMERCIAL) - 1;
}

export function taxaAnualEquivalente(taxaMensal: number): number {
  return Math.pow(1 + taxaMensal, 12) - 1;
}

export function taxaMensalDeAnual(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/**
 * Teto de taxa aplicável a um aporte, dado o quadro de faixas do emissor.
 * Retorna null quando nenhuma faixa cobre o aporte/prazo.
 */
export function tetoDaFaixa(
  faixas: Faixa[],
  aporteCentavos: number,
  prazoMeses: number,
): number | null {
  const validas = faixas.filter(
    (f) => aporteCentavos >= f.minimoCentavos && prazoMeses >= f.prazoMinimoMeses,
  );
  if (validas.length === 0) return null;
  return Math.max(...validas.map((f) => f.taxaMensalTeto));
}

/** Próxima faixa acima da atual, para mostrar "para subir de faixa". */
export function proximaFaixa(
  faixas: Faixa[],
  aporteCentavos: number,
  prazoMeses: number,
): Faixa | null {
  const atual = tetoDaFaixa(faixas, aporteCentavos, prazoMeses) ?? 0;
  const acima = faixas
    .filter((f) => f.taxaMensalTeto > atual)
    .sort((a, b) => a.taxaMensalTeto - b.taxaMensalTeto);
  return acima[0] ?? null;
}

export type PontoEvolucao = {
  mes: number;
  brutoCentavos: number;
  liquidoCentavos: number;
};

export type ResultadoSimulacao = {
  aporteCentavos: number;
  prazoMeses: number;
  diasCorridos: number;
  taxaMensal: number;
  taxaDiaria: number;
  taxaAnual: number;
  rendimentoBrutoCentavos: number;
  irCentavos: number;
  aliquotaIR: number;
  rendimentoLiquidoCentavos: number;
  saldoBrutoCentavos: number;
  saldoLiquidoCentavos: number;
  rentabilidadeLiquidaPct: number;
  evolucao: PontoEvolucao[];
};

/**
 * Simula aporte único capitalizado dia a dia, sem resgates no período.
 * IR é aplicado sobre o rendimento total na data do vencimento.
 */
export function simular(
  aporteCentavos: number,
  prazoMeses: number,
  taxaMensal: number,
): ResultadoSimulacao {
  if (!Number.isFinite(aporteCentavos) || aporteCentavos <= 0) {
    throw new Error("Aporte deve ser positivo");
  }
  if (!Number.isInteger(prazoMeses) || prazoMeses < 1) {
    throw new Error("Prazo deve ser um número inteiro de meses >= 1");
  }

  const taxaDiaria = taxaDiariaEquivalente(taxaMensal);
  // Capitalização em mês comercial (30 dias); IR pela lei usa dias corridos.
  const diasCapitalizacao = prazoMeses * DIAS_MES_COMERCIAL;
  const diasCorridos = mesesParaDiasCorridos(prazoMeses);

  const evolucao: PontoEvolucao[] = [];
  for (let mes = 0; mes <= prazoMeses; mes++) {
    const dias = mes * DIAS_MES_COMERCIAL;
    const bruto = aporteCentavos * Math.pow(1 + taxaDiaria, dias);
    const rend = bruto - aporteCentavos;
    const liquido = aporteCentavos + rend * (1 - aliquotaIR(Math.max(mesesParaDiasCorridos(mes), 1)));
    evolucao.push({
      mes,
      brutoCentavos: Math.round(bruto),
      liquidoCentavos: Math.round(liquido),
    });
  }

  const saldoBruto = aporteCentavos * Math.pow(1 + taxaDiaria, diasCapitalizacao);
  const rendimentoBruto = saldoBruto - aporteCentavos;
  const aliquota = aliquotaIR(diasCorridos);
  const ir = rendimentoBruto * aliquota;
  const rendimentoLiquido = rendimentoBruto - ir;

  return {
    aporteCentavos,
    prazoMeses,
    diasCorridos,
    taxaMensal,
    taxaDiaria,
    taxaAnual: taxaAnualEquivalente(taxaMensal),
    rendimentoBrutoCentavos: Math.round(rendimentoBruto),
    irCentavos: Math.round(ir),
    aliquotaIR: aliquota,
    rendimentoLiquidoCentavos: Math.round(rendimentoLiquido),
    saldoBrutoCentavos: Math.round(saldoBruto),
    saldoLiquidoCentavos: Math.round(aporteCentavos + rendimentoLiquido),
    rentabilidadeLiquidaPct: rendimentoLiquido / aporteCentavos,
    evolucao,
  };
}

export type Referencia = {
  nome: string;
  /** taxa anual em decimal */
  taxaAnual: number;
  /** true quando o rendimento é isento de IR para pessoa física */
  isento: boolean;
};

/**
 * Compara a simulação com referências de mercado SEMPRE em base líquida.
 * Poupança isenta não sofre IR; CDB/CDI sofrem a mesma tabela regressiva.
 */
export function compararLiquido(
  aporteCentavos: number,
  prazoMeses: number,
  referencias: Referencia[],
): { nome: string; saldoLiquidoCentavos: number }[] {
  return referencias.map((r) => {
    const mensal = taxaMensalDeAnual(r.taxaAnual);
    const sim = simular(aporteCentavos, prazoMeses, mensal);
    return {
      nome: r.nome,
      saldoLiquidoCentavos: r.isento ? sim.saldoBrutoCentavos : sim.saldoLiquidoCentavos,
    };
  });
}

/**
 * Rendimento diário acumulado de uma posição, para o painel do investidor.
 * Considera resgates de rendimento já pagos.
 */
export function rendimentoAcumulado(
  principalCentavos: number,
  taxaMensal: number,
  diasDecorridos: number,
  resgatesPagosCentavos = 0,
): { brutoCentavos: number; disponivelCentavos: number } {
  // Modelo "rendimento sacável": os juros não capitalizam e o principal fica
  // travado, então o rendimento é linear pro rata (30 dias = taxa mensal cheia).
  // Usar a taxa diária composta aqui pagaria menos que a taxa contratada.
  const bruto = (principalCentavos * taxaMensal * diasDecorridos) / DIAS_MES_COMERCIAL;
  return {
    brutoCentavos: Math.round(bruto),
    disponivelCentavos: Math.max(0, Math.round(bruto - resgatesPagosCentavos)),
  };
}

/** Data de pagamento de um pedido de resgate de rendimento (D+N corridos). */
export function dataPagamentoResgate(pedido: Date, prazoDias = 7): Date {
  const d = new Date(pedido.getTime());
  d.setUTCDate(d.getUTCDate() + prazoDias);
  return d;
}

export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarPct(decimal: number, casas = 2): string {
  return `${(decimal * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}
