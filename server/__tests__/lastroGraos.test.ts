/**
 * Lastro em grãos com banco real em memória:
 * garantias → trava de cobertura → reserva → contrato → aporte na conta vinculada →
 * compra → venda → recebimento → margem pela ordem de pagamentos.
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
import { TRILHA } from "../../shared/trilha";
import type { Usuario } from "../schema";

const criar = createCallerFactory(appRouter);
const caller = (u: Usuario) => criar({ req: { cookies: {} } as TrpcContext["req"], res: {} as TrpcContext["res"], usuario: u, ip: "127.0.0.1" });
const publico = () => criar({ req: { cookies: {} } as TrpcContext["req"], res: {} as TrpcContext["res"], usuario: null, ip: "127.0.0.1" });

const EMISSOR = {
  EMISSOR_AUTORIZADO: "true",
  EMISSOR_NOME: "Emissor Teste S.A.",
  EMISSOR_CNPJ: "00.000.000/0001-00",
  EMISSOR_REGISTRO_CVM: "TESTE-123",
  EMISSOR_CUSTODIANTE: "Fiduciário Teste",
  EMISSOR_AUDITOR: "Auditoria Teste",
};
const envOriginal: Record<string, string | undefined> = {};
const hoje = new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

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

test("lastro em grãos: cobertura, conta vinculada e ordem de pagamentos", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("chefe-graos@exemplo.com");
  const admin = await encontrarOuCriarUsuario({ email: "chefe-graos@exemplo.com" });
  const invU = await encontrarOuCriarUsuario({ email: "joao-graos@exemplo.com" });
  const ca = caller(admin);
  const ci = caller(invU);

  const oferta = await ca.admin.ofertas.salvar({
    nome: "Giro de Grãos Teste",
    codigo: "RRF-GR-T1",
    tese: "Compra à vista de grãos com revenda a compradores aprovados.",
    faixas: [{ minimoCentavos: 10_000_00, prazoMinimoMeses: 6, taxaMensalTeto: 0.012 }],
    carenciaPrincipalDias: 90,
    prazoResgateDias: 7,
    coberturaMinima: 1.3,
    captacaoAlvoCentavos: 5_000_000_00,
  });
  await ca.admin.ofertas.ativar({ id: oferta.id, ativa: true });

  // vitrine pública mostra a oferta real
  const prateleira = await publico().plataforma.ofertas();
  assert.ok(prateleira.some((f) => !f.exemplo && f.codigo === "RRF-GR-T1"));

  // investidor apto
  for (const m of TRILHA) await ci.trilha.responder({ slug: m.slug, respostas: Object.fromEntries(m.perguntas.map((p) => [p.id, p.correta])) });
  await ci.investidor.salvarSuitability({ respostas: { objetivo: 1, prazo: 2, reserva: 2, experiencia: 1, perda: 1 } });
  assert.equal((await ci.investidor.pendencias()).length, 1); // falta cadastro
  await ci.investidor.salvarCadastro({
    nomeCompleto: "João Pereira",
    cpf: "111.444.777-35",
    dataNascimento: "1980-02-02",
    estadoCivil: "solteiro(a)",
    profissao: "Engenheiro",
    telefone: "47988887777",
    cep: "88330000",
    logradouro: "Rua Um",
    numero: "10",
    bairro: "Centro",
    cidade: "Balneário Camboriú",
    uf: "SC",
    faixaRenda: "R$ 20 mil a R$ 50 mil",
    faixaPatrimonio: "R$ 1 mi a R$ 5 mi",
    origemRecursos: "Salário",
    ppe: false,
    bancoCodigo: "001",
    bancoNome: "Banco do Brasil",
    agencia: "1234",
    conta: "9999-1",
    contaTipo: "corrente",
    declaracao: true,
  });

  // reserva com taxa da faixa
  const reserva = await ci.investidor.reservar({ ofertaId: oferta.id, valorCentavos: 1_000_000_00, prazoMeses: 12 });
  assert.equal(reserva.taxaMensal, 0.012);
  const invId = (await ca.admin.investidores.listar()).find((l) => l.email === "joao-graos@exemplo.com")!.id;

  // sem garantias, a captação trava
  await assert.rejects(
    ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 1_000_000_00, prazoMeses: 12, reservaId: reserva.id }),
    /Captação travada: com este valor a cobertura/,
  );
  // 1,2 mi de garantia elegível para 1 mi = 120%: ainda abaixo de 130%
  const garantia = {
    ofertaId: oferta.id,
    codigo: "CCB-G-T1",
    devedorDescricao: "Área rural, Sorriso/MT",
    valorCentavos: 800_000_00,
    garantiaTipo: "Alienação fiduciária de imóvel rural",
    garantiaValorCentavos: 1_500_000_00,
    valorElegivelCentavos: 1_200_000_00,
    vencimento: "2028-01-01",
    situacao: "adimplente" as const,
    diasAtraso: 0,
    setor: "imobiliario" as const,
  };
  const g = await ca.admin.ccbs.salvar(garantia);
  await assert.rejects(ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 1_000_000_00, prazoMeses: 12 }), /120%/);
  await ca.admin.ccbs.salvar({ ...garantia, id: g.id, valorElegivelCentavos: 1_500_000_00 });

  const contrato = await ca.admin.contratos.criar({ investidorId: invId, ofertaId: oferta.id, principalCentavos: 1_000_000_00, prazoMeses: 12, reservaId: reserva.id });
  assert.equal((await ci.investidor.reservas()).length, 0, "reserva convertida sai da lista");
  await ca.admin.contratos.marcarAssinado({ id: contrato.id });
  await ca.admin.contratos.confirmarAporte({ id: contrato.id, inicio: diasAtras(30) });

  let painel = await ca.admin.operacoes.painel({ ofertaId: oferta.id });
  assert.equal(painel.posicao.saldoContaCentavos, 1_000_000_00, "aporte entra na conta vinculada");
  assert.equal(painel.posicao.cobertura, 1.5);

  // operação de milho: compra maior que o saldo é recusada
  const op = await ca.admin.operacoes.salvar({
    ofertaId: oferta.id,
    codigo: "OP-T1",
    grao: "milho",
    produtorDescricao: "Produtor rural",
    origemMunicipio: "Sorriso",
    origemUf: "mt",
    toneladas: 850,
    valorCompraCentavos: 950_000_00,
  });
  await assert.rejects(ca.admin.operacoes.registrarVenda({ id: op.id, compradorTipo: "cooperativa", compradorDescricao: "Coop", destinoMunicipio: "Rio Verde", destinoUf: "GO", valorVendaCentavos: 1, nfVenda: "1", dataVenda: hoje, vencimentoRecebimento: hoje }), /não pode ir/);
  await assert.rejects(ca.admin.operacoes.registrarCompra({ id: op.id, dataCompra: hoje, nfCompra: "NF-1", custosCentavos: 60_000_00 }), /não cobre/);
  await ca.admin.operacoes.registrarCompra({ id: op.id, dataCompra: hoje, nfCompra: "NF-1", custosCentavos: 40_000_00 });

  painel = await ca.admin.operacoes.painel({ ofertaId: oferta.id });
  assert.equal(painel.posicao.saldoContaCentavos, 10_000_00);
  assert.equal(painel.posicao.emOperacaoCentavos, 990_000_00);

  // investidor vê onde está o dinheiro dele (único contrato = 100%)
  const meuPainel = await ci.investidor.painel();
  const aloc = meuPainel.contratos[0]!.alocacao;
  assert.deepEqual(aloc.map((a) => [a.grao, a.centavos]), [["milho", 990_000_00], ["caixa", 10_000_00]]);

  // ficha pública não expõe NF
  const f = await publico().plataforma.oferta({ id: oferta.id });
  assert.equal(f.operacoes[0]!.origem, "Produtor rural, Sorriso/MT");
  assert.ok(!JSON.stringify(f).includes("NF-1"));

  await ca.admin.operacoes.registrarTransporte({ id: op.id, transportadora: "Transportes Teste", destinoMunicipio: "Rio Verde", destinoUf: "GO" });
  await ca.admin.operacoes.registrarVenda({
    id: op.id,
    compradorTipo: "cooperativa",
    compradorDescricao: "Cooperativa Teste",
    destinoMunicipio: "Rio Verde",
    destinoUf: "GO",
    valorVendaCentavos: 1_080_000_00,
    nfVenda: "NF-V1",
    dataVenda: hoje,
    vencimentoRecebimento: hoje,
  });
  // recebimento em duas parcelas
  const p1 = await ca.admin.operacoes.registrarRecebimento({ id: op.id, valorCentavos: 500_000_00, data: hoje });
  assert.equal(p1.quitada, false);
  await assert.rejects(ca.admin.operacoes.registrarRecebimento({ id: op.id, valorCentavos: 600_000_00, data: hoje }), /Falta receber/);
  const p2 = await ca.admin.operacoes.registrarRecebimento({ id: op.id, valorCentavos: 580_000_00, data: hoje });
  assert.equal(p2.quitada, true);

  painel = await ca.admin.operacoes.painel({ ofertaId: oferta.id });
  assert.equal(painel.posicao.saldoContaCentavos, 1_090_000_00);
  // obrigação = 1 mi + 30 dias a 1,2% a.m. nominal com juros diários compostos (11.903,54)
  assert.equal(painel.posicao.obrigacoesCentavos, 1_011_903_54);
  const liberavel = painel.posicao.margemLiberavelCentavos;
  assert.equal(liberavel, 1_090_000_00 - 1_011_903_54);

  // a margem da Rio não passa na frente do investidor
  await assert.rejects(
    ca.admin.conta.lancar({ ofertaId: oferta.id, tipo: "margem_rio", valorCentavos: 100_000_00, descricao: "Margem", data: hoje }),
    /margem liberável hoje é R\$\s?78\.096,46/,
  );
  await ca.admin.conta.lancar({ ofertaId: oferta.id, tipo: "margem_rio", valorCentavos: liberavel, descricao: "Margem OP-T1", data: hoje });

  // resgate pago sai da conta vinculada
  const pedido = await ci.investidor.solicitarResgate({ contratoId: contrato.id, valorCentavos: 11_903_54, idempotencyKey: "6f1c9a52-2b8e-4f7d-9a51-3c2d1e0f4b77" });
  await ca.admin.resgates.aprovar({ id: pedido.id! });
  await ca.admin.resgates.marcarPago({ id: pedido.id! });
  const extrato = await db.select().from(lancamentosConta).where(eq(lancamentosConta.ofertaId, oferta.id));
  assert.deepEqual(
    extrato.map((l) => l.tipo).sort(),
    ["aporte", "compra_graos", "custos", "margem_rio", "pagamento_rendimento", "recebimento_venda", "recebimento_venda"].sort(),
  );
  painel = await ca.admin.operacoes.painel({ ofertaId: oferta.id });
  assert.equal(painel.posicao.saldoContaCentavos, 1_000_000_00, "sobra exatamente o principal do investidor");

  // garantia executada derruba a cobertura e trava novas compras
  await ca.admin.ccbs.salvar({ ...garantia, id: g.id, situacao: "executada", valorElegivelCentavos: 1_500_000_00 });
  const op2 = await ca.admin.operacoes.salvar({ ofertaId: oferta.id, codigo: "OP-T2", grao: "soja", produtorDescricao: "Produtor rural", origemMunicipio: "Sinop", origemUf: "MT", toneladas: 100, valorCompraCentavos: 100_000_00 });
  await assert.rejects(ca.admin.operacoes.registrarCompra({ id: op2.id, dataCompra: hoje, nfCompra: "NF-2" }), /suspensas/);
  await assert.rejects(ci.investidor.reservar({ ofertaId: oferta.id, valorCentavos: 100_000_00, prazoMeses: 12 }), /suspensas/);
});
