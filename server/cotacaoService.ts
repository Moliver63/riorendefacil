/**
 * Cotações cambiais: registro manual pelo admin ou importação da PTAX do
 * Banco Central. A conta vinculada e a cobertura de garantias são em reais,
 * então todo valor de aplicação em dólar é convertido pela cotação mais recente.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { cotacoes } from "./schema";
import { cotacaoDaPtax, paraReais, type Cotacao, type Moeda } from "../shared/moeda";

export async function ultimaCotacao(moeda: Moeda = "USD"): Promise<Cotacao | null> {
  const [c] = await db.select().from(cotacoes).where(eq(cotacoes.moeda, moeda)).orderBy(desc(cotacoes.data), desc(cotacoes.id)).limit(1);
  return c ? { moeda: c.moeda as Moeda, valor: Number(c.valor), data: c.data, fonte: c.fonte } : null;
}

export async function listarCotacoes(limite = 30) {
  return db.select().from(cotacoes).orderBy(desc(cotacoes.data), desc(cotacoes.id)).limit(limite);
}

/** Grava a cotação; a mesma moeda, data e fonte só entram uma vez (a segunda atualiza o valor). */
export async function registrarCotacao(c: Cotacao, registradoPor: number | null) {
  const [existente] = await db
    .select()
    .from(cotacoes)
    .where(and(eq(cotacoes.moeda, c.moeda), eq(cotacoes.data, c.data), eq(cotacoes.fonte, c.fonte)))
    .limit(1);
  if (existente) {
    const [r] = await db.update(cotacoes).set({ valor: c.valor.toFixed(6), registradoPor }).where(eq(cotacoes.id, existente.id)).returning();
    return { cotacao: r!, anterior: Number(existente.valor) };
  }
  const [r] = await db.insert(cotacoes).values({ moeda: c.moeda, valor: c.valor.toFixed(6), data: c.data, fonte: c.fonte, registradoPor }).returning();
  return { cotacao: r!, anterior: null as number | null };
}

const URL_PTAX = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";
const mmddaaaa = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`;

/**
 * Busca a PTAX de venda mais recente dos últimos 10 dias (cobre fins de semana
 * e feriados). `buscar` é injetável para teste.
 */
export async function buscarPtax(hoje = new Date(), buscar: typeof fetch = fetch): Promise<Cotacao> {
  const inicio = new Date(hoje.getTime() - 10 * 86_400_000);
  const url = `${URL_PTAX}?@dataInicial='${mmddaaaa(inicio)}'&@dataFinalCotacao='${mmddaaaa(hoje)}'&$format=json&$orderby=dataHoraCotacao%20desc&$top=1`;
  let resp: Response;
  try {
    resp = await buscar(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível falar com o Banco Central agora. Tente de novo ou registre a cotação à mão." });
  }
  if (!resp.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: `O Banco Central respondeu com erro ${resp.status}.` });
  const json = (await resp.json()) as { value?: { cotacaoVenda: number; dataHoraCotacao: string }[] };
  const r = json.value?.[0];
  if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "O Banco Central não devolveu cotação para os últimos dias." });
  return cotacaoDaPtax(r);
}

/** Fator para levar centavos da moeda da aplicação a centavos de real. Dólar sem cotação trava a operação. */
export function exigirReais(centavos: number, moeda: string, cotacao: Cotacao | null): number {
  const r = paraReais(centavos, moeda, cotacao);
  if (r === null) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Há aplicação em dólar e nenhuma cotação registrada. Registre ou importe a PTAX em Admin › Cotações." });
  }
  return r;
}

/** Valor de uma aplicação levado a reais pela cotação mais recente (identidade para aplicações em real). */
export async function emReaisDoContrato(c: { moeda: string }, centavos: number): Promise<number> {
  if (c.moeda === "BRL") return centavos;
  return exigirReais(centavos, c.moeda, await ultimaCotacao("USD"));
}
