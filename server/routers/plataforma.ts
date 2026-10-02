import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { router, publicProcedure } from "../_core/trpc";
import { db } from "../db";
import { ccbs, ofertas } from "../../shared/schema";
import { carregarEmissor, pendenciasParaCaptar } from "../../shared/issuer";
import { REFERENCIAS_MERCADO } from "../../shared/mercado";
import { LASTRO_EXEMPLO, type ItemLastro } from "../../shared/exemplo";
import { compararLiquido, proximaFaixa, simular, tetoDaFaixa, type Faixa } from "../../shared/finance";

const emissor = () => carregarEmissor(process.env);

async function ofertaAtiva() {
  const [o] = await db.select().from(ofertas).where(eq(ofertas.ativa, true)).orderBy(desc(ofertas.criadoEm)).limit(1);
  return o ?? null;
}

/** Faixas da oferta ativa, ou as de exemplo enquanto não houver oferta. */
async function faixasVigentes(): Promise<{ faixas: Faixa[]; exemplo: boolean }> {
  const o = await ofertaAtiva();
  if (o && emissor().autorizado) return { faixas: o.faixas as Faixa[], exemplo: false };
  return { faixas: emissor().faixas, exemplo: true };
}

export const plataformaRouter = router({
  status: publicProcedure.query(() => {
    const e = emissor();
    const pendencias = pendenciasParaCaptar(e);
    return {
      emissor: {
        autorizado: e.autorizado,
        nome: e.nome,
        cnpj: e.cnpj,
        registroCVM: e.registroCVM,
        logoUrl: e.logoUrl,
        site: e.site,
        custodiante: e.custodiante,
        auditor: e.auditor,
      },
      captacaoLiberada: pendencias.length === 0,
      pendencias,
      prazoResgateDias: e.prazoResgateDias,
      carenciaPrincipalDias: e.carenciaPrincipalDias,
      referencias: REFERENCIAS_MERCADO,
    };
  }),

  /** Composição do pool para a vitrine pública. */
  lastro: publicProcedure.query(async (): Promise<{ exemplo: boolean; itens: ItemLastro[] }> => {
    const o = await ofertaAtiva();
    if (!o || !emissor().autorizado) return { exemplo: true, itens: LASTRO_EXEMPLO };
    const linhas = await db.select().from(ccbs).where(eq(ccbs.ofertaId, o.id)).orderBy(asc(ccbs.codigo));
    return {
      exemplo: false,
      itens: linhas.map((c) => ({
        codigo: c.codigo,
        setor: c.setor,
        devedor: c.devedorDescricao,
        garantia: c.garantiaTipo,
        ltv: c.garantiaValorCentavos ? c.valorCentavos / c.garantiaValorCentavos : 0,
        situacao: c.situacao,
        diasAtraso: c.diasAtraso,
      })),
    };
  }),
});

export const simuladorRouter = router({
  calcular: publicProcedure
    .input(
      z.object({
        aporteCentavos: z.number().int().min(100_00).max(100_000_000_00),
        prazoMeses: z.number().int().min(2).max(36),
      }),
    )
    .query(async ({ input }) => {
      const { faixas, exemplo } = await faixasVigentes();
      const teto = tetoDaFaixa(faixas, input.aporteCentavos, input.prazoMeses);
      if (teto === null) {
        return { elegivel: false as const, minimoCentavos: Math.min(...faixas.map((f) => f.minimoCentavos)) };
      }
      return {
        elegivel: true as const,
        teto,
        proxima: proximaFaixa(faixas, input.aporteCentavos, input.prazoMeses),
        resultado: simular(input.aporteCentavos, input.prazoMeses, teto),
        comparacao: compararLiquido(input.aporteCentavos, input.prazoMeses, REFERENCIAS_MERCADO.itens),
        exemplo,
      };
    }),
});
