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
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codigoIdx: uniqueIndex("ccbs_codigo_idx").on(t.ofertaId, t.codigo) }),
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
