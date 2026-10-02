/**
 * Schema do banco (PostgreSQL + Drizzle). Fica em server/schema.ts, como no
 * MecProAI. O cliente usa os tipos inferidos pelo tRPC, nunca importa daqui.
 *
 * Migrações: `npm run db:generate` gera o SQL em drizzle/ a partir deste
 * arquivo; o servidor aplica no boot com o migrator oficial do Drizzle.
 * NUNCA usar `drizzle-kit push` (incidente do MecProAI: 20 tabelas perdidas).
 *
 * Princípio: a plataforma registra e exibe. Dinheiro de investidor nunca passa
 * por conta da plataforma, só pela conta vinculada do emissor.
 */
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { PAPEIS, STATUS_LEAD } from "../shared/const";

export const papelEnum = pgEnum("papel", PAPEIS);
export const kycStatus = pgEnum("kyc_status", ["pendente", "em_analise", "aprovado", "reprovado"]);
export const perfilSuitability = pgEnum("perfil_suitability", ["conservador", "moderado", "arrojado", "nao_avaliado"]);
export const statusContrato = pgEnum("status_contrato", [
  "rascunho",
  "aguardando_assinatura",
  "assinado",
  "aguardando_aporte",
  "ativo",
  "vencido",
  "liquidado",
  "cancelado",
]);
export const statusResgate = pgEnum("status_resgate", ["solicitado", "aprovado", "pago", "recusado"]);
export const statusLead = pgEnum("status_lead", STATUS_LEAD);

// ─── Usuários e acesso ──────────────────────────────────────────────────────

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    nome: varchar("nome", { length: 255 }),
    telefone: varchar("telefone", { length: 32 }),
    papel: papelEnum("papel").notNull().default("investidor"),
    googleSub: varchar("google_sub", { length: 255 }),
    /** incrementar invalida todas as sessões abertas do usuário */
    versaoSessao: integer("versao_sessao").notNull().default(1),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    ultimoLoginEm: timestamp("ultimo_login_em", { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex("usuarios_email_idx").on(t.email),
    googleIdx: uniqueIndex("usuarios_google_idx").on(t.googleSub),
  }),
);

/** Link mágico de acesso por e-mail. Só o hash do token é guardado. */
export const linksAcesso = pgTable(
  "links_acesso",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    usadoEm: timestamp("usado_em", { withTimezone: true }),
    ip: varchar("ip", { length: 64 }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tokenIdx: uniqueIndex("links_acesso_token_idx").on(t.tokenHash) }),
);

// ─── Investidor ─────────────────────────────────────────────────────────────

