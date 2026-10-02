# Rotas · RioRendeFácil

Mapa completo de tudo que o site responde. Três camadas, como no MecProAI:

1. **Páginas** (React + wouter) em `client/src/App.tsx`
2. **REST** (Express) em `server/_core/index.ts`
3. **tRPC** (procedures) em `server/_core/router.ts` e `server/_core/*Router.ts`

Papéis: `investidor`, `assessor`, `admin`. "Equipe" = assessor ou admin.

---

## 1. Páginas

| Rota | Arquivo | Acesso |
|---|---|---|
| `/` | `pages/Landing.tsx` | público |
| `/conteudo` | `pages/Conteudo.tsx` | público |
| `/conteudo/:slug` | `pages/Artigo.tsx` | público |
| `/entrar` | `pages/Login.tsx` | público |
| `/ofertas` | `pages/Ofertas.tsx` | público (moldura logada para investidor) |
| `/ofertas/:id` | `pages/OfertaDetalhe.tsx` | público; reserva só para investidor |
| `/painel` | `pages/Painel.tsx` | investidor |
| `/trilha` | `pages/Trilha.tsx` | investidor |
| `/trilha/:slug` | `pages/TrilhaModulo.tsx` | investidor |
| `/perfil` | `pages/Perfil.tsx` | investidor |
| `/documentos` | `pages/Documentos.tsx` | investidor |
| `/cadastro` | `pages/Cadastro.tsx` | investidor |
| `/contrato/:id` | `pages/ContratoDocumento.tsx` | investidor (só os próprios) |
| `/admin` | `pages/AdminDashboard.tsx` | equipe |
| `/admin/leads` | `pages/AdminLeads.tsx` | equipe |
| `/admin/comunicacao` | `pages/AdminComunicacao.tsx` | equipe |
| `/admin/ofertas` | `pages/AdminOfertas.tsx` | admin |
| `/admin/usuarios` | `pages/AdminUsuarios.tsx` | admin |
| `/admin/auditoria` | `pages/AdminAuditoria.tsx` | admin |
| `/admin/investidores` | `pages/AdminInvestidores.tsx` | admin |
| `/admin/movimentacoes` | `pages/AdminMovimentacoes.tsx` | admin |
| `/admin/resgates` | `pages/AdminResgates.tsx` | admin (só saques de rendimento) |
| `/admin/operacoes` | `pages/AdminOperacoes.tsx` | admin |
| qualquer outra | `pages/NotFound.tsx` | público |

Sem login, quem abre uma página protegida vai para `/entrar?voltar=...`. Logado com papel errado, vai para o início do próprio papel (`/painel` ou `/admin`). O bloqueio de verdade é no servidor: a guarda do cliente é só navegação.

## 2. REST

| Método e rota | Arquivo | O que faz |
|---|---|---|
| `GET /api/health` | `_core/index.ts` | status e tipo de banco |
| `GET /api/auth/me` | `_core/authRoutes.ts` | usuário da sessão ou `null` (usado pelo `useAuth`) |
| `POST /api/auth/logout` | `_core/authRoutes.ts` | apaga o cookie de sessão |
| `GET /api/auth/link?t=` | `_core/linkAcesso.ts` | consome o link mágico, grava sessão, redireciona |
| `GET /api/auth/google?voltar=/caminho` | `_core/oauthGoogle.ts` | inicia login com Google; `state` aleatório e destino em cookie httpOnly |
| `GET /api/auth/google/callback` | `_core/oauthGoogle.ts` | confere o `state`, cria ou encontra a conta, grava sessão e volta para `voltar` (só caminhos internos) |
| `POST /api/cron/lembretes` | `_core/cronRouter.ts` | lembretes de lead parado e trilha abandonada. Exige `Authorization: Bearer CRON_SECRET` |
| `POST /api/client-error` | `_core/index.ts` | recebe erro do ErrorBoundary e grava no log (20/min) |
| `GET /sitemap.xml` | `_core/seo.ts` | páginas públicas e artigos |
| `GET /robots.txt` | `_core/seo.ts` | bloqueia `/admin`, `/painel`, `/trilha`, `/api/` |
| `GET *.map` | `_core/index.ts` | sempre 404 |
| demais `GET` | `_core/vite.ts` | entrega o app com meta tags por rota |

