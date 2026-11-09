import { test } from "node:test";
import assert from "node:assert/strict";
import { cotacaoDaPtax, deReais, formatarCurto, formatarMoeda, paraReais, rentabilidadeAcumulada, situacaoAplicacao } from "./moeda";

const semEspacoDuro = (s: string) => s.replace(/ /g, " ");

test("formata real e dólar", () => {
  assert.equal(semEspacoDuro(formatarMoeda(123_456_78, "BRL")), "R$ 123.456,78");
  assert.equal(formatarMoeda(123_456_78, "USD"), "US$ 123.456,78");
  assert.equal(formatarCurto(1_250_000_00, "USD"), "US$ 1,25 mi");
  assert.equal(formatarCurto(350_000_00, "BRL"), "R$ 350 mil");
});

test("conversão para real usa a cotação e exige cotação para dólar", () => {
  assert.equal(paraReais(100_000_00, "USD", { valor: 5.4321 }), 543_210_00);
  assert.equal(paraReais(100_000_00, "BRL", null), 100_000_00);
  assert.equal(paraReais(100_000_00, "USD", null), null);
});

test("PTAX do Banco Central vira cotação com data e fonte", () => {
  const c = cotacaoDaPtax({ cotacaoVenda: 5.3712, dataHoraCotacao: "2026-11-06 13:09:28.123" });
  assert.deepEqual(c, { moeda: "USD", valor: 5.3712, data: "2026-11-06", fonte: "PTAX venda · Banco Central do Brasil" });
});

test("situação: ativa, vencida, liquidada, pendente", () => {
  assert.equal(situacaoAplicacao("ativo", "2027-11-09", "2026-11-09"), "ativa");
  assert.equal(situacaoAplicacao("ativo", "2026-11-09", "2026-11-09"), "vencida");
  assert.equal(situacaoAplicacao("liquidado", "2026-01-01", "2026-11-09"), "liquidada");
  assert.equal(situacaoAplicacao("aguardando_aporte", null, "2026-11-09"), "pendente");
});

test("rentabilidade acumulada conta o rendimento já sacado", () => {
  const r = rentabilidadeAcumulada(1_000_000_00, 1_150_000_00, 50_000_00);
  assert.equal(r.rendimentoCentavos, 200_000_00);
  assert.equal(r.pct, 0.2);
});

test("total em reais vira dólar pela mesma cotação, e volta", () => {
  assert.equal(deReais(543_210_00, "USD", { valor: 5.4321 }), 100_000_00);
  assert.equal(deReais(543_210_00, "BRL", null), 543_210_00);
  assert.equal(deReais(543_210_00, "USD", null), null);
});
