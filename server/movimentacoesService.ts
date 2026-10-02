/**
 * Depósitos e saques do principal. As regras de valor estão em
 * shared/resgatePrincipal.ts; aqui só se busca o que o cálculo precisa.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { depositos, resgatesPrincipal, type Contrato } from "./schema";
import { diasDesde, resgatesDoContrato } from "./contratoService";
import { rendimentoAcumulado, dataPagamentoResgate } from "../shared/finance";
import { calcularResgatePrincipal } from "../shared/resgatePrincipal";
import { REFERENCIAS_MERCADO } from "../shared/mercado";

export const STATUS_SAQUE_ABERTO = ["solicitado", "aprovado"] as const;

/** CDI anual de referência (atualizado em shared/mercado.ts). */
export function cdiAnualReferencia(): number {
  return REFERENCIAS_MERCADO.itens.find((i) => i.nome.includes("CDI"))?.taxaAnual ?? 0;
}

/** Saldo, performance total e rendimento já sacado de um contrato ativo. */
export async function posicaoDoContrato(c: Contrato, hoje = new Date()) {
  const rs = await resgatesDoContrato(c);
  const dias = diasDesde(c.inicio, hoje);
  const r = rendimentoAcumulado(c.principalCentavos, Number(c.taxaMensal), dias, rs);
  const sacado = rs.reduce((t, x) => t + x.valorCentavos, 0);
  return { dias, saldoCentavos: r.saldoCentavos, performanceCentavos: r.brutoCentavos, rendimentoSacadoCentavos: sacado };
}

export async function previaSaquePrincipal(c: Contrato, hoje = new Date()) {
  const pos = await posicaoDoContrato(c, hoje);
  const calc = calcularResgatePrincipal({
    principalCentavos: c.principalCentavos,
    prazoMeses: c.prazoMeses,
    diasPermanencia: pos.dias,
    saldoCentavos: pos.saldoCentavos,
    performanceCentavos: pos.performanceCentavos,
    rendimentoSacadoCentavos: pos.rendimentoSacadoCentavos,
    cdiAnual: cdiAnualReferencia(),
  });
  // no vencimento, paga a partir da data de vencimento; antes, conta do pedido
  const base = calc.tipo === "vencimento" && c.vencimento && new Date(c.vencimento + "T12:00:00Z") > hoje ? new Date(c.vencimento + "T12:00:00Z") : hoje;
  return { ...pos, ...calc, previstoPara: dataPagamentoResgate(base, calc.prazoPagamentoDias).toISOString().slice(0, 10) };
}

export async function saquePrincipalAberto(contratoId: number) {
  const [r] = await db
    .select()
    .from(resgatesPrincipal)
    .where(and(eq(resgatesPrincipal.contratoId, contratoId), inArray(resgatesPrincipal.status, [...STATUS_SAQUE_ABERTO])))
    .limit(1);
  return r ?? null;
}

export async function depositoAberto(contratoId: number) {
  const [d] = await db
    .select()
    .from(depositos)
    .where(and(eq(depositos.contratoId, contratoId), eq(depositos.status, "informado")))
    .orderBy(desc(depositos.criadoEm))
    .limit(1);
  return d ?? null;
}