## 3. tRPC (`/api/trpc/<procedure>`)

Leitura é `query` (GET), escrita é `mutation` (POST). Formato superjson.

### auth · `_core/authRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `auth.eu` | query | público | sessão atual (equivalente ao `/api/auth/me`) |
| `auth.metodos` | query | público | se o login com Google está ligado |
| `auth.pedirLink` | mutation | público, 6 a cada 15 min | envia link mágico por e-mail |
| `auth.sair` | mutation | logado | encerra a sessão |
| `auth.sairDeTodos` | mutation | logado | derruba a sessão em todos os aparelhos |

### plataforma e simulador · `_core/plataformaRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `plataforma.status` | query | público | emissor, pendências para captar, referências de mercado |
| `plataforma.lastro` | query | público | CCBs da oferta ativa, ou exemplo |
| `simulador.calcular` | query | público | simulação bruta e líquida com faixas |

### leads · `_core/leadsRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `leads.criar` | mutation | público, 6 por hora | grava contato com consentimento e avisa a equipe |

### trilha · `_core/trilhaRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `trilha.estado` | query | logado | módulos liberados e concluídos |
| `trilha.modulo` | query | logado | conteúdo e perguntas, sem gabarito |
| `trilha.responder` | mutation | logado | corrige o quiz e conclui o módulo |

### investidor · `_core/investidorRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `investidor.perfil` | query | investidor | dados, perfil, datas de trilha e interesse |
| `investidor.atualizarPerfil` | mutation | investidor | nome e telefone |
| `investidor.questoesSuitability` | query | investidor | perguntas do perfil |
| `investidor.salvarSuitability` | mutation | investidor | calcula e grava o perfil |
| `investidor.cadastro` | query | investidor | cadastro completo (decifrado) para revisar |
| `investidor.salvarCadastro` | mutation | investidor | grava cadastro; CPF, RG, conta e Pix cifrados; CPF único por conta |
| `investidor.painel` | query | investidor | contratos, saldo, rendimento disponível, IR estimado e curva de evolução |
| `investidor.contrato` | query | investidor | um contrato próprio com a qualificação congelada |
| `investidor.extrato` | query | investidor | aporte e resgates do contrato |
| `investidor.previaResgate` | query | investidor | IR e líquido de um valor antes de pedir |
| `investidor.resgates` | query | investidor | pedidos de resgate |
| `investidor.dadosDeposito` | query | investidor | conta vinculada e contratos aguardando aporte |
| `investidor.prepararComprovante` / `informarDeposito` | mutation | investidor | envio do comprovante e aviso de depósito |
| `investidor.previaSaquePrincipal` / `solicitarSaquePrincipal` | query / mutation | investidor | saque do principal (vencimento ou antecipado) |
| `investidor.movimentacoes` | query | investidor | depósitos e saques |
| `investidor.oferta` | query | investidor | ficha da oferta (inclusive encerrada, se tiver contrato) com a reserva própria |
| `investidor.pendencias` | query | investidor | etapas que faltam antes de reservar |
| `investidor.reservar` | mutation | investidor | reserva valor e prazo com a taxa da faixa; uma ativa por oferta |
| `investidor.reservas` / `cancelarReserva` | query / mutation | investidor | reservas em aberto |
| `investidor.documentos` | query | investidor | documentos visíveis para a conta |
| `investidor.baixarDocumento` | mutation | investidor | URL assinada de 5 min, se o documento for da conta |
| `investidor.manifestarInteresse` | mutation | investidor | exige trilha, perfil adequado e cadastro |
| `investidor.solicitarResgate` | mutation | investidor | só contrato ativo e emissor habilitado; IR gravado; idempotente |

