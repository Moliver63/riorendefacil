/**
 * Ciclo do contrato e do resgate. Regras num lugar só, usadas pelos routers
 * do investidor e do admin.
 *
 *   aguardando_assinatura ──(admin: assinado)──▶ aguardando_aporte
 *        │                                           │
 *        └──────(admin: cancelar)◀───────────────────┤
 *                                                    └──(admin: confirma aporte)──▶ ativo
 *
 *   resgate: solicitado ──▶ aprovado ──▶ pago        (recusado a partir de solicitado/aprovado)
 *
 * Nenhum valor passa pela plataforma: "confirmar aporte" e "marcar pago"
 * registram o que já aconteceu na conta vinculada do emissor.
 */
import { and, desc, eq, inArray, sum } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "./db";
import { contratos, resgatesRendimento, type Contrato } from "./schema";
import { aliquotaIR, fatorMeses, rendimentoAcumulado, type ResgateNoTempo } from "../shared/finance";

export const STATUS_RESGATE_ATIVOS = ["solicitado", "aprovado", "pago"] as const;

export const STATUS_CONTRATO_ROTULO: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  aguardando_aporte: "Aguardando aporte",
  ativo: "Ativo",
  vencido: "Vencido",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export function diasDesde(inicio: string | null, ate = new Date()): number {
  if (!inicio) return 0;
  return Math.max(0, Math.floor((ate.getTime() - new Date(inicio + "T00:00:00Z").getTime()) / 86_400_000));
}

export function somarMeses(iso: string, meses: number): string {
  const d = new Date(iso + "T12:00:00Z");
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}

export async function totalResgatado(contratoId: number): Promise<number> {
  const [r] = await db
    .select({ total: sum(resgatesRendimento.valorCentavos) })
    .from(resgatesRendimento)
    .where(and(eq(resgatesRendimento.contratoId, contratoId), inArray(resgatesRendimento.status, [...STATUS_RESGATE_ATIVOS])));
  return Number(r?.total ?? 0);
}

/** Resgates de rendimento no tempo (dia do pedido desde o início), para os juros compostos. */
export async function resgatesDoContrato(c: Contrato): Promise<(ResgateNoTempo & { status: string })[]> {
  const linhas = await db
    .select({ valor: resgatesRendimento.valorCentavos, em: resgatesRendimento.solicitadoEm, status: resgatesRendimento.status })
    .from(resgatesRendimento)
    .where(and(eq(resgatesRendimento.contratoId, c.id), inArray(resgatesRendimento.status, [...STATUS_RESGATE_ATIVOS])));
  return linhas.map((r) => ({ dia: diasDesde(c.inicio, r.em), valorCentavos: r.valor, status: r.status }));
}

export function saldoDoContrato(c: Contrato, resgates: number | ResgateNoTempo[], hoje = new Date()) {
  if (c.status !== "ativo") return { brutoCentavos: 0, disponivelCentavos: 0, saldoCentavos: 0, dias: 0 };
  const dias = diasDesde(c.inicio, hoje);
  return { ...rendimentoAcumulado(c.principalCentavos, Number(c.taxaMensal), dias, resgates), dias };
}

/** IR retido sobre o rendimento resgatado, pela tabela regressiva contando desde o início do contrato. */
export function irDoResgate(c: Contrato, valorCentavos: number, hoje = new Date()) {
  const aliquota = aliquotaIR(Math.max(diasDesde(c.inicio, hoje), 1));
  const ir = Math.round(valorCentavos * aliquota);
  return { aliquota, irCentavos: ir, liquidoCentavos: valorCentavos - ir };
}

/**
 * Curva do saldo mês a mês, do início ao vencimento, como na tabela progressiva:
 * `projetadoCentavos` sem resgates (o que acumula se nada for sacado) e
 * `realizadoCentavos` com os resgates feitos até cada data (só até hoje).
 */
export function evolucaoDoContrato(c: Contrato, resgates: ResgateNoTempo[] = [], hoje = new Date()) {
  if (!c.inicio) return [];
  const taxa = Number(c.taxaMensal);
  const diasHoje = diasDesde(c.inicio, hoje);
  const pontos: { data: string; mes: number; projetadoCentavos: number; rendimentoCentavos: number; realizadoCentavos: number | null }[] = [];
  for (let m = 0; m <= c.prazoMeses; m++) {
    const data = somarMeses(c.inicio, m);
    const dias = diasDesde(c.inicio, new Date(data + "T12:00:00Z"));
    const projetado = Math.round(c.principalCentavos * fatorMeses(taxa, m));
    const realizado =
      dias <= diasHoje
        ? rendimentoAcumulado(c.principalCentavos, taxa, dias, resgates.filter((r) => r.dia <= dias)).saldoCentavos
        : null;
    pontos.push({ data, mes: m, projetadoCentavos: projetado, rendimentoCentavos: projetado - c.principalCentavos, realizadoCentavos: realizado });
  }
  return pontos;
}

export async function getContrato(id: number): Promise<Contrato> {
  const [c] = await db.select().from(contratos).where(eq(contratos.id, id)).limit(1);
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado." });
  return c;
}

export function exigirStatus(c: Contrato, ...permitidos: Contrato["status"][]) {
  if (!permitidos.includes(c.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Ação indisponível: o contrato está "${STATUS_CONTRATO_ROTULO[c.status] ?? c.status}".`,
    });
  }
}

export async function extratoDoContrato(c: Contrato) {
  const resgates = await db
    .select()
    .from(resgatesRendimento)
    .where(eq(resgatesRendimento.contratoId, c.id))
    .orderBy(desc(resgatesRendimento.solicitadoEm));
  const lancamentos: { data: string; tipo: "aporte" | "resgate"; descricao: string; valorCentavos: number; status?: string }[] = [];
  if (c.ativadoEm) {
    // data do lançamento = início do rendimento (quando o dinheiro entrou), não o dia em que o admin registrou
    const quando = c.inicio ? new Date(`${c.inicio}T12:00:00Z`) : c.ativadoEm;
    lancamentos.push({ data: quando.toISOString(), tipo: "aporte", descricao: "Aporte na conta vinculada, início do rendimento", valorCentavos: c.principalCentavos });
  }
  for (const r of resgates) {
    lancamentos.push({
      data: (r.pagoEm ?? r.solicitadoEm).toISOString(),
      tipo: "resgate",
      descricao:
        r.status === "pago"
          ? `Resgate de rendimento pago (IR ${(Number(r.irRetidoCentavos) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`
          : r.status === "recusado"
            ? `Resgate recusado${r.motivoRecusa ? `: ${r.motivoRecusa}` : ""}`
            : `Resgate de rendimento ${r.status}, previsto para ${new Date(r.previstoPara + "T12:00:00").toLocaleDateString("pt-BR")}`,
      valorCentavos: -r.valorCentavos,
      status: r.status,
    });
  }
  return lancamentos.sort((a, b) => b.data.localeCompare(a.data));
}
