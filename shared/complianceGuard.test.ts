import { test } from "node:test";
import assert from "node:assert/strict";
import { AVISO_RISCO, avaliarTexto } from "./complianceGuard";

test("bloqueia retorno garantido", () => {
  const r = avaliarTexto("Rendimento garantido todo mês na sua conta.");
  assert.equal(r.aprovado, false);
  assert.ok(r.achados.some((a) => a.regra === "garantia_de_retorno"));
});

test("bloqueia sem risco e risco zero, com acento e caixa alta", () => {
  assert.equal(avaliarTexto("Investimento SEM RISCO").aprovado, false);
  assert.equal(avaliarTexto("Aqui é risco zero, já!").aprovado, false);
});

test("bloqueia dinheiro fácil com e sem acento", () => {
  assert.equal(avaliarTexto("dinheiro fácil pra você").aprovado, false);
  assert.equal(avaliarTexto("dinheiro facil pra voce").aprovado, false);
});

test("bloqueia FGC indevido", () => {
  assert.equal(avaliarTexto("Seu dinheiro coberto pelo FGC").aprovado, false);
});

test("nome da marca não dispara a regra de rende fácil", () => {
  const r = avaliarTexto("Conheça o RioRendeFácil, tecnologia para crédito privado.");
  assert.equal(r.achados.length, 0);
  assert.equal(r.aprovado, true);
});

test("rende fácil como promessa gera alerta", () => {
  const r = avaliarTexto("Com a gente seu dinheiro rende fácil.");
  assert.ok(r.achados.some((a) => a.regra === "rende_facil_fora_da_marca"));
});

test("não confunde palavras que contêm o termo", () => {
  // "corrida" contém "corra"? Não, mas "socorra" contém. Fronteira deve segurar.
  const r = avaliarTexto("Socorramos os pequenos produtores.");
  assert.ok(!r.achados.some((a) => a.regra === "urgencia_artificial"));
});

test("fala de rentabilidade sem aviso exige aviso de risco", () => {
  const r = avaliarTexto("Rentabilidade de 1,3% ao mês com lastro em imóveis.");
  assert.deepEqual(r.avisosObrigatorios, [AVISO_RISCO]);
});

test("texto com aviso de perda do capital não exige aviso duplicado", () => {
  const r = avaliarTexto(
    "Rentabilidade de 1,3% ao mês. Operações de crédito envolvem risco, inclusive de perda do capital.",
  );
  assert.equal(r.avisosObrigatorios.length, 0);
});

test("texto institucional neutro passa limpo", () => {
  const r = avaliarTexto("Fale com um especialista e entenda a estrutura antes de decidir.");
  assert.equal(r.aprovado, true);
  assert.equal(r.achados.length, 0);
});
