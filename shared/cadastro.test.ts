import { test } from "node:test";
import assert from "node:assert/strict";
import { cpfValido, esquemaCadastro, formatarCpf, idadeEm, mascararCpf } from "./cadastro";

test("CPF: dígitos verificadores, formatação e máscara", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("52998224725"), true);
  assert.equal(cpfValido("529.982.247-24"), false);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("123"), false);
  assert.equal(formatarCpf("52998224725"), "529.982.247-25");
  assert.equal(mascararCpf("4725"), "***.***.*47-25");
});

test("idade conta aniversário que ainda não chegou", () => {
  const hoje = new Date("2026-10-02T12:00:00Z");
  assert.equal(idadeEm("2008-10-02", hoje), 18);
  assert.equal(idadeEm("2008-10-03", hoje), 17);
});

const base = {
  nomeCompleto: "Maria da Silva",
  cpf: "529.982.247-25",
  dataNascimento: "1985-04-10",
  estadoCivil: "casado(a)",
  profissao: "Médica",
  telefone: "(47) 99999-8888",
  cep: "88330-000",
  logradouro: "Av. Atlântica",
  numero: "1000",
  bairro: "Centro",
  cidade: "Balneário Camboriú",
  uf: "SC",
  faixaRenda: "R$ 20 mil a R$ 50 mil",
  faixaPatrimonio: "R$ 1 mi a R$ 5 mi",
  origemRecursos: "Salário e aplicações financeiras",
  ppe: false,
  bancoCodigo: "341",
  bancoNome: "Itaú",
  agencia: "1234",
  conta: "56789-0",
  contaTipo: "corrente",
  declaracao: true,
} as const;

test("cadastro válido normaliza telefone e CEP", () => {
  const r = esquemaCadastro.parse(base);
  assert.equal(r.telefone, "47999998888");
  assert.equal(r.cep, "88330000");
});

test("cadastro recusa menor de idade, CPF inválido, sem sobrenome e sem declaração", () => {
  const erros = (dados: object) => esquemaCadastro.safeParse({ ...base, ...dados }).success;
  assert.equal(erros({ dataNascimento: "2015-01-01" }), false);
  assert.equal(erros({ cpf: "123.456.789-00" }), false);
  assert.equal(erros({ nomeCompleto: "Maria" }), false);
  assert.equal(erros({ declaracao: false }), false);
  assert.equal(erros({ uf: "XX" }), false);
});
