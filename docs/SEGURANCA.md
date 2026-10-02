# Segurança · RioRendeFácil

## Sessão
- JWT HS256 assinado com `SESSION_SECRET` (mínimo 32 caracteres), em cookie `rrf_sessao` httpOnly, SameSite=Lax, Secure em produção, 7 dias.
- O servidor confere a assinatura e a `versaoSessao` do usuário no banco a cada requisição. Incrementar a versão derruba todas as sessões (troca de papel, "sair de todos").
- Teste automatizado garante que um cookie JSON forjado, como `{"id":1,"email":"..."}`, é ignorado.

## Login
- Link mágico: 32 bytes de `crypto.randomBytes`, só o SHA-256 vai para o banco, validade de 15 minutos, uso único (UPDATE atômico).
- A resposta ao pedir link é idêntica exista ou não a conta, para não revelar quem está cadastrado.
- Google: fluxo authorization code com `state` em cookie, comparação em tempo constante e exigência de e-mail verificado.
- Limites: 6 pedidos de acesso a cada 15 minutos por IP, 6 leads por hora, 150 chamadas de API por minuto.

## Dados
- Documentos no R2, nunca públicos. Download só por URL assinada de 5 minutos, gerada após checar se o documento pertence ao investidor. Cada arquivo tem SHA-256 registrado.
- CPF e dados de KYC ficam com o provedor de KYC, não nesta base, até haver decisão jurídica sobre armazenamento.
- Trilha de auditoria append-only para login, leads, ofertas, CCBs, papéis, documentos e resgates.

## Segredos
- Nenhum segredo no repositório. `.env` está no `.gitignore`; `.env.example` só tem nomes.
- Em produção o servidor não sobe sem `SESSION_SECRET` e `DATABASE_URL`.

## Lições trazidas dos outros projetos
- **Shadia:** cookie de sessão em JSON sem assinatura permite se passar por qualquer usuário, inclusive admin. Segredos com valor padrão no código. Tokens com `Math.random`. Arquivos de senha e de chave JWT versionados em repositório público.
- **MecProAI:** URLs de banco com senha embutidas em scripts versionados. `drizzle-kit push` apagou tabelas em produção.
- **Caro:** bom padrão de cron protegido, webhook com corpo bruto e erro global; replicados aqui.
