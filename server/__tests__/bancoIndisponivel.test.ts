import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticoBanco, erroTransitorio } from "../db";

test("conexão recusada é transitória e tem diagnóstico claro", () => {
  const e = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), { code: "ECONNREFUSED" });
  assert.equal(erroTransitorio(e), true);
  assert.match(diagnosticoBanco(e), /Available/);
});

test("senha errada não é repetida, mas é explicada", () => {
  const e = Object.assign(new Error("password authentication failed"), { code: "28P01" });
  assert.equal(erroTransitorio(e), false);
  assert.match(diagnosticoBanco(e), /senha/);
});

test("erro embrulhado em cause também é reconhecido", () => {
  const e = new Error("falha", { cause: Object.assign(new Error("x"), { code: "ENOTFOUND" }) });
  assert.equal(erroTransitorio(e), true);
});
