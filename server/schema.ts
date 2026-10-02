/**
 * Schema do banco (PostgreSQL + Drizzle).
 *
 * Regra herdada do MecProAI: NUNCA rodar `drizzle-kit push` em produção.
 * Mudanças entram por migração SQL revisada em migrations/, aplicada à mão.
 *
 * Princípio: o RioRendeFácil registra e exibe. Dinheiro não passa por conta
 * da plataforma. Aportes e resgates são liquidados na conta vinculada do
 * emissor; aqui ficam só os registros e comprovantes.
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

export const kycStatus = pgEnum("kyc_status", ["pendente", "em_analise", "aprovado", "reprovado"]);
export const perfilSuitability = pgEnum("perfil_suitability", [
  "conservador",
  "moderado",
  "arrojado",
  "nao_avaliado",
]);
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
export const statusLead = pgEnum("status_lead", [
  "novo",
  "contatado",
  "reuniao_marcada",
  "em_onboarding",
  "convertido",
  "descartado",
]);

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    nome: varchar("nome", { length: 255 }).notNull(),
    papel: varchar("papel", { length: 32 }).notNull().default("investidor"), // investidor | assessor | admin
    googleSub: varchar("google_sub", { length: 255 }),
    senhaHash: text("senha_hash"),
    criadoEm: timestamp("criado_em").notNull().defaultNow(),
  },
  (t) => ({ emailIdx: uniqueIndex("usuarios_email_idx").on(t.email) }),
);

/** Cadastro do investidor. Dados sensíveis (CPF, renda) ficam cifrados na aplicação. */
export const investidores = pgTable("investidores", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  cpfCifrado: text("cpf_cifrado"),
  telefone: varchar("telefone", { length: 32 }),
  kyc: kycStatus("kyc").notNull().default("pendente"),
  kycProvedorRef: varchar("kyc_provedor_ref", { length: 255 }),
  suitability: perfilSuitability("suitability").notNull().default("nao_avaliado"),
  suitabilityRespostas: jsonb("suitability_respostas"),
  pessoaPoliticamenteExposta: boolean("ppe").notNull().default(false),
  assessorId: integer("assessor_id").references(() => usuarios.id),
  /** concluiu a trilha educativa obrigatória (o que é CCB, riscos, sem FGC) */
  trilhaConcluidaEm: timestamp("trilha_concluida_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    telefone: varchar("telefone", { length: 32 }).notNull(),
    faixaPatrimonio: varchar("faixa_patrimonio", { length: 64 }),
    status: statusLead("status").notNull().default("novo"),
    origem: varchar("origem", { length: 64 }), // site, meta_lead_form, whatsapp, indicacao
    utm: jsonb("utm"),
    consentimentoLGPD: boolean("consentimento_lgpd").notNull(),
    consentimentoTexto: text("consentimento_texto").notNull(),
    simulacao: jsonb("simulacao"),
    criadoEm: timestamp("criado_em").notNull().defaultNow(),
    /** para cron de cadastro abandonado */
    ultimoContatoEm: timestamp("ultimo_contato_em"),
  },
  (t) => ({ statusIdx: index("leads_status_idx").on(t.status) }),
);

