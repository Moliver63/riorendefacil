/**
 * Back-office do lastro: operações de grãos e conta vinculada de cada oferta.
 * Montado dentro do adminRouter (admin.operacoes / admin.conta).
 *
 *   em_analise ─▶ comprada ─▶ em_transporte ─▶ vendida ─▶ recebida
 *        │            └──────────────────────────▲   └─▶ atrasada ─▶ recebida
 *        └─▶ cancelada
 *
 * Cada passo que move dinheiro gera o lançamento correspondente na conta vinculada.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { router, adminProcedure } from "./trpc";
import { db } from "../db";
import { lancamentosConta, operacoesGraos, type OperacaoGraos } from "../schema";
import { auditar } from "../auditoria";
import { getOferta, lancar, posicao } from "../lastroService";
import { formatarBRL } from "../../shared/finance";
import { COMPRADOR_TIPOS, GRAOS, GRAO_ROTULO, STATUS_OPERACAO_ROTULO, podeMudar, type StatusOperacao } from "../../shared/lastroGraos";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uf = z.string().trim().length(2).toUpperCase();
const centavos = z.number().int().positive();
const hojeIso = () => new Date().toISOString().slice(0, 10);

async function getOperacao(id: number): Promise<OperacaoGraos> {
  const [o] = await db.select().from(operacoesGraos).where(eq(operacoesGraos.id, id)).limit(1);
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
  return o;
}

function exigirTransicao(o: OperacaoGraos, para: StatusOperacao) {
  const de = o.status as StatusOperacao;
  if (!podeMudar(de, para)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `A operação está "${STATUS_OPERACAO_ROTULO[de]}" e não pode ir para "${STATUS_OPERACAO_ROTULO[para]}".`,
    });
  }
}

async function atualizar(id: number, dados: Partial<OperacaoGraos>) {
  const [o] = await db
    .update(operacoesGraos)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(eq(operacoesGraos.id, id))
    .returning();
  return o!;
}

const dadosOperacao = z.object({
  codigo: z.string().trim().min(2).max(32),
  grao: z.enum(GRAOS),
  produtorDescricao: z.string().trim().min(3).max(255),
  origemMunicipio: z.string().trim().min(2).max(120),
  origemUf: uf,
  toneladas: z.number().positive().max(1_000_000),
  valorCompraCentavos: centavos,
  observacoes: z.string().max(2000).optional(),
});

export const lastroRoutes = {
  operacoes: router({
    /** Operações, garantias e a posição consolidada da oferta. */
    painel: adminProcedure.input(z.object({ ofertaId: z.number().int() })).query(async ({ input }) => {
      const r = await posicao(input.ofertaId);
      return {
        oferta: { id: r.oferta.id, nome: r.oferta.nome, codigo: r.oferta.codigo, coberturaMinima: Number(r.oferta.coberturaMinima) },
        posicao: r.posicao,
        operacoes: r.operacoes.map((o) => ({ ...o, toneladas: Number(o.toneladas) })),
      };
    }),

    /** Nova operação (ou edição enquanto em análise). */
    salvar: adminProcedure
      .input(dadosOperacao.extend({ id: z.number().int().optional(), ofertaId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const { id, ofertaId, toneladas, ...resto } = input;
        await getOferta(ofertaId);
        const valores = { ...resto, toneladas: toneladas.toFixed(3) };
        let o: OperacaoGraos;
        if (id) {
          const atual = await getOperacao(id);
          if (atual.status !== "em_analise") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só dá para editar operações em análise." });
          o = await atualizar(id, valores);
        } else {
          try {
            [o] = (await db.insert(operacoesGraos).values({ ...valores, ofertaId }).returning()) as [OperacaoGraos];
          } catch {
            throw new TRPCError({ code: "CONFLICT", message: `Já existe uma operação ${input.codigo} nesta oferta.` });
          }
        }
        await auditar({ atorId: ctx.usuario.id, acao: id ? "operacao_editada" : "operacao_criada", entidade: "operacao", entidadeId: o.id, dados: input, ip: ctx.ip });
        return o;
      }),

    /**
     * Compra do grão. Exige cobertura acima do mínimo e saldo na conta vinculada:
     * a operação só sai com dinheiro que já está lá.
     */
    registrarCompra: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          dataCompra: dataIso,
          nfCompra: z.string().trim().min(1).max(64),
          custosCentavos: z.number().int().min(0).default(0),
          comprovanteChave: z.string().startsWith("docs/").max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const o = await getOperacao(input.id);
        exigirTransicao(o, "comprada");
        if (input.dataCompra > hojeIso()) throw new TRPCError({ code: "BAD_REQUEST", message: "A data da compra não pode ser no futuro." });
        const { posicao: p } = await posicao(o.ofertaId);
        if (p.travada) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Novas operações estão suspensas: a cobertura de garantias está abaixo do mínimo." });
        }
        const total = o.valorCompraCentavos + input.custosCentavos;
        if (p.saldoContaCentavos < total) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Saldo da conta vinculada (${formatarBRL(p.saldoContaCentavos)}) não cobre a compra mais custos (${formatarBRL(total)}).`,
          });
        }
        await atualizar(o.id, { status: "comprada", dataCompra: input.dataCompra, nfCompra: input.nfCompra, custosCentavos: input.custosCentavos });
        const rotulo = `${GRAO_ROTULO[o.grao as keyof typeof GRAO_ROTULO] ?? o.grao}, ${Number(o.toneladas).toLocaleString("pt-BR")} t`;
        await lancar({ ofertaId: o.ofertaId, tipo: "compra_graos", valorCentavos: o.valorCompraCentavos, descricao: `Compra ${o.codigo}: ${rotulo}, NF ${input.nfCompra}`, data: input.dataCompra, operacaoId: o.id, comprovanteChave: input.comprovanteChave, criadoPor: ctx.usuario.id });
        if (input.custosCentavos > 0) {
          await lancar({ ofertaId: o.ofertaId, tipo: "custos", valorCentavos: input.custosCentavos, descricao: `Impostos e custos da operação ${o.codigo}`, data: input.dataCompra, operacaoId: o.id, criadoPor: ctx.usuario.id });
        }
        await auditar({ atorId: ctx.usuario.id, acao: "operacao_comprada", entidade: "operacao", entidadeId: o.id, dados: input, ip: ctx.ip });
        return { ok: true as const };
      }),

    registrarTransporte: adminProcedure
      .input(z.object({ id: z.number().int(), transportadora: z.string().trim().min(2).max(160), destinoMunicipio: z.string().trim().min(2).max(120), destinoUf: uf }))
      .mutation(async ({ ctx, input }) => {
        const o = await getOperacao(input.id);
        exigirTransicao(o, "em_transporte");
        const { id, ...dados } = input;
        await atualizar(id, { ...dados, status: "em_transporte" });
        await auditar({ atorId: ctx.usuario.id, acao: "operacao_em_transporte", entidade: "operacao", entidadeId: id, dados, ip: ctx.ip });
        return { ok: true as const };
      }),

    /** Venda ao comprador aprovado: nasce o recebível. */
    registrarVenda: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          compradorTipo: z.enum(COMPRADOR_TIPOS),
          compradorDescricao: z.string().trim().min(3).max(255),
          destinoMunicipio: z.string().trim().min(2).max(120),
          destinoUf: uf,
          valorVendaCentavos: centavos,
          nfVenda: z.string().trim().min(1).max(64),
          dataVenda: dataIso,
          vencimentoRecebimento: dataIso,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const o = await getOperacao(input.id);
        exigirTransicao(o, "vendida");
        if (input.vencimentoRecebimento < input.dataVenda) throw new TRPCError({ code: "BAD_REQUEST", message: "O vencimento não pode ser antes da venda." });
        const { id, ...dados } = input;
        await atualizar(id, { ...dados, status: "vendida" });
        await auditar({ atorId: ctx.usuario.id, acao: "operacao_vendida", entidade: "operacao", entidadeId: id, dados, ip: ctx.ip });
        return { ok: true as const };
      }),

    /** Pagamento do comprador na conta vinculada. Aceita parcelas. */
    registrarRecebimento: adminProcedure
      .input(z.object({ id: z.number().int(), valorCentavos: centavos, data: dataIso, comprovanteChave: z.string().startsWith("docs/").max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const o = await getOperacao(input.id);
        if (o.status !== "vendida" && o.status !== "atrasada") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Registre a venda antes do recebimento." });
        }
        const falta = (o.valorVendaCentavos ?? 0) - o.valorRecebidoCentavos;
        if (input.valorCentavos > falta) throw new TRPCError({ code: "BAD_REQUEST", message: `Falta receber ${formatarBRL(falta)} desta operação.` });
        const recebido = o.valorRecebidoCentavos + input.valorCentavos;
        const quitada = recebido >= (o.valorVendaCentavos ?? 0);
        await atualizar(o.id, { valorRecebidoCentavos: recebido, ...(quitada ? { status: "recebida", dataRecebimento: input.data } : {}) });
        await lancar({ ofertaId: o.ofertaId, tipo: "recebimento_venda", valorCentavos: input.valorCentavos, descricao: `Recebimento ${o.codigo}${quitada ? "" : " (parcial)"}: ${o.compradorDescricao ?? "comprador"}`, data: input.data, operacaoId: o.id, comprovanteChave: input.comprovanteChave, criadoPor: ctx.usuario.id });
        await auditar({ atorId: ctx.usuario.id, acao: "operacao_recebimento", entidade: "operacao", entidadeId: o.id, dados: input, ip: ctx.ip });
        return { ok: true as const, quitada };
      }),

    marcarAtraso: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const o = await getOperacao(input.id);
      exigirTransicao(o, "atrasada");
      await atualizar(o.id, { status: "atrasada" });
      await auditar({ atorId: ctx.usuario.id, acao: "operacao_atrasada", entidade: "operacao", entidadeId: o.id, ip: ctx.ip });
      return { ok: true as const };
    }),

    cancelar: adminProcedure.input(z.object({ id: z.number().int(), motivo: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
      const o = await getOperacao(input.id);
      exigirTransicao(o, "cancelada");
      await atualizar(o.id, { status: "cancelada", observacoes: [o.observacoes, `Cancelada: ${input.motivo}`].filter(Boolean).join("\n") });
      await auditar({ atorId: ctx.usuario.id, acao: "operacao_cancelada", entidade: "operacao", entidadeId: o.id, dados: { motivo: input.motivo }, ip: ctx.ip });
      return { ok: true as const };
    }),
  }),

  conta: router({
    extrato: adminProcedure.input(z.object({ ofertaId: z.number().int() })).query(({ input }) =>
      db.select().from(lancamentosConta).where(eq(lancamentosConta.ofertaId, input.ofertaId)).orderBy(desc(lancamentosConta.data), desc(lancamentosConta.id)).limit(500),
    ),

    /**
     * Lançamentos manuais. A margem da Rio respeita a ordem de pagamentos:
     * só sai o que sobra depois do principal e do rendimento dos investidores.
     */
    lancar: adminProcedure
      .input(
        z.object({
          ofertaId: z.number().int(),
          tipo: z.enum(["custos", "margem_rio", "pagamento_principal", "ajuste"]),
          valorCentavos: z.number().int().refine((v) => v !== 0, "Informe um valor."),
          descricao: z.string().trim().min(3).max(255),
          data: dataIso,
          comprovanteChave: z.string().startsWith("docs/").max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.data > hojeIso()) throw new TRPCError({ code: "BAD_REQUEST", message: "A data não pode ser no futuro." });
        const { posicao: p } = await posicao(input.ofertaId);
        const saida = input.tipo === "ajuste" ? Math.max(0, -input.valorCentavos) : Math.abs(input.valorCentavos);
        if (saida > p.saldoContaCentavos) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Saldo da conta vinculada insuficiente (${formatarBRL(p.saldoContaCentavos)}).` });
        }
        if (input.tipo === "margem_rio") {
          if (p.travada) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Margem bloqueada: a cobertura de garantias está abaixo do mínimo." });
          if (saida > p.margemLiberavelCentavos) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Pela ordem de pagamentos, a margem liberável hoje é ${formatarBRL(p.margemLiberavelCentavos)}. O restante garante principal e rendimento dos investidores.`,
            });
          }
        }
        const l = await lancar({ ...input, criadoPor: ctx.usuario.id });
        await auditar({ atorId: ctx.usuario.id, acao: "conta_lancamento", entidade: "oferta", entidadeId: input.ofertaId, dados: input, ip: ctx.ip });
        return l;
      }),
  }),
};
