# SYSTEM_MEMORY · RioRendeFácil

Ler este arquivo e os demais de `docs/` no início de toda sessão de trabalho.

## Sessão 01 · 02/10/2026 · fundação

**Decisão de produto:** plataforma de tecnologia para emissor licenciado, não emissor próprio. Referências estudadas: Tauri Overnight (modelo de produto) e Rio Group & Securitizadora (possível emissor parceiro; mesmo endereço em Curitiba da Tauri). Uso da marca da Rio pendente de autorização formal.

**Feito:**
- `shared/finance.ts`: taxa diária equivalente composta, tabela regressiva de IR, simulação com bruto e líquido, comparação sempre líquida, rendimento sacável pro rata, data de resgate D+N.
- `shared/complianceGuard.ts`: revisor de comunicação herdado do Fact Guard do MecProAI (bloqueia "garantido", "sem risco", "dinheiro fácil", FGC indevido; alerta urgência, comparação bruta, "banco").
- `shared/issuer.ts`: config do emissor via env, faixas de exemplo, checklist que trava a captação.
- `server/schema.ts`: usuários, investidores (KYC, suitability, PPE, trilha), leads (consentimento LGPD), ofertas, CCBs do lastro, contratos, resgates com idempotência, documentos com sha256, auditoria, peças de comunicação.
- Landing, simulador, painel do investidor (demo) e revisor interno.

**Bugs achados pelos testes nesta sessão:**
1. IR contava 12 meses como 360 dias e aplicava 20% em vez de 17,5%. IR agora usa dias corridos (`mesesParaDiasCorridos`); capitalização continua em mês comercial.
2. Rendimento sacável usava a taxa diária composta de forma linear e pagava menos que a taxa contratada. Agora é pro rata linear da taxa mensal.

## Pendências

- Autorização formal de marca e contrato com o emissor; registro CVM do emissor.
- Parecer de advogado de mercado de capitais sobre oferta, publicidade e simulador.
- Autenticação (JWT + Google OAuth, padrão MecProAI).
- KYC e PLD (provedor a escolher), suitability.
- Assinatura digital (Clicksign, ZapSign ou D4Sign).
- Cofre de documentos em Cloudflare R2.
- Resend: confirmação de lead e cron de cadastro abandonado (padrão Caro).
- Trilha educativa obrigatória (padrão LMS Shadia).
- Pixel, GA4 e Clarity com consentimento.
- Atualizar `shared/mercado.ts` com fonte oficial antes de publicar.
- Primeira migração SQL via `drizzle-kit generate` (nunca `push` em produção).