/** Uma oferta/pool de CCBs, publicada pelo emissor. */
export const ofertas = pgTable("ofertas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  /** quadro de faixas vigente (json de Faixa[]) */
  faixas: jsonb("faixas").notNull(),
  carenciaPrincipalDias: integer("carencia_principal_dias").notNull().default(60),
  prazoResgateDias: integer("prazo_resgate_dias").notNull().default(7),
  ativa: boolean("ativa").notNull().default(false),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

/** Cada CCB que compõe o lastro de uma oferta. É o que dá transparência ao pool. */
export const ccbs = pgTable("ccbs", {
  id: serial("id").primaryKey(),
  ofertaId: integer("oferta_id")
    .notNull()
    .references(() => ofertas.id),
  codigo: varchar("codigo", { length: 64 }).notNull(),
  setor: varchar("setor", { length: 32 }).notNull(), // agro | imobiliario | outro
  /** devedor anonimizado ("Produtor de soja, MT") */
  devedorDescricao: varchar("devedor_descricao", { length: 255 }).notNull(),
  valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
  garantiaTipo: varchar("garantia_tipo", { length: 64 }).notNull(), // alienação fiduciária de imóvel, CPR, recebíveis
  garantiaValorCentavos: bigint("garantia_valor_centavos", { mode: "number" }),
  /** LTV = valor / garantia */
  vencimento: date("vencimento").notNull(),
  situacao: varchar("situacao", { length: 32 }).notNull().default("adimplente"), // adimplente | atraso | renegociada | executada | liquidada
  diasAtraso: integer("dias_atraso").notNull().default(0),
  registroRef: varchar("registro_ref", { length: 255 }),
  atualizadoEm: timestamp("atualizado_em").notNull().defaultNow(),
});

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
    assinaturaProvedor: varchar("assinatura_provedor", { length: 32 }), // clicksign | zapsign | d4sign
    assinaturaRef: varchar("assinatura_ref", { length: 255 }),
    inicio: date("inicio"),
    vencimento: date("vencimento"),
    /** comprovante do aporte na conta vinculada do emissor (nunca na plataforma) */
    comprovanteAporteUrl: text("comprovante_aporte_url"),
    criadoEm: timestamp("criado_em").notNull().defaultNow(),
  },
  (t) => ({ invIdx: index("contratos_investidor_idx").on(t.investidorId) }),
);

export const resgatesRendimento = pgTable("resgates_rendimento", {
  id: serial("id").primaryKey(),
  contratoId: integer("contrato_id")
    .notNull()
    .references(() => contratos.id),
  valorCentavos: bigint("valor_centavos", { mode: "number" }).notNull(),
  irRetidoCentavos: bigint("ir_retido_centavos", { mode: "number" }).notNull().default(0),
  status: statusResgate("status").notNull().default("solicitado"),
  solicitadoEm: timestamp("solicitado_em").notNull().defaultNow(),
  previstoPara: date("previsto_para").notNull(),
  pagoEm: timestamp("pago_em"),
  /** chave de idempotência para impedir pedido duplicado por clique duplo */
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
});

/** Cofre documental: contratos, CCBs, laudos, pareceres de auditoria, informes de IR. */
export const documentos = pgTable("documentos", {
  id: serial("id").primaryKey(),
  escopo: varchar("escopo", { length: 32 }).notNull(), // investidor | contrato | oferta | ccb
  escopoId: integer("escopo_id").notNull(),
  tipo: varchar("tipo", { length: 64 }).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(), // Cloudflare R2
  sha256: varchar("sha256", { length: 64 }).notNull(),
  publicadoEm: timestamp("publicado_em").notNull().defaultNow(),
});

/** Trilha de auditoria imutável (append-only). */
export const auditoria = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  atorId: integer("ator_id"),
  acao: varchar("acao", { length: 64 }).notNull(),
  entidade: varchar("entidade", { length: 64 }).notNull(),
  entidadeId: integer("entidade_id"),
  dados: jsonb("dados"),
  ip: varchar("ip", { length: 64 }),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

/** Peças de comunicação avaliadas pelo guard de compliance antes de publicar. */
export const pecasComunicacao = pgTable("pecas_comunicacao", {
  id: serial("id").primaryKey(),
  canal: varchar("canal", { length: 32 }).notNull(), // meta_ads | landing | email | whatsapp
  texto: text("texto").notNull(),
  resultadoGuard: jsonb("resultado_guard").notNull(),
  aprovadoJuridicoPor: varchar("aprovado_juridico_por", { length: 255 }),
  aprovadoEm: timestamp("aprovado_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});
