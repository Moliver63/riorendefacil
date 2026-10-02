# FRAMEWORK_EXCELENCIA · RioRendeFácil

Regras que valem para todo código e toda comunicação do projeto.

## Dinheiro e cálculo
1. Valores em centavos inteiros na borda. Arredondar só no fim.
2. Todo cálculo financeiro mora em `shared/finance.ts`, é puro e tem teste.
3. Rentabilidade aparece líquida de IR por padrão. Bruto só como alternativa explícita.
4. Comparação com mercado sempre em base líquida, com data de referência e fonte.
5. Nenhuma taxa sai do código: vem do quadro do emissor.

## Dinheiro de terceiros
6. A plataforma nunca recebe aporte. Aporte e resgate são liquidados na conta vinculada do emissor; aqui só registro e comprovante.
7. Toda ação que mexe em contrato ou resgate gera linha em `auditoria` e usa chave de idempotência.

## Comunicação
8. Todo texto público passa pelo `complianceGuard` e depois pelo jurídico. Guard aprovado não é aprovação jurídica.
9. Mostrar atrasos e problemas do lastro. Nunca esconder dado ruim.
10. Sem marca de terceiro sem autorização escrita.

## Engenharia (herdado do MecProAI)
11. Nunca `drizzle-kit push`. Migração gerada com `npm run db:generate`, revisada no PR e aplicada no boot pelo migrator do Drizzle.
12. Regex em pt-BR: nada de `\b` ao lado de vogal acentuada; nada de regex em template string com barra simples.
13. Parser JSON registrado antes das rotas.
14. `npm test` e `npm run check` passando antes de todo commit.

## Sessão e acesso
15. Sessão só por JWT assinado. Cookie em texto puro nunca identifica ninguém.
16. Todo segredo vem do ambiente; em produção, ausência derruba o boot. Nada de valor padrão no código.
17. Tokens aleatórios só com `crypto`. Nunca `Math.random`.
18. Procedure nova começa como `protectedProcedure` ou `comPapel(...)`. Pública só com motivo.
19. Nenhum arquivo com senha, chave ou URL de banco no repositório, nem em script de diagnóstico.
