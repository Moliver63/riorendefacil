/**
 * Depósito informado pelo investidor → confirmação do admin → contrato ativo →
 * saque antecipado do principal com a regra de permanência → pago e encerrado.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, aplicarMigracoes } from "../db";
import { appRouter } from "../_core/router";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { encontrarOuCriarUsuario } from "../contas";
import { lancamentosConta } from "../schema";
import type { Usuario } from "../schema";
import { cdiAnualReferencia } from "../movimentacoesService";

const criar = createCallerFactory(appRouter);
const caller = (u: Usuario) => criar({ req: { cookies: {} } as TrpcContext["req"], res: {} as TrpcContext["res"], usuario: u, ip: "127.0.0.1" });

const ENV_TESTE = {
  EMISSOR_AUTORIZADO: "true",
  EMISSOR_NOME: "Emissor Teste S.A.",
  EMISSOR_CNPJ: "00.000.000/0001-00",
  EMISSOR_REGISTRO_CVM: "TESTE-123",
  EMISSOR_CUSTODIANTE: "Fiduciário Teste",
  EMISSOR_AUDITOR: "Auditoria Teste",
  CONTA_DEPOSITO_FAVORECIDO: "Conta Vinculada Teste",
  CONTA_DEPOSITO_BANCO: "001",
  CONTA_DEPOSITO_AGENCIA: "0001",
  CONTA_DEPOSITO_CONTA: "12345-6",
  CONTA_DEPOSITO_PIX: "deposito@teste.com",
};
const original: Record<string, string | undefined> = {};
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

before(async () => {
  await aplicarMigracoes();
  for (const [k, v] of Object.entries(ENV_TESTE)) {
    original[k] = process.env[k];
    process.env[k] = v;
  }
});
after(() => {
  for (const k of Object.keys(ENV_TESTE)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

test("depósito, confirmação, saque antecipado do principal e encerramento", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("chefe-mov@exemplo.com");
  const ca = caller(await encontrarOuCriarUsuario({ email: "chefe-mov@exemplo.com" }));
  const ci = caller(await encontrarOuCriarUsuario({ email: "ana-mov@exemplo.com" }));

  const oferta = await ca.admin.ofertas.salvar({
    nome: "Oferta Movimentações",
    faixas: [{ minimoCentavos: 100_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.018 }],
    carenciaPrincipalDias: 90,
    prazoResgateDias: 7,
  });
  await ca.admin.ofertas.ativar({ id: oferta.id, ativa: true });
  await ca.admin.ccbs.salvar({
    ofertaId: oferta.id, codigo: "CCB-MOV", setor: "imobiliario", devedorDescricao: "Imóvel", valorCentavos: 100_000_00,
    garantiaTipo: "Alienação fiduciária", garantiaValorCentavos: 5_000_000_00, vencimento: "2030-01-01", situacao: "adimplente", diasAtraso: 0,
  });
  await ci.investidor.salvarCadastro({
    nomeCompleto: "Ana Souza", cpf: "390.533.447-05", dataNascimento: "1979-03-03", estadoCivil: "solteiro(a)", profissao: "Advogada",
    telefone: "47977776666", cep: "88330000", logradouro: "Rua Dois", numero: "20", bairro: "Centro", cidade: "Balneário Camboriú", uf: "SC",
    faixaRenda: "R$ 20 mil a R$ 50 mil", faixaPatrimonio: "R$ 1 mi a R$ 5 mi", origemRecursos: "Salário", ppe: false,
    bancoCodigo: "001", bancoNome: "Banco do Brasil", agencia: "4321", conta: "8888-1", contaTipo: "corrente", declaracao: true,
  });
  const invId = (await ca.admin.investidores.listar()).find((l) => l.email === "ana-mov@exemplo.com")!.id;
  const contrato = await ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 1_000_000_00, prazoMeses: 36 });

  // ainda não assinado: depósito não é aceito
  await assert.rejects(ci.investidor.informarDeposito({ contratoId: contrato.id, valorCentavos: 1_000_000_00, dataDeposito: diasAtras(0) }), /aguardando aporte/);
  await ca.admin.contratos.marcarAssinado({ id: contrato.id });

  const dados = await ci.investidor.dadosDeposito();
  assert.equal(dados.habilitado, true);
  assert.equal(dados.conta.pix, "deposito@teste.com");
  assert.equal(dados.contratos[0]!.id, contrato.id);

  // depósito há 400 dias (entre 12 e 24 meses de permanência no saque)
  const dep = await ci.investidor.informarDeposito({ contratoId: contrato.id, valorCentavos: 1_000_000_00, dataDeposito: diasAtras(400) });
  assert.equal(dep.aviso, null);
  await assert.rejects(ci.investidor.informarDeposito({ contratoId: contrato.id, valorCentavos: 1_000_000_00, dataDeposito: diasAtras(400) }), /já informou/);
  const [fila] = await ca.admin.depositos.listar({ status: "informado" });
  assert.equal(fila!.nome, "Ana Souza");
  await ca.admin.depositos.confirmar({ id: fila!.id });

  let painel = await ci.investidor.painel();
  assert.equal(painel.contratos[0]!.status, "ativo");
  assert.equal(painel.contratos[0]!.inicio, diasAtras(400), "rendimento conta da data do depósito");

  // saque antecipado: 400 dias → principal corrigido pelo CDI
  const previa = await ci.investidor.previaSaquePrincipal({ contratoId: contrato.id });
  assert.equal(previa.tipo, "antecipado");
  assert.match(previa.regra, /CDI/);
  assert.equal(previa.brutoCentavos, Math.round(1_000_000_00 * Math.pow(1 + cdiAnualReferencia(), 400 / 365)));
  assert.ok(previa.penalidadeCentavos > 0);

  const saque = await ci.investidor.solicitarSaquePrincipal({ contratoId: contrato.id, ciente: true });
  assert.equal(saque.status, "solicitado");
  await assert.rejects(ci.investidor.solicitarSaquePrincipal({ contratoId: contrato.id, ciente: true }), /andamento/);
  await assert.rejects(
    ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 100_00, idempotencyKey: crypto.randomUUID() }),
    /saque do principal em andamento/,
  );

  await assert.rejects(ca.admin.saquesPrincipal.marcarPago({ id: saque.id }), /Aprove/);
  await ca.admin.saquesPrincipal.aprovar({ id: saque.id });
  await ca.admin.saquesPrincipal.marcarPago({ id: saque.id });

  painel = await ci.investidor.painel();
  assert.equal(painel.contratos[0]!.status, "liquidado");

  const movs = await ci.investidor.movimentacoes();
  assert.deepEqual(movs.map((m) => m.tipo).sort(), ["deposito", "saque_principal"]);
  assert.equal(movs.find((m) => m.tipo === "saque_principal")!.statusRotulo, "Pago");

  const conta = await db.select().from(lancamentosConta).where(eq(lancamentosConta.ofertaId, oferta.id));
  assert.deepEqual(conta.map((l) => l.tipo).sort(), ["aporte", "pagamento_principal"]);
  assert.equal(conta.reduce((t, l) => t + l.valorCentavos, 0), 1_000_000_00 - previa.brutoCentavos);
});
