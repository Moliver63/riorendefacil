/**
 * Lastro em operações de grãos: posição da oferta, conta vinculada e travas.
 * As contas ficam em shared/lastroGraos.ts; aqui só se busca o que elas precisam.
 */
import { and, asc, desc, eq, inArray, sum } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "./db";
import { ccbs, contratos, lancamentosConta, ofertas, operacoesGraos, type Oferta } from "./schema";
import { diasDesde, resgatesDoContrato } from "./contratoService";
import { saquePrincipalAberto } from "./movimentacoesService";
import { rendimentoAcumulado } from "../shared/finance";
import { alocacaoDoContrato, coberturaProjetada, posicaoDaOferta, valorComSinal, valorElegivel, type TipoLancamento } from "../shared/lastroGraos";

/** Status de contrato cujo principal já está comprometido com a oferta. */
export const STATUS_COMPROMETIDO = ["aguardando_assinatura", "aguardando_aporte", "ativo"] as const;

export async function getOferta(id: number): Promise<Oferta> {
  const [o] = await db.select().from(ofertas).where(eq(ofertas.id, id)).limit(1);
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Oferta não encontrada." });
  return o;
}

export async function saldoConta(ofertaId: number): Promise<number> {
  const [r] = await db.select({ total: sum(lancamentosConta.valorCentavos) }).from(lancamentosConta).where(eq(lancamentosConta.ofertaId, ofertaId));
  return Number(r?.total ?? 0);
}

export async function lancar(p: {
  ofertaId: number;
  tipo: TipoLancamento;
  valorCentavos: number;
  descricao: string;
  data?: string;
  operacaoId?: number;
  contratoId?: number;
  resgateId?: number;
  comprovanteChave?: string;
  criadoPor?: number;
}) {
  const [l] = await db
    .insert(lancamentosConta)
    .values({
      ofertaId: p.ofertaId,
      tipo: p.tipo,
      valorCentavos: valorComSinal(p.tipo, p.valorCentavos),
      descricao: p.descricao,
      data: p.data ?? new Date().toISOString().slice(0, 10),
      operacaoId: p.operacaoId,
      contratoId: p.contratoId,
      resgateId: p.resgateId,
      comprovanteChave: p.comprovanteChave,
      criadoPor: p.criadoPor,
    })
    .returning();
  return l!;
}

async function contratosDaOferta(ofertaId: number) {
  return db
    .select()
    .from(contratos)
    .where(and(eq(contratos.ofertaId, ofertaId), inArray(contratos.status, [...STATUS_COMPROMETIDO])));
}

/** Tudo o que a oferta tem e deve, num retrato só. */
export async function posicao(ofertaId: number, hoje = new Date()) {
  const oferta = await getOferta(ofertaId);
  const [saldo, ops, garantias, cs] = await Promise.all([
    saldoConta(ofertaId),
    db.select().from(operacoesGraos).where(eq(operacoesGraos.ofertaId, ofertaId)).orderBy(desc(operacoesGraos.criadoEm)),
    db.select().from(ccbs).where(eq(ccbs.ofertaId, ofertaId)).orderBy(asc(ccbs.codigo)),
    contratosDaOferta(ofertaId),
  ]);
  let obrigacoes = 0;
  let principalAtivo = 0;
  for (const c of cs) {
    if (c.status !== "ativo") continue;
    principalAtivo += c.principalCentavos;
    // saldo do investidor hoje (juros compostos, resgates fora) + resgates pedidos e ainda não pagos
    const rs = await resgatesDoContrato(c);
    const pendentes = rs.filter((r) => r.status !== "pago").reduce((t, r) => t + r.valorCentavos, 0);
    const saquePrincipal = await saquePrincipalAberto(c.id);
    // com saque do principal pedido, o devido é o valor congelado no pedido
    const saldo = saquePrincipal
      ? saquePrincipal.brutoCentavos
      : rendimentoAcumulado(c.principalCentavos, Number(c.taxaMensal), diasDesde(c.inicio, hoje), rs).saldoCentavos;
    obrigacoes += saldo + pendentes;
  }
  const principalComprometido = cs.reduce((s, c) => s + c.principalCentavos, 0);
  const pos = posicaoDaOferta({
    saldoContaCentavos: saldo,
    operacoes: ops,
    garantias,
    principalComprometidoCentavos: principalComprometido,
    obrigacoesCentavos: obrigacoes,
    coberturaMinima: Number(oferta.coberturaMinima),
  });
  return { oferta, posicao: pos, operacoes: ops, garantias, principalAtivoCentavos: principalAtivo };
}

/** Trava de captação: o novo contrato não pode derrubar a cobertura abaixo do mínimo. */
export async function exigirCoberturaParaNovoPrincipal(ofertaId: number, novoPrincipalCentavos: number) {
  const { oferta, posicao: p } = await posicao(ofertaId);
  const projetada = coberturaProjetada(p.garantiasElegiveisCentavos, p.principalComprometidoCentavos, novoPrincipalCentavos);
  const minima = Number(oferta.coberturaMinima);
  if (projetada === null || projetada < minima) {
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Captação travada: com este valor a cobertura de garantias ficaria em ${pct(projetada ?? 0)}, abaixo do mínimo de ${pct(minima)}. Recomponha as garantias antes.`,
    });
  }
}

/** Alocação proporcional de um contrato ativo nas operações da oferta. */
export async function alocacao(contratoId: number) {
  const [c] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
  if (!c || c.status !== "ativo") return [];
  const { posicao: p, operacoes, principalAtivoCentavos } = await posicao(c.ofertaId);
  return alocacaoDoContrato({
    principalContratoCentavos: c.principalCentavos,
    principalTotalCentavos: principalAtivoCentavos,
    saldoContaCentavos: Math.max(0, p.saldoContaCentavos),
    operacoes,
  });
}

/** Garantias com o valor que conta para a cobertura e o LTV de cada CCB. */
export function garantiasPublicas(gs: Awaited<ReturnType<typeof posicao>>["garantias"]) {
  return gs.map((g) => ({
    codigo: g.codigo,
    descricao: g.devedorDescricao,
    tipo: g.garantiaTipo,
    valorCcbCentavos: g.valorCentavos,
    avaliacaoCentavos: g.garantiaValorCentavos,
    elegivelCentavos: valorElegivel(g),
    ltv: g.garantiaValorCentavos ? g.valorCentavos / g.garantiaValorCentavos : null,
    situacao: g.situacao,
    registro: g.registroRef,
    serie: g.serie,
    emissao: g.dataEmissao,
    vencimento: g.vencimento,
    valorResgateCentavos: g.valorResgateCentavos,
  }));
}
