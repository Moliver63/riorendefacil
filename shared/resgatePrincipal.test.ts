import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularResgatePrincipal } from "./resgatePrincipal";

const base = {
  principalCentavos: 1_000_000_00,
  prazoMeses: 36,
  cdiAnual: 0.14,
};

test("até 12 meses: só o principal, juros sacados descontados, sem IR", () => {
  const r = calcularResgatePrincipal({ ...base, diasPermanencia: 200, saldoCentavos: 1_100_000_00, performanceCentavos: 140_000_00, rendimentoSacadoCentavos: 40_000_00 });
  assert.equal(r.tipo, "antecipado");
  assert.equal(r.brutoCentavos, 960_000_00);
  assert.equal(r.penalidadeCentavos, 140_000_00);
  assert.equal(r.irCentavos, 0);
  assert.equal(r.prazoPagamentoDias, 60);
});

test("12 a 24 meses: principal corrigido pelo CDI do período", () => {
  const r = calcularResgatePrincipal({ ...base, diasPermanencia: 500, saldoCentavos: 1_400_000_00, performanceCentavos: 400_000_00, rendimentoSacadoCentavos: 0 });
  const esperado = Math.round(1_000_000_00 * Math.pow(1.14, 500 / 365));
  assert.equal(r.brutoCentavos, esperado);
  assert.equal(r.aliquotaIR, 0.175);
  assert.equal(r.irCentavos, Math.round((esperado - 1_000_000_00) * 0.175));
});

test("24 a 36 meses: principal + metade da performance", () => {
  const r = calcularResgatePrincipal({ ...base, diasPermanencia: 900, saldoCentavos: 1_700_000_00, performanceCentavos: 800_000_00, rendimentoSacadoCentavos: 100_000_00 });
  assert.equal(r.brutoCentavos, 1_300_000_00);
  assert.equal(r.penalidadeCentavos, 400_000_00);
  assert.equal(r.irCentavos, Math.round(300_000_00 * 0.15));
});

test("no vencimento: saldo inteiro, sem penalidade, pago em D+7", () => {
  const r = calcularResgatePrincipal({ ...base, prazoMeses: 12, diasPermanencia: 365, saldoCentavos: 1_241_021_99, performanceCentavos: 241_021_99, rendimentoSacadoCentavos: 0 });
  assert.equal(r.tipo, "vencimento");
  assert.equal(r.brutoCentavos, 1_241_021_99);
  assert.equal(r.penalidadeCentavos, 0);
  assert.equal(r.irCentavos, Math.round(241_021_99 * 0.175)); // 365 dias: acima de 360, 17,5%
  assert.equal(r.prazoPagamentoDias, 7);
});
