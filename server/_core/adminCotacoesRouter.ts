/**
 * Cotações cambiais (admin.cotacoes): registro manual com fonte e importação
 * da PTAX do Banco Central. Toda gravação vai para a auditoria com o valor anterior.
 */
import { z } from "zod";
import { router, adminProcedure } from "./trpc";
import { auditar } from "../auditoria";
import { buscarPtax, listarCotacoes, registrarCotacao, ultimaCotacao } from "../cotacaoService";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const cotacoesRoutes = {
  cotacoes: router({
    listar: adminProcedure.query(async () => ({ ultima: await ultimaCotacao("USD"), historico: await listarCotacoes(30) })),

    registrar: adminProcedure
      .input(z.object({ valor: z.number().positive().max(100), data: dataIso, fonte: z.string().trim().min(3).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const r = await registrarCotacao({ moeda: "USD", ...input }, ctx.usuario.id);
        await auditar({
          atorId: ctx.usuario.id,
          acao: r.anterior === null ? "cotacao_registrada" : "cotacao_corrigida",
          entidade: "cotacao",
          entidadeId: r.cotacao.id,
          dados: { moeda: "USD", data: input.data, fonte: input.fonte, valor: { antes: r.anterior, depois: input.valor } },
          ip: ctx.ip,
        });
        return r.cotacao;
      }),

    importarPtax: adminProcedure.mutation(async ({ ctx }) => {
      const c = await buscarPtax();
      const r = await registrarCotacao(c, ctx.usuario.id);
      await auditar({
        atorId: ctx.usuario.id,
        acao: "cotacao_importada",
        entidade: "cotacao",
        entidadeId: r.cotacao.id,
        dados: { moeda: c.moeda, data: c.data, fonte: c.fonte, valor: { antes: r.anterior, depois: c.valor } },
        ip: ctx.ip,
      });
      return c;
    }),
  }),
};
