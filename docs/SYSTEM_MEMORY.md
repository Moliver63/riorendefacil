# SYSTEM_MEMORY · RioRendeFácil

Ler este arquivo e os demais de `docs/` no início de toda sessão de trabalho.

## Sessão 01 · 02/10/2026 · fundação

**Decisão de produto:** plataforma de tecnologia para emissor licenciado, não emissor próprio. Referências estudadas: Tauri Overnight (modelo de produto) e Rio Group & Securitizadora (possível emissor parceiro; mesmo endereço em Curitiba da Tauri). Uso da marca da Rio pendente de autorização formal.

**Feito:**
- `shared/finance.ts`: taxa diária equivalente composta, tabela regressiva de IR, simulação com bruto e líquido, comparação sempre líquida, rendimento sacável pro rata, data de resgate D+N.
- `shared/complianceGuard.ts`: revisor de comunicação herdado do Fact Guard do MecProAI (bloqueia "garantido", "sem risco", "dinheiro fácil", FGC indevido; alerta urgência, comparação bruta, "banco").
- `shared/issuer.ts`: config do emissor via env, faixas de exemplo, checklist que trava a captação.
- `shared/schema.ts` (era `server/schema.ts`): usuários, investidores (KYC, suitability, PPE, trilha), leads (consentimento LGPD), ofertas, CCBs do lastro, contratos, resgates com idempotência, documentos com sha256, auditoria, peças de comunicação.
- Landing, simulador, painel do investidor (demo) e revisor interno.

**Bugs achados pelos testes nesta sessão:**
1. IR contava 12 meses como 360 dias e aplicava 20% em vez de 17,5%. IR agora usa dias corridos (`mesesParaDiasCorridos`); capitalização continua em mês comercial.
2. Rendimento sacável usava a taxa diária composta de forma linear e pagava menos que a taxa contratada. Agora é pro rata linear da taxa mensal.

## Sessão 02 · 02/10/2026 · arquitetura completa

**Base:** estudo do código real de `caroceramica`, `shadiahasan` e `mecpro`. Estrutura e padrões documentados em `docs/ARQUITETURA.md`.

**Feito:**
- Servidor reorganizado em `server/_core` + `routers/` + `routes/` + `lib/` + `auth/` (padrão Caro). Schema movido para `shared/schema.ts`.
- Banco: `pg` com ajuste de SSL do Render em produção; PGlite (Postgres embutido) em dev e testes. Migração `drizzle/0000_inicial.sql` gerada pelo drizzle-kit e aplicada no boot.
- Login sem senha: link mágico (hash, 15 min, uso único) e Google OAuth com `state`. Sessão JWT assinada com `versaoSessao`. Papéis investidor, assessor e admin; `ADMIN_EMAILS` promove no login.
- Trilha educativa de 4 módulos com quiz e liberação em ordem; suitability com bloqueios (sem reserva, prazo curto, conservador); manifestação de interesse exige os dois.
- Painel real a partir de contratos; resgate com idempotência, travado até o emissor estar habilitado.
- Admin: visão geral, leads com status e notas, ofertas e CCBs, documentos no R2 com SHA-256 calculado no navegador, revisor de comunicação, usuários e auditoria.
- E-mails (lead, aviso à equipe, link de acesso, lembretes), cron de leads parados e trilha abandonada, sitemap, robots, meta tags no servidor, artigos públicos, consentimento de cookies com GA4/Pixel/Clarity.
- `render.yaml` com web, Postgres e cron.
- 35 testes (finanças, revisor, integração com banco e HTTP), incluindo cookie forjado.

**Achados nos repositórios de referência (avisados ao Michel):**
- `shadiahasan` (público): arquivo com URL do Postgres e senha, arquivo com chave JWT, relatórios de env com segredos; sessão aceita cookie JSON sem assinatura (permite se passar por admin).
- `mecpro` (público): URLs de banco com senha em scripts Python; `chave.txt` a conferir.

## Pendências

- Autorização formal de marca e contrato com o emissor; registro CVM do emissor.
- Parecer de advogado de mercado de capitais sobre oferta, publicidade e simulador.
- KYC e PLD (provedor a escolher).
- Assinatura digital (Clicksign, ZapSign ou D4Sign) e cadastro de contrato pelo admin.
- Tela de resgate no painel (o endpoint existe e está testado).
- Imagem `client/public/og.png` para compartilhamento.
- Atualizar `shared/mercado.ts` com fonte oficial antes de publicar.
- Validar o questionário de suitability com o emissor e o jurídico.

## Histórico de pendências da sessão 01
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
