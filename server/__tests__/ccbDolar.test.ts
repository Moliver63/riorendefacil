/**
 * Aplicação em dólar: cotação PTAX importada (resposta simulada), contrato em USD
 * enquadrado pela faixa em reais, painel com saldo em USD e BRL, situação,
 * auditoria com valor anterior e modo consulta travando saque.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { desc, eq } from "drizzle-orm";
import { db, aplicarMigracoes } from "../db";
import { appRouter } from "../_core/router";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { encontrarOuCriarUsuario } from "../contas";
import { auditoria, lancamentosConta } from "../schema";
import type { Usuario } from "../schema";
import { buscarPtax } from "../cotacaoService";

const criar = createCallerFactory(appRouter);
const caller = (u: Usuario) => criar({ req: { cookies: {} } as TrpcContext["req"], res: {} as TrpcContext["res"], usuario: u, ip: "127.0.0.1" });

const ENV_TESTE = {
  EMISSOR_AUTORIZADO: "true",
  EMISSOR_NOME: "Rio Emissora Teste S.A.",
  EMISSOR_CNPJ: "00.000.000/0001-00",
  EMISSOR_REGISTRO_CVM: "TESTE-123",
  EMISSOR_CUSTODIANTE: "Fiduciário Teste",
  EMISSOR_AUDITOR: "Auditoria Teste",
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

test("PTAX: lê a resposta do Banco Central e falha com mensagem clara", async () => {
  const ok = (async () => new Response(JSON.stringify({ value: [{ cotacaoVenda: 5.4321, dataHoraCotacao: "2026-11-06 13:09:28.123" }] }))) as unknown as typeof fetch;
  const c = await buscarPtax(new Date("2026-11-09T12:00:00Z"), ok);
  assert.equal(c.valor, 5.4321);
  assert.equal(c.data, "2026-11-06");
  const vazio = (async () => new Response(JSON.stringify({ value: [] }))) as unknown as typeof fetch;
  await assert.rejects(buscarPtax(new Date(), vazio), /não devolveu cotação/);
  const fora = (async () => { throw new Error("rede"); }) as unknown as typeof fetch;
  await assert.rejects(buscarPtax(new Date(), fora), /Banco Central/);
});

test("aplicação em dólar: faixa em reais, painel em USD e BRL, auditoria e modo consulta", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("chefe-usd@exemplo.com");
  const ca = caller(await encontrarOuCriarUsuario({ email: "chefe-usd@exemplo.com" }));
  const ci = caller(await encontrarOuCriarUsuario({ email: "bia-usd@exemplo.com" }));

  const oferta = await ca.admin.ofertas.salvar({
    nome: "Oferta Dólar",
    faixas: [{ minimoCentavos: 1_000_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.01 }],
    carenciaPrincipalDias: 90,
    prazoResgateDias: 7,
  });
  await ca.admin.ofertas.ativar({ id: oferta.id, ativa: true });
  await ca.admin.ccbs.salvar({
    ofertaId: oferta.id, codigo: "CCB-USD", setor: "imobiliario", devedorDescricao: "Imóvel", valorCentavos: 100_000_00,
    garantiaTipo: "Alienação fiduciária", garantiaValorCentavos: 10_000_000_00, vencimento: "2030-01-01", situacao: "adimplente", diasAtraso: 0,
  });
  await ci.investidor.salvarCadastro({
    nomeCompleto: "Bia Lima", cpf: "529.982.247-25", dataNascimento: "1985-05-05", estadoCivil: "solteiro(a)", profissao: "Médica",
    telefone: "47966665555", cep: "88330000", logradouro: "Rua Três", numero: "30", bairro: "Centro", cidade: "Balneário Camboriú", uf: "SC",
    faixaRenda: "R$ 20 mil a R$ 50 mil", faixaPatrimonio: "R$ 1 mi a R$ 5 mi", origemRecursos: "Salário", ppe: false,
    bancoCodigo: "001", bancoNome: "Banco do Brasil", agencia: "4321", conta: "7777-1", contaTipo: "corrente", declaracao: true,
  });
  const invId = (await ca.admin.investidores.listar()).find((l) => l.email === "bia-usd@exemplo.com")!.id;

  // sem cotação, contrato em dólar não sai
  await assert.rejects(
    ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 200_000_00, moeda: "USD", prazoMeses: 12 }),
    /cotação/,
  );
  await ca.admin.cotacoes.registrar({ valor: 5, data: diasAtras(3), fonte: "PTAX venda · Banco Central do Brasil" });
  // corrigida no mesmo dia e fonte: a auditoria guarda o valor anterior
  await ca.admin.cotacoes.registrar({ valor: 5.5, data: diasAtras(3), fonte: "PTAX venda · Banco Central do Brasil" });
  const [audCot] = await db.select().from(auditoria).where(eq(auditoria.acao, "cotacao_corrigida")).orderBy(desc(auditoria.id)).limit(1);
  assert.deepEqual((audCot!.dados as { valor: unknown }).valor, { antes: 5, depois: 5.5 });

  // US$ 200 mil × 5,5 = R$ 1,1 mi: entra na faixa de R$ 1 mi
  const c = await ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 200_000_00, moeda: "USD", numeroCcb: "CCB-USD-0001", prazoMeses: 12 });
  assert.equal(c.moeda, "USD");
  await ca.admin.contratos.marcarAssinado({ id: c.id });
  await ca.admin.contratos.confirmarAporte({ id: c.id, inicio: diasAtras(60) });

  // aporte entra na conta vinculada em reais
  const [aporte] = await db.select().from(lancamentosConta).where(eq(lancamentosConta.contratoId, c.id)).limit(1);
  assert.equal(aporte!.valorCentavos, 1_100_000_00);

  const p = await ci.investidor.painel();
  const item = p.contratos.find((x) => x.id === c.id)!;
  assert.equal(item.moeda, "USD");
  assert.equal(item.situacao, "ativa");
  assert.equal(item.numeroCcb, "CCB-USD-0001");
  assert.equal(item.emissora, "Rio Emissora Teste S.A.");
  assert.ok(item.saldoCentavos > 200_000_00);
  assert.equal(item.emReais.saldoCentavos, Math.round(item.saldoCentavos * 5.5));
  assert.ok(item.rentabilidadePct > 0.019 && item.rentabilidadePct < 0.021, `rentabilidade ${item.rentabilidadePct}`);
  assert.equal(p.cotacao?.valor, 5.5);

  // número da CCB corrigido: auditoria com antes e depois
  await ca.admin.contratos.atualizarIdentificacao({ id: c.id, numeroCcb: "CCB-USD-0002" });
  const [audCcb] = await db.select().from(auditoria).where(eq(auditoria.acao, "contrato_identificacao")).orderBy(desc(auditoria.id)).limit(1);
  assert.deepEqual((audCcb!.dados as { alteracoes: unknown }).alteracoes, { numeroCcb: { antes: "CCB-USD-0001", depois: "CCB-USD-0002" } });

  // modo consulta: painel avisa e o saque é recusado
  ENV.modoConsulta = true;
  try {
    const pc = await ci.investidor.painel();
    assert.equal(pc.modoConsulta, true);
    assert.equal(pc.resgateHabilitado, false);
    await assert.rejects(
      ci.investidor.solicitarResgate({ contratoId: c.id, valorCentavos: 100_00, idempotencyKey: crypto.randomUUID() }),
      /só de consulta/,
    );
  } finally {
    ENV.modoConsulta = false;
  }
});
