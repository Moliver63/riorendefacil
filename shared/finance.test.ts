import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aliquotaIR,
  compararLiquido,
  dataPagamentoResgate,
  proximaFaixa,
  rendimentoAcumulado,
  simular,
  fatorRio,
  linhaTabelaProgressiva,
  taxaAnualEquivalente,
  taxaMensalEfetiva,
  tetoDaFaixa,
} from "./finance";
import { FAIXAS_EXEMPLO } from "./issuer";

test("tabela progressiva: valor no vencimento bate com a tabela de referência", () => {
  // aporte, prazo, taxa mensal nominal, resgate acumulado no vencimento da tabela
  const linhas: [number, number, number, number][] = [
    [1_000_000_00, 12, 0.018, 1_241_023_09],
    [1_000_000_00, 24, 0.019, 1_577_525_75],
    [1_000_000_00, 36, 0.021, 2_129_184_72],
    [2_000_000_00, 24, 0.02, 3_231_639_01],
    [3_000_000_00, 36, 0.023, 6_864_062_00],
    [3_500_000_00, 36, 0.024, 8_301_384_28],
  ];
  for (const [aporte, prazo, taxa, esperado] of linhas) {
    const r = linhaTabelaProgressiva(aporte, prazo, taxa).resgateVencimentoCentavos;
    // a tabela de origem arredonda o fator; aceitamos até 0,002% de diferença
    assert.ok(Math.abs(r - esperado) / esperado < 0.00002, `${aporte} ${prazo}m: ${r} vs ${esperado}`);
  }
});

test("tabela progressiva: juros de um mês de 31 dias (janeiro)", () => {
  // diferença de centavos por arredondamento da tabela de origem
  assert.ok(Math.abs(linhaTabelaProgressiva(1_000_000_00, 12, 0.018).jurosMesCentavos - 18_508_99) <= 20);
  assert.ok(Math.abs(linhaTabelaProgressiva(3_500_000_00, 36, 0.024).jurosMesCentavos - 86_631_99) <= 60);
});

test("taxas: 1,80% nominal rende 1,816% efetivo ao mês e 24,10% ao ano", () => {
  assert.ok(Math.abs(taxaMensalEfetiva(0.018) - 0.018157) < 1e-6);
  assert.ok(Math.abs(taxaAnualEquivalente(0.018) - 0.241022) < 1e-6);
  // 365 dias corridos = 12 meses de capitalização
  assert.ok(Math.abs(fatorRio(0.018, 365) - 1.241022) < 1e-6);
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

test("simulação de 12 meses a 1,80% a.m. sobre R$ 1 milhão", () => {
  const r = simular(1_000_000_00, 12, 0.018);
  assert.ok(Math.abs(r.saldoBrutoCentavos - 1_241_023_09) / 1_241_023_09 < 0.00002);
  assert.equal(r.aliquotaIR, 0.175);
  assert.equal(r.irCentavos, Math.round(r.rendimentoBrutoCentavos * 0.175));
  assert.equal(r.saldoLiquidoCentavos, 1_000_000_00 + r.rendimentoLiquidoCentavos);
  assert.equal(r.evolucao.length, 13);
  assert.equal(r.evolucao[0]?.brutoCentavos, 1_000_000_00);
});

test("simulação rejeita entradas inválidas", () => {
  assert.throws(() => simular(0, 12, 0.01));
  assert.throws(() => simular(1000, 0, 0.01));
  assert.throws(() => simular(1000, 1.5, 0.01));
});

test("faixas: tabela progressiva por aporte e prazo", () => {
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 500_000_00, 12), null);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 1_000_000_00, 12), 0.018);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 1_000_000_00, 36), 0.021);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 2_500_000_00, 24), 0.02);
  assert.equal(tetoDaFaixa(FAIXAS_EXEMPLO, 3_500_000_00, 36), 0.024);
  assert.equal(proximaFaixa(FAIXAS_EXEMPLO, 1_000_000_00, 12)?.taxaMensalTeto, 0.019);
  assert.equal(proximaFaixa(FAIXAS_EXEMPLO, 4_000_000_00, 36), null);
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

test("rendimento acumulado: juros diários compostos, resgate deixa de render", () => {
  // 365 dias a 1,80% = mesmo valor da tabela
  assert.equal(rendimentoAcumulado(1_000_000_00, 0.018, 365).brutoCentavos, simular(1_000_000_00, 12, 0.018).rendimentoBrutoCentavos);
  // resgatar no dia 100 reduz o saldo que rende dali em diante
  const sem = rendimentoAcumulado(1_000_000_00, 0.018, 365);
  const r100 = rendimentoAcumulado(1_000_000_00, 0.018, 100).disponivelCentavos;
  const com = rendimentoAcumulado(1_000_000_00, 0.018, 365, [{ dia: 100, valorCentavos: r100 }]);
  assert.ok(com.brutoCentavos < sem.brutoCentavos);
  assert.ok(Math.abs(com.disponivelCentavos - Math.round(1_000_000_00 * (fatorRio(0.018, 265) - 1))) <= 2);
  assert.equal(rendimentoAcumulado(100_000_00, 0.015, 30, 999_999_99).disponivelCentavos, 0);
});

test("resgate pago em D+7 corridos", () => {
  const d = dataPagamentoResgate(new Date("2026-10-02T12:00:00Z"));
  assert.equal(d.toISOString().slice(0, 10), "2026-10-09");
});
