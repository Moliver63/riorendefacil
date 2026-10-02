# RioRendeFácil

Plataforma de tecnologia para captação e portal do investidor em renda fixa estruturada (CCB). O RioRendeFácil **não é emissor**: as CCBs são emitidas, custodiadas e ofertadas pelo emissor parceiro licenciado. Dinheiro de investidor nunca passa por conta da plataforma.

## Rodar

```bash
cp .env.example .env
npm install
npm run dev        # web em :5173, api em :3001
npm test           # 19 testes (cálculo financeiro + revisor de comunicação)
npm run check      # typecheck
npm run build && NODE_ENV=production npm start
```

Sem `DATABASE_URL`, os leads ficam em memória (só desenvolvimento).

## Telas

| Rota | O que é |
|---|---|
| `/` | Landing: hero com composição do pool, como funciona, simulador líquido de IR, lastro, riscos, FAQ, contato |
| `/investidor` | Painel do investidor (dados de demonstração) |
| `/interno/compliance` | Revisor de anúncios e copy antes de publicar |

## Emissor parceiro

Controlado por `EMISSOR_AUTORIZADO` no `.env`. Com `false`, nenhuma marca de emissor aparece, as taxas são marcadas como exemplo e o resgate fica desligado. Só mude para `true` com contrato assinado e autorização de uso de marca por escrito. Ver `docs/COMPLIANCE.md`.

## Estrutura

```
shared/   finance.ts (juros, IR, simulação)  complianceGuard.ts  issuer.ts  mercado.ts
server/   index.ts (Express)  router.ts (tRPC)  schema.ts (Drizzle)  repo.ts
client/   src/pages  src/components  styles.css
docs/     SYSTEM_MEMORY.md  FRAMEWORK_EXCELENCIA.md  COMPLIANCE.md
```

Desenvolvido por Lab Quântico de Software.