### admin · `_core/adminRouter.ts`
| Procedure | Tipo | Acesso | Descrição |
|---|---|---|---|
| `admin.resumo` | query | equipe | números do funil |
| `admin.leads.listar` | query | equipe | leads, filtro por status |
| `admin.leads.atualizar` | mutation | equipe | status e notas |
| `admin.comunicacao.avaliar` | mutation | equipe | revisor de texto |
| `admin.comunicacao.salvar` | mutation | equipe | salva peça aprovada pelo revisor |
| `admin.comunicacao.listar` | query | equipe | peças salvas |
| `admin.ofertas.listar` | query | admin | ofertas |
| `admin.ofertas.salvar` | mutation | admin | cria ou edita oferta e faixas |
| `admin.ofertas.ativar` | mutation | admin | ativa uma e desativa as outras |
| `admin.ccbs.listar` | query | admin | CCBs de uma oferta |
| `admin.ccbs.salvar` | mutation | admin | cria ou edita CCB |
| `admin.documentos.prepararEnvio` | mutation | admin | URL de envio para o R2 |
| `admin.documentos.registrar` | mutation | admin | grava documento com SHA-256 |
| `admin.usuarios.listar` | query | admin | usuários |
| `admin.usuarios.mudarPapel` | mutation | admin | troca papel e derruba sessões antigas |
| `admin.auditoria` | query | admin | últimos 200 eventos |
| `admin.investidores.listar` | query | admin | investidores com etapas (trilha, perfil, cadastro) e CPF mascarado |
| `admin.investidores.detalhe` | query | admin | ficha decifrada; cada abertura vai para a auditoria |
| `admin.contratos.listar` | query | admin | contratos, filtro por status |
| `admin.contratos.criar` | mutation | admin | exige emissor habilitado, oferta ativa, trilha, perfil e cadastro; taxa vem da faixa |
| `admin.contratos.marcarAssinado` | mutation | admin | aguardando_assinatura → aguardando_aporte |
| `admin.contratos.confirmarAporte` | mutation | admin | aguardando_aporte → ativo; define início e vencimento |
| `admin.contratos.cancelar` | mutation | admin | só antes de ativo |
| `admin.contratos.extrato` | query | admin | extrato de um contrato |
| `admin.operacoes.painel` | query | admin | posição da oferta: caixa, em operação, a receber, obrigações, cobertura, margem liberável |
| `admin.operacoes.salvar` | mutation | admin | nova operação de grão (edição só em análise) |
| `admin.operacoes.registrarCompra` | mutation | admin | exige cobertura e saldo; lança compra e custos na conta |
| `admin.operacoes.registrarTransporte` / `registrarVenda` | mutation | admin | transportadora e destino; comprador, valor e vencimento do recebível |
| `admin.operacoes.registrarRecebimento` | mutation | admin | aceita parcelas; lança recebimento na conta |
| `admin.operacoes.marcarAtraso` / `cancelar` | mutation | admin | atraso do comprador; cancelamento só em análise |
| `admin.conta.extrato` | query | admin | lançamentos da conta vinculada |
| `admin.conta.lancar` | mutation | admin | custos, margem da Rio (limitada pela ordem de pagamento), principal devolvido, ajuste |
| `admin.depositos.listar` / `confirmar` / `recusar` | query / mutation | admin | depósitos informados; confirmar ativa o contrato |
| `admin.saquesPrincipal.listar` / `aprovar` / `marcarPago` / `recusar` | query / mutation | admin | saques do principal; pago encerra o contrato |
| `admin.resgates.listar` | query | admin | pedidos com conta de destino |
| `admin.resgates.aprovar` | mutation | admin | solicitado → aprovado |
| `admin.resgates.marcarPago` | mutation | admin | aprovado → pago, avisa o investidor |
| `admin.resgates.recusar` | mutation | admin | com motivo, avisa o investidor |

## Como adicionar uma rota nova

1. **Página:** crie `client/src/pages/MinhaPagina.tsx`, importe com `lazy()` em `App.tsx` e adicione a `<Route>` com `ProtectedRoute` e `roles`.
2. **Procedure:** adicione no `*Router.ts` da área (ou crie `_core/novoRouter.ts` e registre em `_core/router.ts`). Comece com `protectedProcedure` ou `comPapel(...)`.
3. **REST:** só quando precisar de redirect, cookie fora do tRPC ou chamada externa (webhook, cron). Monte em `_core/index.ts`, antes do tRPC.
4. Atualize este arquivo e rode `npm test` e `npm run check`.
