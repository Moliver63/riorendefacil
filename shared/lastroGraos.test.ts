import { test } from "node:test";
import assert from "node:assert/strict";
import { alocacaoDoContrato, coberturaProjetada, margemDaOperacao, podeMudar, posicaoDaOferta, valorComSinal } from "./lastroGraos";

const op = (status: string, compra: number, venda: number | null = null, recebido = 0, grao = "milho") => ({
  grao,
  status,
  valorCompraCentavos: compra,
  custosCentavos: 0,
  valorVendaCentavos: venda,
  valorRecebidoCentavos: recebido,
});

test("cobertura: 15 mi de garantias para 10 mi captados = 150%, sem trava", () => {
  const p = posicaoDaOferta({
    saldoContaCentavos: 0,
    operacoes: [],
    garantias: [{ situacao: "adimplente", garantiaValorCentavos: 20_000_000_00, valorElegivelCentavos: 15_000_000_00 }],
    principalComprometidoCentavos: 10_000_000_00,
    obrigacoesCentavos: 10_000_000_00,
    coberturaMinima: 1.3,
  });
  assert.equal(p.cobertura, 1.5);
  assert.equal(p.travada, false);
});

test("cobertura abaixo de 130% trava e zera a margem liberável", () => {
  const p = posicaoDaOferta({
    saldoContaCentavos: 5_000_000_00,
    operacoes: [],
    garantias: [{ situacao: "adimplente", garantiaValorCentavos: 12_000_000_00, valorElegivelCentavos: null }],
    principalComprometidoCentavos: 10_000_000_00,
    obrigacoesCentavos: 1_000_000_00,
    coberturaMinima: 1.3,
  });
  assert.equal(p.travada, true);
  assert.equal(p.margemLiberavelCentavos, 0);
});

test("garantia executada ou liquidada não conta", () => {
  const p = posicaoDaOferta({
    saldoContaCentavos: 0,
    operacoes: [],
    garantias: [
      { situacao: "executada", garantiaValorCentavos: 10_000_00, valorElegivelCentavos: 10_000_00 },
      { situacao: "liquidada", garantiaValorCentavos: 10_000_00, valorElegivelCentavos: 10_000_00 },
    ],
    principalComprometidoCentavos: 1_000_00,
    obrigacoesCentavos: 1_000_00,
    coberturaMinima: 1.3,
  });
  assert.equal(p.garantiasElegiveisCentavos, 0);
});

test("waterfall: a margem da Rio só sai do que sobra depois das obrigações com investidores", () => {
  // 1 mi aportado; comprou 1 mi de milho e vendeu por 1,08 mi, já recebido
  const base = {
    operacoes: [op("recebida", 1_000_000_00, 1_080_000_00, 1_080_000_00)],
    garantias: [{ situacao: "adimplente", garantiaValorCentavos: 1_500_000_00, valorElegivelCentavos: null }],
    principalComprometidoCentavos: 1_000_000_00,
    coberturaMinima: 1.3,
  };
  // investidor tem 1 mi de principal + 30 mil de rendimento acumulado
  const p = posicaoDaOferta({ ...base, saldoContaCentavos: 1_080_000_00, obrigacoesCentavos: 1_030_000_00 });
  assert.equal(p.margemLiberavelCentavos, 50_000_00);
  // atraso de recebimento não conta como ativo: sem folga, sem margem
  const q = posicaoDaOferta({
    ...base,
    operacoes: [op("atrasada", 1_000_000_00, 1_080_000_00)],
    saldoContaCentavos: 0,
    obrigacoesCentavos: 1_030_000_00,
  });
  assert.equal(q.emAtrasoCentavos, 1_080_000_00);
  assert.equal(q.margemLiberavelCentavos, 0);
});

test("ativos: caixa + capital em operação + a receber", () => {
  const p = posicaoDaOferta({
    saldoContaCentavos: 100_00,
    operacoes: [op("comprada", 1_000_00), op("em_transporte", 2_000_00), op("vendida", 500_00, 800_00, 300_00), op("cancelada", 9_999_00)],
    garantias: [],
    principalComprometidoCentavos: 0,
    obrigacoesCentavos: 0,
    coberturaMinima: 1.3,
  });
  assert.equal(p.emOperacaoCentavos, 3_000_00);
  assert.equal(p.aReceberCentavos, 500_00);
  assert.equal(p.ativosCentavos, 3_600_00);
  assert.equal(p.cobertura, null);
});

test("cobertura projetada trava contrato que derrubaria o índice", () => {
  assert.equal(coberturaProjetada(13_000_000_00, 9_000_000_00, 1_000_000_00), 1.3);
  assert.ok(coberturaProjetada(13_000_000_00, 9_000_000_00, 2_000_000_00)! < 1.3);
});

test("alocação proporcional do contrato por grão, a receber e caixa", () => {
  const f = alocacaoDoContrato({
    principalContratoCentavos: 1_000_000_00,
    principalTotalCentavos: 10_000_000_00,
    saldoContaCentavos: 2_000_000_00,
    operacoes: [op("comprada", 5_000_000_00, null, 0, "soja"), op("em_transporte", 1_000_000_00, null, 0, "milho"), op("vendida", 2_000_000_00, 2_200_000_00, 0, "sorgo")],
  });
  assert.deepEqual(
    f.map((x) => [x.grao, x.centavos]),
    [["soja", 500_000_00], ["milho", 100_000_00], ["a_receber", 220_000_00], ["caixa", 200_000_00]],
  );
});

test("transições e sinais", () => {
  assert.ok(podeMudar("em_analise", "comprada"));
  assert.ok(!podeMudar("em_analise", "vendida"));
  assert.ok(!podeMudar("recebida", "atrasada"));
  assert.equal(valorComSinal("compra_graos", 100), -100);
  assert.equal(valorComSinal("recebimento_venda", -100), 100);
  assert.equal(valorComSinal("ajuste", -50), -50);
  assert.deepEqual(margemDaOperacao(op("vendida", 1_000_000_00, 1_080_000_00)), { centavos: 80_000_00, pct: 0.08 });
});
