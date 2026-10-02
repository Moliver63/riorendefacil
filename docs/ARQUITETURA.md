# Arquitetura · RioRendeFácil

Monólito Node + React, uma porta só, no mesmo formato dos outros projetos do Lab Quântico. Cada peça indica de onde veio o padrão.

```
client/                     React 18 + Vite + wouter
  index.html                <!--meta--> recebe as tags do servidor (SEO para bots)
  public/                   favicon, og.png
  src/
    main.tsx                tRPC + superjson, sem retry em 4xx            ← Caro
    App.tsx                 rotas; área logada e admin com lazy()         ← Caro
    lib/                    trpc, analytics com consentimento, seo
    components/             Layout (público), AreaLogada, Protegida, Simulador, FormContato, Consentimento
    routes/                 Home, Conteudo, Artigo, Entrar, NaoEncontrado
      investidor/           Painel, Trilha, Modulo, Perfil, Documentos
      admin/                AdminInicio, AdminLeads, AdminOfertas, AdminComunicacao, AdminUsuarios, AdminAuditoria
    styles/globals.css      tokens de cor e tipografia + componentes

server/
  _core/
    index.ts                Express: segurança, cookies, JSON, rotas, tRPC  ← Caro (estrutura) + MecProAI (parser antes das rotas)
    env.ts                  falha no boot se faltar segredo em produção   ← correção da Shadia
    sessao.ts               JWT HS256 (jose) em cookie httpOnly           ← MecProAI
    context.ts              carrega usuário e confere versaoSessao
    trpc.ts                 public / protected / comPapel / equipe / admin ← Shadia
    rateLimit.ts            limites por rota e por procedure              ← Shadia
    security.ts             HSTS, CSP, nosniff, frame-ancestors
    vite.ts                 Vite como middleware em dev, estático em prod ← Caro
  auth/                     link mágico (link.ts), Google OAuth (google.ts), regras de conta
  routers/                  auth, plataforma+simulador, leads, trilha, investidor, admin
  routes/                   cron.ts (lembretes) ← Caro; seo.ts (sitemap, robots, meta) ← Caro
  lib/                      email (Resend, melhor esforço) ← Caro; storage (R2, URL assinada) ← Shadia; auditoria
  db.ts                     pg no Render (ajuste de SSL da Caro) ou PGlite em dev/teste
  __tests__/                integração com banco real em memória e HTTP

shared/                     usado por cliente e servidor
  schema.ts                 tabelas Drizzle                               ← Caro
  const.ts                  papéis, status, mensagens
  finance.ts                juros, IR, simulação (puro, testado)
  complianceGuard.ts        revisor de comunicação                        ← Fact Guard do MecProAI
  issuer.ts                 emissor parceiro e checklist de captação
  trilha.ts                 módulos, quiz e liberação em ordem            ← learning path da Shadia
  suitability.ts            questionário de perfil
  conteudo.ts               artigos públicos
  mercado.ts, exemplo.ts    referências de mercado e lastro de exemplo

drizzle/                    SQL gerado por `npm run db:generate`, aplicado no boot
render.yaml                 web + cron                                    ← MecProAI
```

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
npm test         # 35 testes
npm run check
```

Para virar admin localmente, coloque seu e-mail em `ADMIN_EMAILS` e entre pelo link mágico. Sem Resend configurado, a tela de entrada mostra o link direto.
