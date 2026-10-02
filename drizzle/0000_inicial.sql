CREATE TYPE "public"."kyc_status" AS ENUM('pendente', 'em_analise', 'aprovado', 'reprovado');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('investidor', 'assessor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."perfil_suitability" AS ENUM('conservador', 'moderado', 'arrojado', 'nao_avaliado');--> statement-breakpoint
CREATE TYPE "public"."status_contrato" AS ENUM('rascunho', 'aguardando_assinatura', 'assinado', 'aguardando_aporte', 'ativo', 'vencido', 'liquidado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_lead" AS ENUM('novo', 'contatado', 'reuniao_marcada', 'em_onboarding', 'convertido', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."status_resgate" AS ENUM('solicitado', 'aprovado', 'pago', 'recusado');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"ator_id" integer,
	"acao" varchar(64) NOT NULL,
	"entidade" varchar(64) NOT NULL,
	"entidade_id" integer,
	"dados" jsonb,
	"ip" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccbs" (
	"id" serial PRIMARY KEY NOT NULL,
	"oferta_id" integer NOT NULL,
	"codigo" varchar(64) NOT NULL,
	"setor" varchar(32) NOT NULL,
	"devedor_descricao" varchar(255) NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"garantia_tipo" varchar(128) NOT NULL,
	"garantia_valor_centavos" bigint,
	"vencimento" date NOT NULL,
	"situacao" varchar(32) DEFAULT 'adimplente' NOT NULL,
	"dias_atraso" integer DEFAULT 0 NOT NULL,
	"registro_ref" varchar(255),
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"investidor_id" integer NOT NULL,
	"oferta_id" integer NOT NULL,
	"principal_centavos" bigint NOT NULL,
	"taxa_mensal" numeric(8, 6) NOT NULL,
	"prazo_meses" integer NOT NULL,
	"status" "status_contrato" DEFAULT 'rascunho' NOT NULL,
	"assinatura_provedor" varchar(32),
	"assinatura_ref" varchar(255),
	"inicio" date,
	"vencimento" date,
	"comprovante_aporte_chave" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"escopo" varchar(32) NOT NULL,
	"escopo_id" integer,
	"tipo" varchar(64) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"tamanho_bytes" integer,
	"publicado_por" integer,
	"publicado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investidores" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"kyc" "kyc_status" DEFAULT 'pendente' NOT NULL,
	"kyc_provedor_ref" varchar(255),
	"suitability" "perfil_suitability" DEFAULT 'nao_avaliado' NOT NULL,
	"suitability_respostas" jsonb,
	"suitability_em" timestamp with time zone,
	"ppe" boolean DEFAULT false NOT NULL,
	"assessor_id" integer,
	"trilha_concluida_em" timestamp with time zone,
	"lembrete_trilha_enviado_em" timestamp with time zone,
	"interesse_aporte_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telefone" varchar(32) NOT NULL,
	"faixa_patrimonio" varchar(64),
	"status" "status_lead" DEFAULT 'novo' NOT NULL,
	"origem" varchar(64),
	"utm" jsonb,
	"consentimento_lgpd" boolean NOT NULL,
	"consentimento_texto" text NOT NULL,
	"simulacao" jsonb,
	"notas" text,
	"assessor_id" integer,
	"lembrete_enviado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "links_acesso" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"ip" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ofertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descricao" text,
	"faixas" jsonb NOT NULL,
	"carencia_principal_dias" integer DEFAULT 60 NOT NULL,
	"prazo_resgate_dias" integer DEFAULT 7 NOT NULL,
	"ativa" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pecas_comunicacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"canal" varchar(32) NOT NULL,
	"texto" text NOT NULL,
	"resultado_guard" jsonb NOT NULL,
	"criado_por" integer,
	"aprovado_juridico_por" varchar(255),
	"aprovado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progresso_trilha" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"modulo_slug" varchar(64) NOT NULL,
	"acertos" integer NOT NULL,
	"total" integer NOT NULL,
	"concluido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resgates_rendimento" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"ir_retido_centavos" bigint DEFAULT 0 NOT NULL,
	"status" "status_resgate" DEFAULT 'solicitado' NOT NULL,
	"solicitado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"previsto_para" date NOT NULL,
	"pago_em" timestamp with time zone,
	"idempotency_key" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"nome" varchar(255),
	"telefone" varchar(32),
	"papel" "papel" DEFAULT 'investidor' NOT NULL,
	"google_sub" varchar(255),
	"versao_sessao" integer DEFAULT 1 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_login_em" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ccbs" ADD CONSTRAINT "ccbs_oferta_id_ofertas_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contratos" ADD CONSTRAINT "contratos_investidor_id_investidores_id_fk" FOREIGN KEY ("investidor_id") REFERENCES "public"."investidores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contratos" ADD CONSTRAINT "contratos_oferta_id_ofertas_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentos" ADD CONSTRAINT "documentos_publicado_por_usuarios_id_fk" FOREIGN KEY ("publicado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investidores" ADD CONSTRAINT "investidores_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investidores" ADD CONSTRAINT "investidores_assessor_id_usuarios_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_assessor_id_usuarios_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pecas_comunicacao" ADD CONSTRAINT "pecas_comunicacao_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "progresso_trilha" ADD CONSTRAINT "progresso_trilha_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resgates_rendimento" ADD CONSTRAINT "resgates_rendimento_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ccbs_codigo_idx" ON "ccbs" USING btree ("oferta_id","codigo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contratos_investidor_idx" ON "contratos" USING btree ("investidor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documentos_escopo_idx" ON "documentos" USING btree ("escopo","escopo_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "investidores_usuario_idx" ON "investidores" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "links_acesso_token_idx" ON "links_acesso" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "progresso_trilha_unico" ON "progresso_trilha" USING btree ("usuario_id","modulo_slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resgates_idempotency_idx" ON "resgates_rendimento" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_idx" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_google_idx" ON "usuarios" USING btree ("google_sub");