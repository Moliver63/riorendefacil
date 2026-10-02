import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aliquotaIR,
  compararLiquido,
  dataPagamentoResgate,
  proximaFaixa,
  rendimentoAcumulado,
  simular,
  taxaDiariaEquivalente,
  tetoDaFaixa,
} from "./finance";
import { FAIXAS_EXEMPLO } from "./issuer";

test("taxa diária equivalente reproduz a taxa mensal em 30 dias", () => {
  const d = taxaDiariaEquivalente(0.015);
  assert.ok(Math.abs(Math.pow(1 + d, 30) - 1.015) < 1e-12);
});

test("meses viram dias corridos para IR (12 meses = 365 dias)", () => {
  assert.equal(simular(10_000_00, 12, 0.01).diasCorridos, 365);
  assert.equal(simular(10_000_00, 6, 0.01).aliquotaIR, 0.2); // 183 dias
});

test("tabela regressiva de IR nos limites", () => {
  assert.equal(aliquotaIR(180), 0.225);
  assert.equal(aliquotaIR(181), 0.2);
  assert.equal(aliquotaIR(360), 0.2);
  assert.equal(aliquotaIR(361), 0.175);
  assert.equal(aliquotaIR(720), 0.175);
  assert.equal(aliquotaIR(721), 0.15);
});

test("simulação de 12 meses a 1,5% a.m. sobre R$ 10.000", () => {
  const r = simular(10_000_00, 12, 0.015);
  // (1,015)^12 = 1,195618...
  assert.equal(r.saldoBrutoCentavos, 11_956_18);
  assert.equal(r.aliquotaIR, 0.175);
  assert.equal(r.irCentavos, Math.round(1_956_18.17 * 0.175));
  assert.equal(r.saldoLiquidoCentavos, 10_000_00 + r.rendimentoLiquidoCentavos);
  assert.equal(r.evolucao.length, 13);
  assert.equal(r.evolucao[0]?.brutoCentavos, 10_000_00);
});

test("simulação rejeita entradas inválidas", () => {
  assert.throws(() => simular(0, 12, 0.01));
  assert.throws(() => simular(1000, 0, 0.01));
  assert.throws(() => simular(1000, 1.5, 0.01));
});

test("faixas: teto e próxima faixa", () => {
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 500_00, 12), null);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 5_000_00, 12), 0.012);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 150_000_00, 3), 0.013);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 150_000_00, 6), 0.014);
  assert.equal(proximaFaixa(FAIXAS_EXEMPLO, 5_000_00, 12)?.taxaMensalTeto, 0.013);
  assert.equal(proximaFaixa(FAIXAS_EXEMPLO, 1_000_000_00, 24), null);
});

test("comparação usa base líquida e respeita isenção da poupança", () => {
  const [cdb, poup] = compararLiquido(10_000_00, 12, [
    { nome: "CDB 100% CDI", taxaAnual: 0.139, isento: false },
    { nome: "Poupança", taxaAnual: 0.0834, isento: true },
  ]);
  assert.ok(cdb && poup);
  // CDB bruto ~ 11.390, líquido com 17,5% de IR ~ 11.147
  assert.ok(cdb.saldoLiquidoCentavos > 11_100_00 && cdb.saldoLiquidoCentavos < 11_200_00);
  assert.equal(poup.saldoLiquidoCentavos, 10_834_00);
});

test("rendimento acumulado desconta resgates e nunca fica negativo", () => {
  const r = rendimentoAcumulado(100_000_00, 0.015, 30);
  assert.equal(r.brutoCentavos, 1_500_00);
  assert.equal(rendimentoAcumulado(100_000_00, 0.015, 15).brutoCentavos, 750_00);
  const r2 = rendimentoAcumulado(100_000_00, 0.015, 30, 999_999_99);
  assert.equal(r2.disponivelCentavos, 0);
});

test("resgate pago em D+7 corridos", () => {
  const d = dataPagamentoResgate(new Date("2026-10-02T12:00:00Z"));
  assert.equal(d.toISOString().slice(0, 10), "2026-10-09");
});
