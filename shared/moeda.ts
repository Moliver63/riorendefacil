/**
 * Moeda das aplicações e conversão cambial, sem acesso a banco (testável).
 *
 * Cada aplicação guarda os valores na própria moeda (centavos de real ou de
 * dólar). A conversão para real usa sempre uma cotação registrada, com data e
 * fonte, e aparece na tela junto do valor convertido.
 */

export const MOEDAS = ["BRL", "USD"] as const;
export type Moeda = (typeof MOEDAS)[number];

export const MOEDA_ROTULO: Record<Moeda, string> = { BRL: "Real (BRL)", USD: "Dólar (USD)" };

export function formatarMoeda(centavos: number, moeda: Moeda | string = "BRL"): string {
  if (moeda === "USD") {
    return `US$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Rótulo curto para eixos de gráfico: "R$ 1,2 mi", "US$ 350 mil". */
export function formatarCurto(centavos: number, moeda: Moeda | string = "BRL"): string {
  const s = moeda === "USD" ? "US$" : "R$";
  const v = centavos / 100;
  if (Math.abs(v) >= 1_000_000) return `${s} ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (Math.abs(v) >= 1_000) return `${s} ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${s} ${Math.round(v).toLocaleString("pt-BR")}`;
}

export interface Cotacao {
  moeda: Moeda;
  /** reais por 1 unidade da moeda (ex.: 5.4321) */
  valor: number;
  /** data da cotação, AAAA-MM-DD */
  data: string;
  fonte: string;
}

/** Converte centavos da moeda da aplicação para centavos de real. Sem cotação para USD, devolve null. */
export function paraReais(centavos: number, moeda: Moeda | string, cotacao: Pick<Cotacao, "valor"> | null | undefined): number | null {
  if (moeda === "BRL") return centavos;
  if (!cotacao || !(cotacao.valor > 0)) return null;
  return Math.round(centavos * cotacao.valor);
}

/** Leva centavos de real para a moeda pedida (para exibir totais em dólar). Sem cotação, null. */
export function deReais(centavosReais: number, moeda: Moeda | string, cotacao: Pick<Cotacao, "valor"> | null | undefined): number | null {
  if (moeda === "BRL") return centavosReais;
  if (!cotacao || !(cotacao.valor > 0)) return null;
  return Math.round(centavosReais / cotacao.valor);
}

/** Converte a cotação PTAX de venda do Banco Central (dataHoraCotacao "2026-11-06 13:09:28.123") em Cotacao. */
export function cotacaoDaPtax(r: { cotacaoVenda: number; dataHoraCotacao: string }): Cotacao {
  return { moeda: "USD", valor: r.cotacaoVenda, data: r.dataHoraCotacao.slice(0, 10), fonte: "PTAX venda · Banco Central do Brasil" };
}

/**
 * Situação da aplicação para o investidor, no formato pedido no app:
 * ativa (rendendo), vencida (passou do vencimento e ainda não foi liquidada),
 * liquidada (encerrada com o pagamento), pendente (antes do aporte) e cancelada.
 */
export type SituacaoAplicacao = "ativa" | "vencida" | "liquidada" | "pendente" | "cancelada";

export const SITUACAO_ROTULO: Record<SituacaoAplicacao, string> = {
  ativa: "Ativa",
  vencida: "Vencida",
  liquidada: "Liquidada",
  pendente: "Aguardando aporte",
  cancelada: "Cancelada",
};

export function situacaoAplicacao(status: string, vencimento: string | null, hoje: string): SituacaoAplicacao {
  if (status === "liquidado") return "liquidada";
  if (status === "cancelado") return "cancelada";
  if (status === "vencido") return "vencida";
  if (status === "ativo") return vencimento && hoje >= vencimento ? "vencida" : "ativa";
  return "pendente";
}

/**
 * Rentabilidade acumulada da aplicação: tudo o que rendeu (saldo atual + o que
 * já foi sacado de rendimento − principal) sobre o principal.
 */
export function rentabilidadeAcumulada(principalCentavos: number, saldoCentavos: number, resgatadoCentavos: number) {
  const rendimentoCentavos = saldoCentavos + resgatadoCentavos - principalCentavos;
  return { rendimentoCentavos, pct: principalCentavos > 0 ? rendimentoCentavos / principalCentavos : 0 };
}
