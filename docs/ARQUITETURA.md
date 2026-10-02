# Arquitetura · RioRendeFácil

Monólito Node + React em TypeScript, uma porta só, organizado no mesmo formato do MecProAI. Padrões da Caro e da Shadia aparecem onde fazem sentido (cron, e-mail, SEO, papéis, trilha).

```
client/                         React 18 + Vite + wouter + Tailwind (mesmo formato do MecProAI)
  index.html                    <!--meta--> recebe as tags do servidor (SEO para bots)
  public/                       favicon
  src/
    main.tsx                    só monta o <App />
    App.tsx                     providers (tRPC, React Query), ErrorBoundary e TODAS as rotas
    index.css                   @tailwind + tokens de cor e componentes base
    lib/trpc.ts                 trpc, trpcClient e queryClient
    lib/analytics.ts            GA4, Pixel e Clarity só com consentimento
    hooks/useAuth.ts            sessão via GET /api/auth/me
    components/
      SEO.tsx                   título e meta em navegação SPA
      layout/Layout.tsx         moldura da área logada (investidor e equipe)
      landing/                  SiteLayout (topo, rodapé, selo do emissor), Simulador, FormContato
      shared/                   ProtectedRoute, ErrorBoundary, CookieConsent
    pages/                      uma página por arquivo, sem subpastas
      Landing, Conteudo, Artigo, Login, NotFound
      Painel, Trilha, TrilhaModulo, Perfil, Documentos
      AdminDashboard, AdminLeads, AdminComunicacao, AdminOfertas, AdminUsuarios, AdminAuditoria

server/
  _core/
    index.ts                    Express: segurança, cookies, JSON, REST, tRPC, Vite/estático
    router.ts                   appRouter: junta todos os *Router.ts
    trpc.ts                     publicProcedure, protectedProcedure, comPapel, equipe, admin
    context.ts                  usuário da sessão (JWT + versaoSessao)
    env.ts                      variáveis; falha no boot se faltar segredo em produção
    sessao.ts                   assinar e ler JWT (jose), cookie httpOnly
    authRouter.ts               procedures de login
    plataformaRouter.ts         status, lastro, simulador
    leadsRouter.ts              captação
    trilhaRouter.ts             trilha educativa
    investidorRouter.ts         perfil, suitability, painel, documentos, interesse, resgate
    adminRouter.ts              funil, leads, ofertas, CCBs, documentos, comunicação, usuários, auditoria
    authRoutes.ts               REST: /api/auth/me e /api/auth/logout
    linkAcesso.ts               REST: link mágico
    oauthGoogle.ts              REST: login com Google
    cronRouter.ts               REST: lembretes
    seo.ts                      sitemap, robots, meta tags por rota
    email.ts                    Resend e modelos de e-mail
    rateLimit.ts, security.ts, vite.ts
  schema.ts                     tabelas Drizzle
  db.ts                         conexão (pg ou PGlite), migrações e funções getUserById, getOrCreateInvestidor...
  contas.ts                     encontrar ou criar usuário
  storage.ts                    Cloudflare R2 com URL assinada
  auditoria.ts                  trilha de auditoria
  logger.ts                     log.info / log.error (JSON em produção)
  __tests__/                    integração com banco real em memória e HTTP

shared/                         usado por cliente e servidor
  const.ts, finance.ts, complianceGuard.ts, issuer.ts, trilha.ts, suitability.ts, conteudo.ts, mercado.ts, exemplo.ts

drizzle/                        SQL gerado por `npm run db:generate`, aplicado no boot
render.yaml                     web + Postgres + cron
tsconfig.json                   aliases @/ (client/src) e ~shared/ (shared)
tsconfig.server.json            checagem só do servidor (npm run check:server)
```

O mapa de todas as rotas (páginas, REST e tRPC) está em `docs/ROTAS.md`.

## Fluxo do investidor

1. Visita o site, simula (sempre líquido de IR) e deixa contato. O lead é gravado com o texto exato do consentimento.
2. Entra por link mágico ou Google. Não existe senha.
3. Faz a trilha: 4 módulos que abrem em ordem, com quiz de 3 perguntas (mínimo 2 acertos).
4. Responde o perfil. Quem não tem reserva, precisa do dinheiro em menos de 6 meses ou é conservador recebe "não adequado" com o motivo.
5. Manifesta interesse. A equipe recebe aviso e conduz contrato e aporte com o emissor.
6. Com contrato ativo, o painel mostra principal, rendimento disponível e o lastro real.

## Regras que não podem ser quebradas

- Dinheiro nunca passa pela plataforma. Aporte e resgate são da conta vinculada do emissor.
- Resgate e captação ficam travados enquanto `pendenciasParaCaptar()` não estiver vazio.
- Sessão é sempre JWT assinado. Nunca confiar em cookie em texto puro.
- Toda ação sensível gera linha em `auditoria`.
- Texto público passa pelo `complianceGuard` (os artigos são verificados nos testes).
- Migração só por `npm run db:generate` + boot. Nunca `drizzle-kit push`.

## Rodar

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:3000, banco PGlite em .data/ (sem instalar Postgres)
npm test         # 35 testes (npm run test:finance, test:compliance, test:integracao)
npm run check
```

Para virar admin localmente, coloque seu e-mail em `ADMIN_EMAILS` e entre pelo link mágico. Sem Resend configurado, a tela de entrada mostra o link direto.
