import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  compararLiquido,
  proximaFaixa,
  rendimentoAcumulado,
  dataPagamentoResgate,
  simular,
  tetoDaFaixa,
} from "../shared/finance";
import { avaliarTexto } from "../shared/complianceGuard";
import { carregarEmissor, pendenciasParaCaptar } from "../shared/issuer";
import { REFERENCIAS_MERCADO } from "../shared/mercado";
import { leadsRepo } from "./repo";

const t = initTRPC.create();
const emissor = () => carregarEmissor(process.env);

export const CONSENTIMENTO_LEAD =
  "Autorizo o uso dos meus dados para contato sobre a plataforma, conforme a Política de Privacidade. Entendo que o contato não é oferta de investimento.";

export const appRouter = t.router({
  plataforma: t.router({
    /** O que a interface pode mostrar sobre o emissor e se a captação está liberada. */
    status: t.procedure.query(() => {
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
  }),

  simulador: t.router({
    calcular: t.procedure
      .input(
        z.object({
          aporteCentavos: z.number().int().min(100_00).max(100_000_000_00),
          prazoMeses: z.number().int().min(2).max(36),
          taxaMensal: z.number().min(0).max(0.05).optional(),
        }),
      )
      .query(({ input }) => {
        const e = emissor();
        const teto = tetoDaFaixa(e.faixas, input.aporteCentavos, input.prazoMeses);
        if (teto === null) {
          return { elegivel: false as const, minimoCentavos: Math.min(...e.faixas.map((f) => f.minimoCentavos)) };
        }
        const taxa = Math.min(input.taxaMensal ?? teto, teto);
        const resultado = simular(input.aporteCentavos, input.prazoMeses, taxa);
        return {
          elegivel: true as const,
          teto,
          proxima: proximaFaixa(e.faixas, input.aporteCentavos, input.prazoMeses),
          resultado,
          comparacao: compararLiquido(input.aporteCentavos, input.prazoMeses, REFERENCIAS_MERCADO.itens),
          exemplo: !e.autorizado,
        };
      }),
  }),

  leads: t.router({
    criar: t.procedure
      .input(
        z.object({
          nome: z.string().trim().min(3).max(255),
          email: z.string().trim().email(),
          telefone: z.string().trim().min(10).max(20),
          faixaPatrimonio: z.string().max(64).optional(),
          consentimento: z.literal(true),
          origem: z.string().max(64).default("site"),
          utm: z.record(z.string()).optional(),
          simulacao: z.unknown().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const lead = await leadsRepo.criar({
          ...input,
          consentimentoLGPD: true,
          consentimentoTexto: CONSENTIMENTO_LEAD,
        });
        return { ok: true, id: lead.id };
      }),
  }),

  compliance: t.router({
    /** Valida uma peça (anúncio, post, e-mail) antes de publicar. */
    avaliar: t.procedure
      .input(z.object({ texto: z.string().min(1).max(5000) }))
      .mutation(({ input }) => avaliarTexto(input.texto)),
  }),

  investidor: t.router({
    /**
     * Painel do investidor. Enquanto não há autenticação e emissor real,
     * devolve uma carteira de DEMONSTRAÇÃO, marcada como tal.
     */
    painelDemo: t.procedure.query(() => {
      const e = emissor();
      const principal = 100_000_00;
      const taxa = 0.013;
      const dias = 94;
      const resgatado = 2_500_00;
      const acc = rendimentoAcumulado(principal, taxa, dias, resgatado);
      const hoje = new Date();
      return {
        demo: true,
        contratos: [
          {
            id: 1,
            oferta: "Pool exemplo: agro + imobiliário",
            principalCentavos: principal,
            taxaMensal: taxa,
            inicio: new Date(hoje.getTime() - dias * 86400000).toISOString().slice(0, 10),
            vencimento: new Date(hoje.getTime() + (365 - dias) * 86400000).toISOString().slice(0, 10),
            rendimentoBrutoCentavos: acc.brutoCentavos,
            resgatadoCentavos: resgatado,
            disponivelCentavos: acc.disponivelCentavos,
          },
        ],
        proximoPagamentoSeSolicitarHoje: dataPagamentoResgate(hoje, e.prazoResgateDias).toISOString().slice(0, 10),
        lastro: [
          { codigo: "CCB-EX-001", setor: "agro", devedor: "Produtor de soja, MT", garantia: "CPR + alienação de grãos", ltv: 0.62, situacao: "adimplente", diasAtraso: 0 },
          { codigo: "CCB-EX-002", setor: "imobiliario", devedor: "Incorporadora, SC", garantia: "Alienação fiduciária de imóvel", ltv: 0.48, situacao: "adimplente", diasAtraso: 0 },
          { codigo: "CCB-EX-003", setor: "agro", devedor: "Cooperativa de café, MG", garantia: "Recebíveis + aval", ltv: 0.71, situacao: "atraso", diasAtraso: 12 },
          { codigo: "CCB-EX-004", setor: "imobiliario", devedor: "Loteadora, PR", garantia: "Alienação fiduciária de lotes", ltv: 0.55, situacao: "adimplente", diasAtraso: 0 },
        ],
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
