/**
 * Núcleo financeiro do RioRendeFácil.
 *
 * Regras de cálculo (todas puras, sem I/O, testadas em finance.test.ts):
 * - Valores monetários trabalham em centavos (inteiros) na borda, e em número
 *   de ponto flutuante só dentro do cálculo; o arredondamento é sempre no final.
 * - Modelo da tabela progressiva da Rio: a taxa mensal é NOMINAL. Os juros
 *   são creditados por dia e capitalizados: taxa diária = m ÷ 30, com 360 dias
 *   de capitalização a cada 365 corridos. Fator em d dias corridos:
 *   (1 + m/30)^(360·d/365). Em 12 meses: (1 + m/30)^360.
 *   Por isso a taxa efetiva fica um pouco acima da nominal (1,80% nominal
 *   rende 1,816% ao mês efetivo); a interface mostra as duas.
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

/** Dias de capitalização em um ano (12 meses de 30 dias). */
export const DIAS_CAPITALIZACAO_ANO = 360;

/** Fator de capitalização da tabela em `diasCorridos` dias corridos. */
export function fatorRio(taxaMensal: number, diasCorridos: number): number {
  if (taxaMensal < 0) throw new Error("Taxa mensal não pode ser negativa");
  return Math.pow(1 + taxaMensal / DIAS_MES_COMERCIAL, (DIAS_CAPITALIZACAO_ANO * diasCorridos) / 365);
}

/** Fator em meses cheios, exatamente como a tabela: (1 + m/30)^(30·meses). */
export function fatorMeses(taxaMensal: number, meses: number): number {
  return Math.pow(1 + taxaMensal / DIAS_MES_COMERCIAL, DIAS_MES_COMERCIAL * meses);
}

/** Taxa por dia corrido (o que é creditado no painel a cada dia). */
export function taxaDiariaEquivalente(taxaMensal: number): number {
  return fatorRio(taxaMensal, 1) - 1;
}

export function taxaMensalEfetiva(taxaMensal: number): number {
  return fatorMeses(taxaMensal, 1) - 1;
}

export function taxaAnualEquivalente(taxaMensal: number): number {
  return fatorMeses(taxaMensal, 12) - 1;
}

/** Taxa mensal nominal que, no modelo da tabela, rende `taxaAnual` em 12 meses. */
export function taxaMensalDeAnual(taxaAnual: number): number {
  return DIAS_MES_COMERCIAL * (Math.pow(1 + taxaAnual, 1 / DIAS_CAPITALIZACAO_ANO) - 1);
}

/** Juros de um mês de `dias` dias corridos sobre um saldo (a tabela usa janeiro, 31 dias). */
export function jurosDoMes(saldoCentavos: number, taxaMensal: number, dias = 30): number {
  return Math.round(saldoCentavos * (fatorRio(taxaMensal, dias) - 1));
}

/** Linha da tabela progressiva: juros do mês e valor acumulado no vencimento, sem resgates. */
export function linhaTabelaProgressiva(aporteCentavos: number, prazoMeses: number, taxaMensal: number) {
  return {
    aporteCentavos,
    prazoMeses,
    taxaMensal,
    jurosMesCentavos: jurosDoMes(aporteCentavos, taxaMensal, 31),
    resgateVencimentoCentavos: Math.round(aporteCentavos * fatorMeses(taxaMensal, prazoMeses)),
  };
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
  // Capitalização como na tabela: (1 + m/30)^(30 · meses); IR pela lei usa dias corridos.
  const diasCorridos = mesesParaDiasCorridos(prazoMeses);

  const evolucao: PontoEvolucao[] = [];
  for (let mes = 0; mes <= prazoMeses; mes++) {
    const bruto = aporteCentavos * fatorMeses(taxaMensal, mes);
    const rend = bruto - aporteCentavos;
    const liquido = aporteCentavos + rend * (1 - aliquotaIR(Math.max(mesesParaDiasCorridos(mes), 1)));
    evolucao.push({
      mes,
      brutoCentavos: Math.round(bruto),
      liquidoCentavos: Math.round(liquido),
    });
  }

  const saldoBruto = aporteCentavos * fatorMeses(taxaMensal, prazoMeses);
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

export interface ResgateNoTempo {
  /** dias corridos desde o início do contrato */
  dia: number;
  valorCentavos: number;
}

/**
 * Rendimento acumulado de uma posição, para o painel do investidor.
 * Juros diários compostos pela tabela; cada resgate de rendimento sai do saldo
 * na data do pedido e deixa de render a partir dali.
 * Aceita o total resgatado (número) quando as datas não importam.
 */
export function rendimentoAcumulado(
  principalCentavos: number,
  taxaMensal: number,
  diasDecorridos: number,
  resgates: number | ResgateNoTempo[] = 0,
): { brutoCentavos: number; disponivelCentavos: number; saldoCentavos: number } {
  const lista =
    typeof resgates === "number"
      ? resgates > 0
        ? [{ dia: diasDecorridos, valorCentavos: resgates }]
        : []
      : [...resgates].sort((a, b) => a.dia - b.dia);
  let saldo = principalCentavos;
  let ultimo = 0;
  let resgatado = 0;
  for (const r of lista) {
    const dia = Math.min(Math.max(r.dia, ultimo), diasDecorridos);
    saldo = saldo * fatorRio(taxaMensal, dia - ultimo) - r.valorCentavos;
    ultimo = dia;
    resgatado += r.valorCentavos;
  }
  saldo *= fatorRio(taxaMensal, diasDecorridos - ultimo);
  return {
    brutoCentavos: Math.round(saldo - principalCentavos + resgatado),
    disponivelCentavos: Math.max(0, Math.round(saldo - principalCentavos)),
    saldoCentavos: Math.round(Math.max(saldo, principalCentavos)),
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
