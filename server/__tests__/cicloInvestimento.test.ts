/**
 * Ciclo completo do investimento com banco real em memória:
 * cadastro → contrato → assinado → aporte → resgate → aprovado → pago.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, aplicarMigracoes } from "../db";
import { appRouter } from "../_core/router";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { encontrarOuCriarUsuario } from "../contas";
import { caixaDeSaidaTeste } from "../_core/email";
import { cifrar, decifrar } from "../cripto";
import { auditoria, cadastros, contratos } from "../schema";
import { TRILHA } from "../../shared/trilha";
import type { Usuario } from "../schema";

const criar = createCallerFactory(appRouter);
const caller = (u: Usuario) =>
  criar({ req: { cookies: {} } as TrpcContext["req"], res: {} as TrpcContext["res"], usuario: u, ip: "127.0.0.1" });

const EMISSOR = {
  EMISSOR_AUTORIZADO: "true",
  EMISSOR_NOME: "Emissor Teste S.A.",
  EMISSOR_CNPJ: "00.000.000/0001-00",
  EMISSOR_REGISTRO_CVM: "TESTE-123",
  EMISSOR_CUSTODIANTE: "Fiduciário Teste",
  EMISSOR_AUDITOR: "Auditoria Teste",
};
const envOriginal: Record<string, string | undefined> = {};

const CADASTRO = {
  nomeCompleto: "Maria da Silva",
  cpf: "529.982.247-25",
  dataNascimento: "1985-04-10",
  estadoCivil: "casado(a)" as const,
  profissao: "Médica",
  telefone: "47999998888",
  cep: "88330000",
  logradouro: "Av. Atlântica",
  numero: "1000",
  bairro: "Centro",
  cidade: "Balneário Camboriú",
  uf: "SC" as const,
  faixaRenda: "R$ 20 mil a R$ 50 mil" as const,
  faixaPatrimonio: "R$ 1 mi a R$ 5 mi" as const,
  origemRecursos: "Salário",
  ppe: false,
  bancoCodigo: "341",
  bancoNome: "Itaú",
  agencia: "1234",
  conta: "56789-0",
  contaTipo: "corrente" as const,
  pix: "maria@exemplo.com",
  declaracao: true as const,
};

before(async () => {
  await aplicarMigracoes();
  for (const [k, v] of Object.entries(EMISSOR)) {
    envOriginal[k] = process.env[k];
    process.env[k] = v;
  }
});
after(() => {
  for (const k of Object.keys(EMISSOR)) {
    if (envOriginal[k] === undefined) delete process.env[k];
    else process.env[k] = envOriginal[k];
  }
});

test("criptografia: ida e volta, IV diferente a cada vez, adulteração detectada", () => {
  const a = cifrar("52998224725");
  const b = cifrar("52998224725");
  assert.notEqual(a, b);
  assert.equal(decifrar(a), "52998224725");
  const partes = a.split(":");
  partes[3] = Buffer.from("00000000000").toString("base64url");
  assert.throws(() => decifrar(partes.join(":")));
});

test("ciclo completo: cadastro → contrato → aporte → resgate pago", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("chefe-ciclo@exemplo.com");
  const admin = await encontrarOuCriarUsuario({ email: "chefe-ciclo@exemplo.com" });
  const inv = await encontrarOuCriarUsuario({ email: "maria-ciclo@exemplo.com" });
  const ci = caller(inv);
  const ca = caller(admin);

  // oferta ativa com faixas
  const oferta = await ca.admin.ofertas.salvar({
    nome: "Pool Ciclo",
    faixas: [
      { minimoCentavos: 1_000_00, prazoMinimoMeses: 2, taxaMensalTeto: 0.012 },
      { minimoCentavos: 100_000_00, prazoMinimoMeses: 6, taxaMensalTeto: 0.014 },
    ],
    carenciaPrincipalDias: 60,
    prazoResgateDias: 7,
  });
  await ca.admin.ofertas.ativar({ id: oferta.id, ativa: true });

  // sem pré-requisitos, o admin não consegue criar contrato
  const invId = (await ca.admin.investidores.listar()).find((l) => l.email === "maria-ciclo@exemplo.com")!.id;
  await assert.rejects(
    ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 100_000_00, prazoMeses: 12 }),
    /trilha/,
  );

  // investidor: trilha + perfil + cadastro
  for (const m of TRILHA) {
    await ci.trilha.responder({ slug: m.slug, respostas: Object.fromEntries(m.perguntas.map((p) => [p.id, p.correta])) });
  }
  await ci.investidor.salvarSuitability({ respostas: { objetivo: 1, prazo: 2, reserva: 2, experiencia: 1, perda: 1 } });
  await assert.rejects(ci.investidor.manifestarInteresse(), /cadastro/);
  await ci.investidor.salvarCadastro(CADASTRO);
  assert.deepEqual(await ci.investidor.manifestarInteresse(), { ok: true });

  // CPF guardado só cifrado; o investidor vê o próprio número para editar
  const [cadDb] = await db.select().from(cadastros).where(eq(cadastros.investidorId, invId));
  assert.ok(!cadDb!.cpfCifrado.includes("52998224725"));
  assert.equal(cadDb!.cpfFinal, "4725");
  assert.equal((await ci.investidor.cadastro())!.cpf, "52998224725");

  // mesmo CPF em outra conta é recusado
  const outro = await encontrarOuCriarUsuario({ email: "outra-ciclo@exemplo.com" });
  await assert.rejects(caller(outro).investidor.salvarCadastro(CADASTRO), /já está vinculado/);

  // valor fora das faixas é recusado; taxa vem da faixa, não do admin
  await assert.rejects(
    ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 500_00, prazoMeses: 12 }),
    /fora das faixas/,
  );
  caixaDeSaidaTeste.length = 0;
  const contrato = await ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 100_000_00, prazoMeses: 12 });
  assert.equal(contrato.status, "aguardando_assinatura");
  assert.equal(Number(contrato.taxaMensal), 0.014);
  assert.ok(caixaDeSaidaTeste.some((e) => e.para === "maria-ciclo@exemplo.com" && e.assunto.includes("contrato")));

  // qualificação congelada no contrato, com CPF mascarado
  const doc = await ci.investidor.contrato({ id: contrato.id });
  const q = doc.qualificacao as { nomeCompleto: string; cpfMascarado: string; contaResgate: string };
  assert.equal(q.nomeCompleto, "Maria da Silva");
  assert.equal(q.cpfMascarado, "***.***.*47-25");
  assert.ok(q.contaResgate.includes("final 7890"));
  assert.ok(!JSON.stringify(doc).includes("52998224725"), "CPF completo nunca vai no contrato");

  // outro investidor não enxerga o contrato
  await assert.rejects(caller(outro).investidor.contrato({ id: contrato.id }), { code: "NOT_FOUND" });

  // fluxo de status
  await assert.rejects(ca.admin.contratos.confirmarAporte({ id: contrato.id, inicio: "2026-08-18" }), /Aguardando assinatura/);
  await ca.admin.contratos.marcarAssinado({ id: contrato.id, assinaturaRef: "ENVELOPE-1" });
  const inicio = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const { vencimento } = await ca.admin.contratos.confirmarAporte({ id: contrato.id, inicio });
  assert.equal(vencimento.slice(5, 7), String(((Number(inicio.slice(5, 7)) + 11) % 12) + 1).padStart(2, "0"));

  // painel: 45 dias a 1,4% a.m. sobre 100 mil = 2.100,00
  const painel = await ci.investidor.painel();
  const p = painel.contratos[0]!;
  assert.equal(p.status, "ativo");
  assert.equal(p.disponivelCentavos, 2_100_00);
  assert.equal(p.evolucao.length, 13);
  assert.equal(p.irSeResgatarTudo!.aliquota, 0.225);

  // resgate: acima do disponível falha; dentro do limite cria pedido com IR
  await assert.rejects(
    ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 3_000_00, idempotencyKey: crypto.randomUUID() }),
    /acima do rendimento/,
  );
  const chave = crypto.randomUUID();
  const pedido = await ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 1_000_00, idempotencyKey: chave });
  assert.equal(pedido.irCentavos, 225_00);
  assert.equal(pedido.liquidoCentavos, 775_00);
  const repetido = await ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 1_000_00, idempotencyKey: chave });
  assert.equal(repetido.repetido, true, "clique duplo não duplica");
  assert.equal((await ci.investidor.painel()).contratos[0]!.disponivelCentavos, 1_100_00);

  // admin: pagar antes de aprovar falha; aprovar e pagar
  const [r] = await ca.admin.resgates.listar({ status: "solicitado" });
  assert.equal(r!.contaFinal, "7890");
  await assert.rejects(ca.admin.resgates.marcarPago({ id: r!.id }), /Aprove/);
  await ca.admin.resgates.aprovar({ id: r!.id });
  caixaDeSaidaTeste.length = 0;
  await ca.admin.resgates.marcarPago({ id: r!.id });
  assert.ok(caixaDeSaidaTeste.some((e) => e.assunto === "Resgate de rendimento pago" && e.html.includes("775,00")));

  // extrato mostra aporte e resgate pago
  const extrato = await ci.investidor.extrato({ contratoId: contrato.id });
  assert.ok(extrato.some((l) => l.tipo === "aporte" && l.valorCentavos === 100_000_00));
  assert.ok(extrato.some((l) => l.tipo === "resgate" && l.status === "pago"));

  // recusar devolve o valor ao disponível
  const p2 = await ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 500_00, idempotencyKey: crypto.randomUUID() });
  await ca.admin.resgates.recusar({ id: p2.id!, motivo: "Conta divergente" });
  assert.equal((await ci.investidor.painel()).contratos[0]!.disponivelCentavos, 1_100_00);

  // contrato ativo não pode ser cancelado
  await assert.rejects(ca.admin.contratos.cancelar({ id: contrato.id, motivo: "teste" }), /Ativo/);

  // visualizar a ficha completa fica registrado
  const ficha = await ca.admin.investidores.detalhe({ id: invId });
  assert.equal(ficha.cadastro!.cpf, "52998224725");
  const logs = await db.select().from(auditoria).where(eq(auditoria.acao, "cadastro_visualizado"));
  assert.ok(logs.some((l) => l.entidadeId === invId));

  // investidor não acessa back-office
  await assert.rejects(ci.admin.contratos.listar(), { code: "FORBIDDEN" });
  const [cDb] = await db.select().from(contratos).where(eq(contratos.id, contrato.id));
  assert.equal(cDb!.assinaturaRef, "ENVELOPE-1");
});

test("sem emissor habilitado, o admin não cria contrato", async () => {
  const salvo = process.env.EMISSOR_AUTORIZADO;
  process.env.EMISSOR_AUTORIZADO = "false";
  try {
    const { ENV } = await import("../_core/env");
    ENV.adminEmails.push("chefe-trava@exemplo.com");
    const admin = await encontrarOuCriarUsuario({ email: "chefe-trava@exemplo.com" });
    await assert.rejects(
      caller(admin).admin.contratos.criar({ investidorId: 1, ofertaId: 1, principalCentavos: 100_000_00, prazoMeses: 12 }),
      /Captação travada/,
    );
  } finally {
    process.env.EMISSOR_AUTORIZADO = salvo;
  }
});
