# RioRendeFácil

Plataforma de tecnologia para captação e portal do investidor em renda fixa estruturada (CCB). O RioRendeFácil **não é emissor**: as CCBs são emitidas, custodiadas e ofertadas pelo emissor parceiro licenciado. Dinheiro de investidor nunca passa pela plataforma.

## Rodar

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:3000 (Postgres embutido via PGlite, nada para instalar)
npm test         # 35 testes: finanças, revisor, integração com banco e HTTP
npm run check    # tipos
```

Para entrar como admin no ambiente local: coloque seu e-mail em `ADMIN_EMAILS` no `.env`, abra `/entrar` e use o link que aparece na tela (sem Resend configurado, o link é exibido direto).

## O que tem

| Área | Rotas |
|---|---|
| Site público | `/`, `/conteudo`, `/conteudo/:slug`, `/entrar` |
| Investidor | `/painel`, `/trilha`, `/trilha/:modulo`, `/perfil`, `/documentos` |
| Equipe | `/admin`, `/admin/leads`, `/admin/comunicacao` |
| Admin | `/admin/ofertas`, `/admin/usuarios`, `/admin/auditoria` |

## Documentação

- `docs/ARQUITETURA.md`: estrutura, fluxo do investidor e de onde veio cada padrão (Caro, Shadia, MecProAI)
- `docs/SEGURANCA.md`: sessão, login, dados e lições dos outros projetos
- `docs/COMPLIANCE.md`: checklist antes de captar e perguntas para o advogado
- `docs/FRAMEWORK_EXCELENCIA.md`: regras de código e comunicação
- `docs/SYSTEM_MEMORY.md`: histórico por sessão

## Deploy

`render.yaml` cria o web service, o Postgres e o cron de lembretes. As migrações rodam sozinhas no boot.

Desenvolvido por Lab Quântico de Software.
