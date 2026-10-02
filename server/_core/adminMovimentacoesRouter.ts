/**
 * Fila de movimentações do admin: depósitos informados pelos investidores e
 * saques do principal. Saques de rendimento seguem em admin.resgates.
 * Montado dentro do adminRouter (admin.depositos / admin.saquesPrincipal).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { router, adminProcedure } from "./trpc";
import { db } from "../db";
import { cadastros, contratos, depositos, investidores, ofertas, resgatesPrincipal, usuarios } from "../schema";
import { auditar } from "../auditoria";
import { getContrato } from "../contratoService";
import { lancar } from "../lastroService";
import { formatarBRL } from "../../shared/finance";
import { ativarContrato, emailDoInvestidor } from "./adminInvestimentosRouter";
import { emailDepositoRecusado, emailSaquePrincipalPago, emailSaquePrincipalRecusado, enviarEmail } from "./email";

const status = (lista: readonly string[]) => z.object({ status: z.enum(lista as [string, ...string[]]).optional() }).default({});
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const movimentacoesRoutes = {
  depositos: router({
    listar: adminProcedure.input(status(["informado", "confirmado", "recusado"])).query(({ input }) =>
      db
        .select({
          id: depositos.id,
          contratoId: depositos.contratoId,
          valorCentavos: depositos.valorCentavos,
          dataDeposito: depositos.dataDeposito,
          status: depositos.status,
          motivoRecusa: depositos.motivoRecusa,
          comprovanteChave: depositos.comprovanteChave,
          criadoEm: depositos.criadoEm,
          principalCentavos: contratos.principalCentavos,
          oferta: ofertas.nome,
          nome: sql<string | null>`coalesce(${cadastros.nomeCompleto}, ${usuarios.nome})`,
          email: usuarios.email,
        })
        .from(depositos)
        .innerJoin(contratos, eq(depositos.contratoId, contratos.id))
        .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
        .innerJoin(investidores, eq(depositos.investidorId, investidores.id))
        .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
        .leftJoin(cadastros, eq(cadastros.investidorId, investidores.id))
        .where(input.status ? eq(depositos.status, input.status) : undefined)
        .orderBy(desc(depositos.criadoEm))
        .limit(300),
    ),

    /** Confere o depósito na conta vinculada e ativa o contrato (início = data do depósito, se não informada). */
    confirmar: adminProcedure.input(z.object({ id: z.number().int(), inicio: dataIso.optional() })).mutation(async ({ ctx, input }) => {
      const [d] = await db.select().from(depositos).where(eq(depositos.id, input.id)).limit(1);
      if (!d || d.status !== "informado") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só depósitos em conferência podem ser confirmados." });
      const r = await ativarContrato({ contratoId: d.contratoId, inicio: input.inicio ?? d.dataDeposito, comprovanteChave: d.comprovanteChave, atorId: ctx.usuario.id, ip: ctx.ip });
      await db.update(depositos).set({ status: "confirmado", confirmadoPor: ctx.usuario.id, confirmadoEm: new Date() }).where(eq(depositos.id, d.id));
      await auditar({ atorId: ctx.usuario.id, acao: "deposito_confirmado", entidade: "contrato", entidadeId: d.contratoId, dados: { depositoId: d.id }, ip: ctx.ip });
      return r;
    }),

    recusar: adminProcedure.input(z.object({ id: z.number().int(), motivo: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
      const [d] = await db
        .update(depositos)
        .set({ status: "recusado", motivoRecusa: input.motivo })
        .where(sql`${depositos.id} = ${input.id} and ${depositos.status} = 'informado'`)
        .returning();
      if (!d) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só depósitos em conferência podem ser recusados." });
      await auditar({ atorId: ctx.usuario.id, acao: "deposito_recusado", entidade: "contrato", entidadeId: d.contratoId, dados: { motivo: input.motivo }, ip: ctx.ip });
      const dest = await emailDoInvestidor(d.investidorId);
      if (dest) void enviarEmail({ para: dest.email, assunto: "Depósito não confirmado", html: emailDepositoRecusado({ nome: dest.nome, motivo: input.motivo }) });
      return { ok: true as const };
    }),
  }),

  saquesPrincipal: router({
    listar: adminProcedure.input(status(["solicitado", "aprovado", "pago", "recusado"])).query(({ input }) =>
      db
        .select({
          r: resgatesPrincipal,
          oferta: ofertas.nome,
          nome: sql<string | null>`coalesce(${cadastros.nomeCompleto}, ${usuarios.nome})`,
          email: usuarios.email,
          banco: cadastros.bancoNome,
          agencia: cadastros.agencia,
          contaFinal: cadastros.contaFinal,
          contaTipo: cadastros.contaTipo,
        })
        .from(resgatesPrincipal)
        .innerJoin(contratos, eq(resgatesPrincipal.contratoId, contratos.id))
        .innerJoin(ofertas, eq(contratos.ofertaId, ofertas.id))
        .innerJoin(investidores, eq(contratos.investidorId, investidores.id))
        .innerJoin(usuarios, eq(investidores.usuarioId, usuarios.id))
        .leftJoin(cadastros, eq(cadastros.investidorId, investidores.id))
        .where(input.status ? eq(resgatesPrincipal.status, input.status) : undefined)
        .orderBy(desc(resgatesPrincipal.solicitadoEm))
        .limit(300),
    ),

    aprovar: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const [r] = await db
        .update(resgatesPrincipal)
        .set({ status: "aprovado" })
        .where(sql`${resgatesPrincipal.id} = ${input.id} and ${resgatesPrincipal.status} = 'solicitado'`)
        .returning({ id: resgatesPrincipal.id, contratoId: resgatesPrincipal.contratoId });
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Só pedidos em \"solicitado\" podem ser aprovados." });
      await auditar({ atorId: ctx.usuario.id, acao: "saque_principal_aprovado", entidade: "contrato", entidadeId: r.contratoId, ip: ctx.ip });
      return { ok: true as const };
    }),

    /** Transferência feita pela conta vinculada: encerra o contrato e lança a saída na conta. */
    marcarPago: adminProcedure
      .input(z.object({ id: z.number().int(), comprovanteChave: z.string().startsWith("docs/").max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const [r] = await db
          .update(resgatesPrincipal)
          .set({ status: "pago", pagoEm: new Date(), comprovanteChave: input.comprovanteChave ?? null })
          .where(sql`${resgatesPrincipal.id} = ${input.id} and ${resgatesPrincipal.status} = 'aprovado'`)
          .returning();
        if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aprove o pedido antes de marcar como pago." });
        const c = await getContrato(r.contratoId);
        await db.update(contratos).set({ status: "liquidado" }).where(eq(contratos.id, c.id));
        await lancar({
          ofertaId: c.ofertaId,
          tipo: "pagamento_principal",
          valorCentavos: r.brutoCentavos,
          descricao: `Saque do principal do contrato #${c.id} (${r.tipo === "vencimento" ? "vencimento" : "antecipado"}; líquido ${formatarBRL(r.liquidoCentavos)} + IR ${formatarBRL(r.irCentavos)})`,
          contratoId: c.id,
          comprovanteChave: input.comprovanteChave,
          criadoPor: ctx.usuario.id,
        });
        await auditar({ atorId: ctx.usuario.id, acao: "saque_principal_pago", entidade: "contrato", entidadeId: c.id, dados: { bruto: r.brutoCentavos }, ip: ctx.ip });
        const dest = await emailDoInvestidor(c.investidorId);
        if (dest) {
          void enviarEmail({
            para: dest.email,
            assunto: "Saque do principal pago",
            html: emailSaquePrincipalPago({ nome: dest.nome, bruto: formatarBRL(r.brutoCentavos), ir: formatarBRL(r.irCentavos), liquido: formatarBRL(r.liquidoCentavos), regra: r.regra }),
          });
        }
        return { ok: true as const };
      }),

    recusar: adminProcedure.input(z.object({ id: z.number().int(), motivo: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
      const [r] = await db
        .update(resgatesPrincipal)
        .set({ status: "recusado", motivoRecusa: input.motivo })
        .where(sql`${resgatesPrincipal.id} = ${input.id} and ${resgatesPrincipal.status} in ('solicitado','aprovado')`)
        .returning();
      if (!r) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este pedido não pode mais ser recusado." });
      await auditar({ atorId: ctx.usuario.id, acao: "saque_principal_recusado", entidade: "contrato", entidadeId: r.contratoId, dados: { motivo: input.motivo }, ip: ctx.ip });
      const c = await getContrato(r.contratoId);
      const dest = await emailDoInvestidor(c.investidorId);
      if (dest) void enviarEmail({ para: dest.email, assunto: "Pedido de saque não aprovado", html: emailSaquePrincipalRecusado({ nome: dest.nome, motivo: input.motivo }) });
      return { ok: true as const };
    }),
  }),
};