export const investidores = pgTable(
  "investidores",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    kyc: kycStatus("kyc").notNull().default("pendente"),
    kycProvedorRef: varchar("kyc_provedor_ref", { length: 255 }),
    suitability: perfilSuitability("suitability").notNull().default("nao_avaliado"),
    suitabilityRespostas: jsonb("suitability_respostas"),
    suitabilityEm: timestamp("suitability_em", { withTimezone: true }),
    pessoaPoliticamenteExposta: boolean("ppe").notNull().default(false),
    assessorId: integer("assessor_id").references(() => usuarios.id),
    trilhaConcluidaEm: timestamp("trilha_concluida_em", { withTimezone: true }),
    lembreteTrilhaEnviadoEm: timestamp("lembrete_trilha_enviado_em", { withTimezone: true }),
    interesseAporteEm: timestamp("interesse_aporte_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ usuarioIdx: uniqueIndex("investidores_usuario_idx").on(t.usuarioId) }),
);

/** Progresso da trilha educativa (padrão learning path da Shadia). */
export const progressoTrilha = pgTable(
  "progresso_trilha",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    moduloSlug: varchar("modulo_slug", { length: 64 }).notNull(),
    acertos: integer("acertos").notNull(),
    total: integer("total").notNull(),
    concluidoEm: timestamp("concluido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ unico: uniqueIndex("progresso_trilha_unico").on(t.usuarioId, t.moduloSlug) }),
);

/**
 * Cadastro completo do investidor (pessoa física), base da qualificação no
 * contrato. Campos sensíveis (CPF, RG, conta, Pix) ficam cifrados com
 * AES-256-GCM (server/cripto.ts); o CPF também tem um HMAC para garantir que
 * duas contas não usem o mesmo documento, sem guardar o número em claro.
 */
export const cadastros = pgTable(
  "cadastros",
  {
    id: serial("id").primaryKey(),
    investidorId: integer("investidor_id")
      .notNull()
      .references(() => investidores.id),
    nomeCompleto: varchar("nome_completo", { length: 255 }).notNull(),
    cpfCifrado: text("cpf_cifrado").notNull(),
    cpfHash: varchar("cpf_hash", { length: 64 }).notNull(),
    cpfFinal: varchar("cpf_final", { length: 4 }).notNull(),
    dataNascimento: date("data_nascimento").notNull(),
    rgCifrado: text("rg_cifrado"),
    rgOrgao: varchar("rg_orgao", { length: 32 }),
    nacionalidade: varchar("nacionalidade", { length: 64 }).notNull().default("brasileira"),
    estadoCivil: varchar("estado_civil", { length: 32 }).notNull(),
    profissao: varchar("profissao", { length: 128 }).notNull(),
    telefone: varchar("telefone", { length: 32 }).notNull(),
    cep: varchar("cep", { length: 8 }).notNull(),
    logradouro: varchar("logradouro", { length: 255 }).notNull(),
    numero: varchar("numero", { length: 32 }).notNull(),
    complemento: varchar("complemento", { length: 128 }),
    bairro: varchar("bairro", { length: 128 }).notNull(),
    cidade: varchar("cidade", { length: 128 }).notNull(),
    uf: varchar("uf", { length: 2 }).notNull(),
    faixaRenda: varchar("faixa_renda", { length: 64 }).notNull(),
    faixaPatrimonio: varchar("faixa_patrimonio", { length: 64 }).notNull(),
    origemRecursos: varchar("origem_recursos", { length: 255 }).notNull(),
    ppe: boolean("ppe").notNull().default(false),
    bancoCodigo: varchar("banco_codigo", { length: 8 }).notNull(),
    bancoNome: varchar("banco_nome", { length: 128 }).notNull(),
    agencia: varchar("agencia", { length: 16 }).notNull(),
    contaCifrada: text("conta_cifrada").notNull(),
    contaFinal: varchar("conta_final", { length: 4 }).notNull(),
    contaTipo: varchar("conta_tipo", { length: 16 }).notNull(),
    pixCifrado: text("pix_cifrado"),
    declaracaoVeracidadeEm: timestamp("declaracao_veracidade_em", { withTimezone: true }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invIdx: uniqueIndex("cadastros_investidor_idx").on(t.investidorId),
    cpfIdx: uniqueIndex("cadastros_cpf_idx").on(t.cpfHash),
  }),
);

// ─── Captação ───────────────────────────────────────────────────────────────

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    telefone: varchar("telefone", { length: 32 }).notNull(),
    faixaPatrimonio: varchar("faixa_patrimonio", { length: 64 }),
    status: statusLead("status").notNull().default("novo"),
    origem: varchar("origem", { length: 64 }),
    utm: jsonb("utm"),
    consentimentoLGPD: boolean("consentimento_lgpd").notNull(),
    consentimentoTexto: text("consentimento_texto").notNull(),
    simulacao: jsonb("simulacao"),
    notas: text("notas"),
    assessorId: integer("assessor_id").references(() => usuarios.id),
    lembreteEnviadoEm: timestamp("lembrete_enviado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ statusIdx: index("leads_status_idx").on(t.status) }),
);

// ─── Oferta e lastro ────────────────────────────────────────────────────────

export const ofertas = pgTable("ofertas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  faixas: jsonb("faixas").notNull(),
  carenciaPrincipalDias: integer("carencia_principal_dias").notNull().default(60),
  prazoResgateDias: integer("prazo_resgate_dias").notNull().default(7),
  ativa: boolean("ativa").notNull().default(false),
  /** Ficha do produto, no formato das prateleiras de renda fixa. */
  codigo: varchar("codigo", { length: 32 }),
  tese: text("tese"),
  /** Garantias elegíveis ÷ principal comprometido. Abaixo disso, captação e compras param. */
  coberturaMinima: numeric("cobertura_minima", { precision: 6, scale: 4 }).notNull().default("1.3"),
  captacaoAlvoCentavos: bigint("captacao_alvo_centavos", { mode: "number" }),
  prazoMedioCicloDias: integer("prazo_medio_ciclo_dias").notNull().default(60),
  reservasAte: date("reservas_ate"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const ccbs = pgTable(
  "ccbs",
  {
    id: serial("id").primaryKey(),
    ofertaId: integer("oferta_id")
      .notNull()
      .references(() => ofertas.id),
    codigo: varchar("codigo", { length: 64 }).notNull(),
    setor: varchar("setor", { length: 32 }).notNull(),
    devedorDescricao: varchar("devedor_descricao", { length: 255 }).notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    garantiaTipo: varchar("garantia_tipo", { length: 128 }).notNull(),
    garantiaValorCentavos: bigint("garantia_valor_centavos", { mode: "number" }),
    vencimento: date("vencimento").notNull(),
    situacao: varchar("situacao", { length: 32 }).notNull().default("adimplente"),
    diasAtraso: integer("dias_atraso").notNull().default(0),
    registroRef: varchar("registro_ref", { length: 255 }),
    /** Valor da garantia que conta para a cobertura (avaliação com desconto). Sem valor, usa a avaliação cheia. */
    valorElegivelCentavos: bigint("valor_elegivel_centavos", { mode: "number" }),
    /** Formato da carteira de CCBs: série, emissão e valor de resgate no vencimento (bullet). */
    serie: varchar("serie", { length: 32 }),
    dataEmissao: date("data_emissao"),
    valorResgateCentavos: bigint("valor_resgate_centavos", { mode: "number" }),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codigoIdx: uniqueIndex("ccbs_codigo_idx").on(t.ofertaId, t.codigo) }),
);

/**
 * Operações de grãos que lastreiam a oferta: compra do produtor, transporte,
 * venda a comprador aprovado e recebimento na conta vinculada.
 */
export const operacoesGraos = pgTable(
  "operacoes_graos",
  {
    id: serial("id").primaryKey(),
    ofertaId: integer("oferta_id")
      .notNull()
      .references(() => ofertas.id),
    codigo: varchar("codigo", { length: 32 }).notNull(),
    grao: varchar("grao", { length: 16 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("em_analise"),
    /** Descrição pública do produtor (sem nome de pessoa física): "Produtor rural, Sorriso/MT" */
    produtorDescricao: varchar("produtor_descricao", { length: 255 }).notNull(),
    origemMunicipio: varchar("origem_municipio", { length: 120 }).notNull(),
    origemUf: varchar("origem_uf", { length: 2 }).notNull(),
    toneladas: numeric("toneladas", { precision: 12, scale: 3 }).notNull(),
    valorCompraCentavos: bigint("valor_compra_centavos", { mode: "number" }).notNull(),
    custosCentavos: bigint("custos_centavos", { mode: "number" }).notNull().default(0),
    nfCompra: varchar("nf_compra", { length: 64 }),
    dataCompra: date("data_compra"),
    transportadora: varchar("transportadora", { length: 160 }),
    destinoMunicipio: varchar("destino_municipio", { length: 120 }),
    destinoUf: varchar("destino_uf", { length: 2 }),
    compradorTipo: varchar("comprador_tipo", { length: 24 }),
    compradorDescricao: varchar("comprador_descricao", { length: 255 }),
    valorVendaCentavos: bigint("valor_venda_centavos", { mode: "number" }),
    nfVenda: varchar("nf_venda", { length: 64 }),
    dataVenda: date("data_venda"),
    vencimentoRecebimento: date("vencimento_recebimento"),
    valorRecebidoCentavos: bigint("valor_recebido_centavos", { mode: "number" }).notNull().default(0),
    dataRecebimento: date("data_recebimento"),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codigoIdx: uniqueIndex("operacoes_graos_codigo_idx").on(t.ofertaId, t.codigo),
    statusIdx: index("operacoes_graos_status_idx").on(t.ofertaId, t.status),
  }),
);

/**
 * Extrato da conta vinculada de cada oferta. Valor com sinal: positivo entra,
 * negativo sai. Nunca se apaga um lançamento; correção é um ajuste novo.
 */
export const lancamentosConta = pgTable(
  "lancamentos_conta",
  {
    id: serial("id").primaryKey(),
    ofertaId: integer("oferta_id")
      .notNull()
      .references(() => ofertas.id),
    data: date("data").notNull(),
    tipo: varchar("tipo", { length: 24 }).notNull(),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    descricao: varchar("descricao", { length: 255 }).notNull(),
    operacaoId: integer("operacao_id").references(() => operacoesGraos.id),
    contratoId: integer("contrato_id"),
    resgateId: integer("resgate_id"),
    comprovanteChave: text("comprovante_chave"),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ ofertaIdx: index("lancamentos_conta_oferta_idx").on(t.ofertaId, t.data) }),
);

/**
 * Depósito informado pelo investidor para um contrato aguardando aporte.
 * O dinheiro vai direto para a conta vinculada; aqui fica só o aviso, o
 * comprovante e a confirmação da equipe (que ativa o contrato).
 */
export const depositos = pgTable(
  "depositos",
  {
    id: serial("id").primaryKey(),
    investidorId: integer("investidor_id")
      .notNull()
      .references(() => investidores.id),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    dataDeposito: date("data_deposito").notNull(),
    comprovanteChave: text("comprovante_chave"),
    status: varchar("status", { length: 16 }).notNull().default("informado"),
    motivoRecusa: text("motivo_recusa"),
    confirmadoPor: integer("confirmado_por").references(() => usuarios.id),
    confirmadoEm: timestamp("confirmado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ invIdx: index("depositos_investidor_idx").on(t.investidorId, t.status) }),
);

/**
 * Saque do principal: no vencimento (recompra dos títulos pela Rio) ou
 * antecipado (D+60, com penalidade sobre a performance). Valores calculados e
 * congelados no pedido.
 */
export const resgatesPrincipal = pgTable(
  "resgates_principal",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id),
    tipo: varchar("tipo", { length: 16 }).notNull(),
    regra: varchar("regra", { length: 255 }).notNull(),
    diasPermanencia: integer("dias_permanencia").notNull(),
    principalCentavos: bigint("principal_centavos", { mode: "number" }).notNull(),
    rendimentoSacadoCentavos: bigint("rendimento_sacado_centavos", { mode: "number" }).notNull(),
    brutoCentavos: bigint("bruto_centavos", { mode: "number" }).notNull(),
    penalidadeCentavos: bigint("penalidade_centavos", { mode: "number" }).notNull(),
    irCentavos: bigint("ir_centavos", { mode: "number" }).notNull(),
    liquidoCentavos: bigint("liquido_centavos", { mode: "number" }).notNull(),
    previstoPara: date("previsto_para").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("solicitado"),
    motivoRecusa: text("motivo_recusa"),
    comprovanteChave: text("comprovante_chave"),
    solicitadoEm: timestamp("solicitado_em", { withTimezone: true }).notNull().defaultNow(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
  },
  (t) => ({ contratoIdx: index("resgates_principal_contrato_idx").on(t.contratoId) }),
);

/** Reserva do investidor numa oferta, antes do contrato (como nas ofertas das corretoras). */
export const reservas = pgTable(
  "reservas",
  {
    id: serial("id").primaryKey(),
    investidorId: integer("investidor_id")
      .notNull()
      .references(() => investidores.id),
    ofertaId: integer("oferta_id")
      .notNull()
      .references(() => ofertas.id),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    prazoMeses: integer("prazo_meses").notNull(),
    taxaMensal: numeric("taxa_mensal", { precision: 8, scale: 6 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("ativa"),
    contratoId: integer("contrato_id"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ invIdx: index("reservas_investidor_idx").on(t.investidorId, t.status) }),
);

export const contratos = pgTable(
  "contratos",
  {
    id: serial("id").primaryKey(),
    investidorId: integer("investidor_id")
      .notNull()
      .references(() => investidores.id),
    ofertaId: integer("oferta_id")
      .notNull()
      .references(() => ofertas.id),
    principalCentavos: bigint("principal_centavos", { mode: "number" }).notNull(),
    taxaMensal: numeric("taxa_mensal", { precision: 8, scale: 6 }).notNull(),
    prazoMeses: integer("prazo_meses").notNull(),
    status: statusContrato("status").notNull().default("rascunho"),
    assinaturaProvedor: varchar("assinatura_provedor", { length: 32 }),
    assinaturaRef: varchar("assinatura_ref", { length: 255 }),
    inicio: date("inicio"),
    vencimento: date("vencimento"),
    comprovanteAporteChave: text("comprovante_aporte_chave"),
    /**
     * "Foto" da qualificação do investidor no momento da criação (nome, CPF
     * mascarado, endereço, estado civil, profissão, conta de resgate mascarada).
     * O contrato não muda se o cadastro for editado depois.
     */
    qualificacao: jsonb("qualificacao"),
    observacoes: text("observacoes"),
    criadoPor: integer("criado_por").references(() => usuarios.id),
    assinadoEm: timestamp("assinado_em", { withTimezone: true }),
    ativadoEm: timestamp("ativado_em", { withTimezone: true }),
    canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ invIdx: index("contratos_investidor_idx").on(t.investidorId) }),
);

export const resgatesRendimento = pgTable(
  "resgates_rendimento",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id),
    valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
    irRetidoCentavos: bigint("ir_retido_centavos", { mode: "number" }).notNull().default(0),
    status: statusResgate("status").notNull().default("solicitado"),
    solicitadoEm: timestamp("solicitado_em", { withTimezone: true }).notNull().defaultNow(),
    previstoPara: date("previsto_para").notNull(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
    aprovadoPor: integer("aprovado_por").references(() => usuarios.id),
    pagoPor: integer("pago_por").references(() => usuarios.id),
    comprovanteChave: text("comprovante_chave"),
    motivoRecusa: varchar("motivo_recusa", { length: 500 }),
  },
  (t) => ({ idemIdx: uniqueIndex("resgates_idempotency_idx").on(t.idempotencyKey) }),
);

/** Cofre documental. Arquivo fica no Cloudflare R2; aqui só metadado e hash. */
export const documentos = pgTable(
  "documentos",
  {
    id: serial("id").primaryKey(),
    /** investidor | contrato | oferta | ccb | publico */
    escopo: varchar("escopo", { length: 32 }).notNull(),
    escopoId: integer("escopo_id"),
    tipo: varchar("tipo", { length: 64 }).notNull(),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    tamanhoBytes: integer("tamanho_bytes"),
    publicadoPor: integer("publicado_por").references(() => usuarios.id),
    publicadoEm: timestamp("publicado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ escopoIdx: index("documentos_escopo_idx").on(t.escopo, t.escopoId) }),
);

/** Trilha de auditoria append-only. */
export const auditoria = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  atorId: integer("ator_id"),
  acao: varchar("acao", { length: 64 }).notNull(),
  entidade: varchar("entidade", { length: 64 }).notNull(),
  entidadeId: integer("entidade_id"),
  dados: jsonb("dados"),
  ip: varchar("ip", { length: 64 }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/** Peças de comunicação revisadas antes de publicar. */
export const pecasComunicacao = pgTable("pecas_comunicacao", {
  id: serial("id").primaryKey(),
  canal: varchar("canal", { length: 32 }).notNull(),
  texto: text("texto").notNull(),
  resultadoGuard: jsonb("resultado_guard").notNull(),
  criadoPor: integer("criado_por").references(() => usuarios.id),
  aprovadoJuridicoPor: varchar("aprovado_juridico_por", { length: 255 }),
  aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export type Usuario = typeof usuarios.$inferSelect;
export type Investidor = typeof investidores.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type CCB = typeof ccbs.$inferSelect;
export type Oferta = typeof ofertas.$inferSelect;
export type Documento = typeof documentos.$inferSelect;
export type Cadastro = typeof cadastros.$inferSelect;
export type Contrato = typeof contratos.$inferSelect;

export type OperacaoGraos = typeof operacoesGraos.$inferSelect;
export type LancamentoConta = typeof lancamentosConta.$inferSelect;
export type Reserva = typeof reservas.$inferSelect;
export type Deposito = typeof depositos.$inferSelect;
export type ResgatePrincipal = typeof resgatesPrincipal.$inferSelect;
