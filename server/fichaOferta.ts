/**
 * Ficha pública da oferta, no formato das prateleiras de renda fixa:
 * condições, operações de grãos rastreáveis, garantias e a posição da conta vinculada.
 * Sem emissor habilitado, devolve a oferta de exemplo marcada como tal.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { ofertas } from "./schema";
import { posicao, garantiasPublicas } from "./lastroService";
import { carregarEmissor, pendenciasParaCaptar } from "../shared/issuer";
import type { Faixa } from "../shared/finance";
import { FAIXAS_EXEMPLO, GARANTIAS_EXEMPLO, OFERTA_EXEMPLO, OPERACOES_EXEMPLO } from "../shared/exemplo";
import {
  COMPRADOR_ROTULO,
  GRAOS,
  GRAO_ROTULO,
  STATUS_OPERACAO_ROTULO,
  margemDaOperacao,
  posicaoDaOferta,
  valorElegivel,
  type CompradorTipo,
  type Grao,
  type StatusOperacao,
} from "../shared/lastroGraos";

interface OperacaoBase {
  codigo: string;
  grao: string;
  status: string;
  produtorDescricao: string;
  origemMunicipio: string;
  origemUf: string;
  toneladas: number | string;
  valorCompraCentavos: number;
  custosCentavos: number;
  compradorTipo: string | null;
  compradorDescricao: string | null;
  destinoMunicipio: string | null;
  destinoUf: string | null;
  valorVendaCentavos: number | null;
  valorRecebidoCentavos: number;
  dataCompra: string | null;
  vencimentoRecebimento: string | null;
  dataRecebimento: string | null;
}

/** Só o que pode ir a público: sem NF, sem nome de produtor pessoa física. */
function operacaoPublica(o: OperacaoBase) {
  const m = margemDaOperacao(o);
  return {
    codigo: o.codigo,
    grao: o.grao as Grao,
    graoRotulo: GRAO_ROTULO[o.grao as Grao] ?? o.grao,
    status: o.status as StatusOperacao,
    statusRotulo: STATUS_OPERACAO_ROTULO[o.status as StatusOperacao] ?? o.status,
    origem: `${o.produtorDescricao}, ${o.origemMunicipio}/${o.origemUf}`,
    toneladas: Number(o.toneladas),
    valorCompraCentavos: o.valorCompraCentavos,
    custosCentavos: o.custosCentavos,
    comprador: o.compradorTipo ? `${COMPRADOR_ROTULO[o.compradorTipo as CompradorTipo] ?? o.compradorTipo}${o.compradorDescricao ? `: ${o.compradorDescricao}` : ""}` : null,
    destino: o.destinoMunicipio ? `${o.destinoMunicipio}/${o.destinoUf}` : null,
    valorVendaCentavos: o.valorVendaCentavos,
    margemPct: m?.pct ?? null,
    dataCompra: o.dataCompra,
    vencimentoRecebimento: o.vencimentoRecebimento,
    dataRecebimento: o.dataRecebimento,
  };
}

function resumoGraos(ops: ReturnType<typeof operacaoPublica>[]) {
  return GRAOS.map((g) => {
    const doGrao = ops.filter((o) => o.grao === g && o.status !== "cancelada" && o.status !== "em_analise");
    return { grao: g, rotulo: GRAO_ROTULO[g], operacoes: doGrao.length, toneladas: doGrao.reduce((s, o) => s + o.toneladas, 0) };
  }).filter((r) => r.operacoes > 0);
}

function condicoes(faixas: Faixa[]) {
  const taxas = faixas.map((f) => f.taxaMensalTeto);
  return {
    faixas,
    taxaDesde: Math.min(...taxas),
    taxaAte: Math.max(...taxas),
    aplicacaoMinimaCentavos: Math.min(...faixas.map((f) => f.minimoCentavos)),
    prazoMinimoMeses: Math.min(...faixas.map((f) => f.prazoMinimoMeses)),
  };
}

const emissorHabilitado = () => pendenciasParaCaptar(carregarEmissor(process.env)).length === 0;

