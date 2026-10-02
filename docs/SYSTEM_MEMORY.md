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

## Sessão 03 · 02/10/2026 · estrutura no formato do MecProAI

Pedido do Michel: usar a arquitetura do MecProAI e montar as rotas em geral. Tudo já era TypeScript; a mudança foi de organização, sem alterar lógica.

- Servidor: `server/_core/router.ts` como appRouter; sub-routers em `_core/*Router.ts`; `schema.ts`, `db.ts` (com getUserById, getUserByEmail, getOrCreateInvestidor, getOfertaAtiva), `storage.ts`, `auditoria.ts`, `contas.ts`, `logger.ts` direto em `server/`.
- REST novo: `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/client-error` (20/min). `.map` sempre 404.
- Cliente: `pages/` sem subpastas, `components/{layout,landing,shared}`, `hooks/useAuth.ts` (REST), `lib/trpc.ts` exporta trpc, trpcClient e queryClient; providers no `App.tsx`; `ErrorBoundary` reporta ao servidor; aliases `@/` e `~shared/`.
- Tailwind 3 com as cores da marca (preflight desligado para não conflitar com `index.css`). Build com sourcemap hidden e chunks vendor-react e vendor-trpc.
- `tsconfig.server.json` + `npm run check:server`; scripts `test:finance`, `test:compliance`, `test:integracao`.
- `docs/ROTAS.md` com todas as páginas, REST e procedures.
- Verificado: 35 testes, tipos de cliente e servidor, build, e navegador passando por todas as páginas como visitante, investidor e admin.

## Sessão 04 · 02/10/2026 · deploy no Render e login com Google

- Render (workspace michel's workspace): web `riorendefacil` (srv-davtf2m0tbcc73fbbthg, free, Ohio, https://riorendefacil.onrender.com) e Postgres `riorendefacil-db` (dpg-davteqs9v7es7394n7c0-a, free, expira 01/11/2026). Build ok. Boot dependia de DATABASE_URL, cadastrada pelo Michel no painel (primeira tentativa com senha errada).
- Corrigido: no pacote `dist/index.js` a raiz do projeto era calculada um nível acima; agora `raizDoProjeto()` sobe até o package.json. HEAD nas páginas. Testado contra Postgres local com o pacote de produção.
- Login com Google no formato do MecProAI (mesmas rotas, `GOOGLE_CALLBACK_URL` opcional, retorno à página de origem), mantendo `state` aleatório em cookie. Tela de entrada com Google como opção principal e e-mail como alternativa.
- OAuth client criado pelo Michel no projeto Google Cloud `megaprop-452515`, modo Testing. Pendências: GOOGLE_CLIENT_ID/SECRET no Render, trocar o secret (foi colado no chat), ajustar nome do app na tela de consentimento, adicionar test users ou publicar.
- 38 testes, incluindo o fluxo completo do Google com respostas simuladas.

## Sessão 05 · 02/10/2026 · cadastro e ciclo do investimento

- Cadastro do investidor em 5 etapas (`/cadastro`): dados pessoais, endereço (ViaCEP), perfil financeiro e PEP, conta para resgate, revisão com declaração. Validado pelo mesmo esquema no cliente e no servidor (`shared/cadastro.ts`). Dados sensíveis cifrados.
- Ciclo completo: admin gera contrato pela ficha do investidor → investidor lê o termo (`/contrato/:id`, imprimível) → admin marca assinado → confirma aporte com data de início e comprovante → contrato ativo → painel com saldo, rendimento disponível, gráfico e extrato → investidor pede resgate com prévia de IR → admin aprova e marca pago.
- Geração de contrato travada até `EMISSOR_AUTORIZADO` e dados do emissor estarem no ambiente. Assinatura ainda é marcada à mão pelo admin.
- Migração `drizzle/0001_cadastro_e_ciclo.sql`, só aditiva. 45 testes, incluindo o ciclo inteiro. Fluxo conferido no navegador em desktop e celular.

## Sessão 06 · 02/10/2026 · lastro em operações de grãos

- Tese nova definida por Michel: o capital financia compra à vista de soja, milho e sorgo pela Rio e revenda a compradores aprovados, com conta vinculada, ordem de pagamento e CCBs com imóvel como camada de garantia (cobertura mínima 130%). Formato de prateleira de ofertas inspirado em XP e BTG.
- Modelo: `operacoes_graos`, `lancamentos_conta` (valor com sinal, nunca apagado), `reservas`; ofertas ganharam código, tese, cobertura mínima, captação alvo, ciclo médio e data limite de reservas; CCB ganhou valor elegível. Migração `0002_graos_e_garantias.sql`, só aditiva. Várias ofertas podem ficar ativas.
- Regras puras em `shared/lastroGraos.ts`: posição da oferta, cobertura, trava, margem liberável (só o que sobra depois de principal + rendimento acumulado, com atraso fora dos ativos), alocação proporcional do contrato.
- Travas: contrato novo que derrubaria a cobertura abaixo do mínimo; compra sem saldo na conta; compra e reserva com cobertura abaixo do mínimo; margem acima do liberável.
- Lançamentos automáticos: aporte confirmado, compra, custos, recebimento e resgate pago.
- Telas: prateleira `/ofertas`, ficha `/ofertas/:id` com reserva, aba "Onde está seu dinheiro" no painel, admin de operações e conta vinculada, editor da ficha e garantias. Landing, trilha e termo de adesão reescritos para grãos.
- 54 testes. Fluxo completo conferido no navegador.

## Pendências

- Autorização formal de marca e contrato com o emissor; registro CVM do emissor.
- Parecer de advogado de mercado de capitais sobre oferta, publicidade e simulador.
- KYC e PLD (provedor a escolher).
- Assinatura digital (Clicksign, ZapSign ou D4Sign) integrada; hoje o admin marca como assinado.
- `DADOS_SECRET` no Render antes de cadastros reais.
- Minuta oficial do emissor para substituir o termo de adesão resumido.
- Enquadramento CVM do modelo de grãos (contrato de investimento coletivo; caminhos possíveis: CRA por securitizadora com distribuidor, ou crowdfunding pela Resolução 88).
- Integração com o motor de viabilidade do LogPro para avaliar cada operação antes da compra.
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
