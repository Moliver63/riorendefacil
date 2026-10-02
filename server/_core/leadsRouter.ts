import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { ENV } from "./env";
import { db } from "../db";
import { leads } from "../schema";
import { emailAvisoLeadEquipe, emailLeadRecebido, enviarEmail } from "./email";
import { auditar } from "../auditoria";

export const CONSENTIMENTO_LEAD =
  "Autorizo o uso dos meus dados para contato sobre a plataforma, conforme a Política de Privacidade. Entendo que o contato não é oferta de investimento.";

export const leadsRouter = router({
  criar: publicProcedure
    .input(
      z.object({
        nome: z.string().trim().min(3).max(255),
        email: z.string().trim().email().max(255),
        telefone: z.string().trim().regex(/^\d{10,13}$/, "Telefone inválido"),
        faixaPatrimonio: z.string().max(64).optional(),
        consentimento: z.literal(true),
        origem: z.string().max(64).default("site"),
        utm: z.record(z.string().max(200)).optional(),
        simulacao: z
          .object({ aporte: z.number(), prazo: z.number(), saldoLiquido: z.number() })
          .partial()
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [lead] = await db
        .insert(leads)
        .values({
          nome: input.nome,
          email: input.email.toLowerCase(),
          telefone: input.telefone,
          faixaPatrimonio: input.faixaPatrimonio ?? null,
          origem: input.origem,
          utm: input.utm ?? null,
          simulacao: input.simulacao ?? null,
          consentimentoLGPD: true,
          consentimentoTexto: CONSENTIMENTO_LEAD,
        })
        .returning({ id: leads.id });

      await auditar({ acao: "lead_criado", entidade: "lead", entidadeId: lead!.id, ip: ctx.ip });

      // E-mails são melhor esforço e não seguram a resposta.
      void enviarEmail({ para: input.email, assunto: "Recebemos seu contato", html: emailLeadRecebido(input.nome) });
      for (const para of ENV.emailsAssessores) {
        void enviarEmail({
          para,
          assunto: `Novo lead: ${input.nome}`,
          html: emailAvisoLeadEquipe({ nome: input.nome, email: input.email, telefone: input.telefone, faixa: input.faixaPatrimonio }),
        });
      }
      return { ok: true as const, id: lead!.id };
    }),
});