function fichaExemplo() {
  const operacoes = OPERACOES_EXEMPLO.map((o) => operacaoPublica(o as OperacaoBase));
  const pos = posicaoDaOferta({
    saldoContaCentavos: OFERTA_EXEMPLO.saldoContaCentavos,
    operacoes: OPERACOES_EXEMPLO as unknown as Parameters<typeof posicaoDaOferta>[0]["operacoes"],
    garantias: [...GARANTIAS_EXEMPLO],
    principalComprometidoCentavos: OFERTA_EXEMPLO.principalComprometidoCentavos,
    obrigacoesCentavos: OFERTA_EXEMPLO.obrigacoesCentavos,
    coberturaMinima: OFERTA_EXEMPLO.coberturaMinima,
  });
  return {
    exemplo: true as const,
    captacaoLiberada: false,
    id: 0,
    codigo: OFERTA_EXEMPLO.codigo,
    nome: OFERTA_EXEMPLO.nome,
    tese: OFERTA_EXEMPLO.tese,
    ...condicoes(FAIXAS_EXEMPLO),
    carenciaPrincipalDias: OFERTA_EXEMPLO.carenciaPrincipalDias,
    prazoResgateDias: OFERTA_EXEMPLO.prazoResgateDias,
    prazoMedioCicloDias: OFERTA_EXEMPLO.prazoMedioCicloDias,
    reservasAte: OFERTA_EXEMPLO.reservasAte,
    captacaoAlvoCentavos: OFERTA_EXEMPLO.captacaoAlvoCentavos as number | null,
    posicao: pos,
    operacoes,
    graos: resumoGraos(operacoes),
    garantias: GARANTIAS_EXEMPLO.map((g) => ({
      codigo: g.codigo,
      descricao: g.devedorDescricao,
      tipo: g.garantiaTipo,
      valorCcbCentavos: g.valorCentavos,
      avaliacaoCentavos: g.garantiaValorCentavos as number | null,
      elegivelCentavos: valorElegivel(g),
      ltv: g.valorCentavos / g.garantiaValorCentavos as number | null,
      situacao: g.situacao as string,
      registro: g.registroRef as string | null,
      serie: g.serie as string | null,
      emissao: g.dataEmissao as string | null,
      vencimento: g.vencimento as string,
      valorResgateCentavos: g.valorResgateCentavos as number | null,
    })),
  };
}

export type FichaOferta = ReturnType<typeof fichaExemplo> | Awaited<ReturnType<typeof fichaReal>>;

async function fichaReal(ofertaId: number) {
  const r = await posicao(ofertaId);
  const o = r.oferta;
  const operacoes = r.operacoes.filter((x) => x.status !== "cancelada").map((x) => operacaoPublica(x));
  return {
    exemplo: false as boolean,
    captacaoLiberada: o.ativa && !r.posicao.travada && (!o.reservasAte || o.reservasAte >= new Date().toISOString().slice(0, 10)),
    id: o.id,
    codigo: o.codigo ?? `OF-${o.id}`,
    nome: o.nome,
    tese: o.tese ?? o.descricao ?? "",
    ...condicoes(o.faixas as Faixa[]),
    carenciaPrincipalDias: o.carenciaPrincipalDias,
    prazoResgateDias: o.prazoResgateDias,
    prazoMedioCicloDias: o.prazoMedioCicloDias,
    reservasAte: o.reservasAte,
    captacaoAlvoCentavos: o.captacaoAlvoCentavos,
    posicao: r.posicao,
    operacoes,
    graos: resumoGraos(operacoes),
    garantias: garantiasPublicas(r.garantias),
  };
}

/** Prateleira: todas as ofertas abertas, ou a de exemplo. */
export async function vitrine() {
  if (!emissorHabilitado()) return [fichaExemplo()];
  const abertas = await db.select({ id: ofertas.id }).from(ofertas).where(eq(ofertas.ativa, true)).orderBy(desc(ofertas.criadoEm));
  if (!abertas.length) return [fichaExemplo()];
  return Promise.all(abertas.map((a) => fichaReal(a.id)));
}

/** Ficha de uma oferta. Id 0 é a de exemplo. Oferta inativa não aparece para o público. */
export async function ficha(id: number, incluirInativa = false) {
  if (id === 0 || !emissorHabilitado()) return fichaExemplo();
  const [o] = await db.select({ ativa: ofertas.ativa }).from(ofertas).where(eq(ofertas.id, id)).limit(1);
  if (!o || (!o.ativa && !incluirInativa)) return null;
  return fichaReal(id);
}
