CREATE TABLE IF NOT EXISTS "lancamentos_conta" (
	"id" serial PRIMARY KEY NOT NULL,
	"oferta_id" integer NOT NULL,
	"data" date NOT NULL,
	"tipo" varchar(24) NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"descricao" varchar(255) NOT NULL,
	"operacao_id" integer,
	"contrato_id" integer,
	"resgate_id" integer,
	"comprovante_chave" text,
	"criado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operacoes_graos" (
	"id" serial PRIMARY KEY NOT NULL,
	"oferta_id" integer NOT NULL,
	"codigo" varchar(32) NOT NULL,
	"grao" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'em_analise' NOT NULL,
	"produtor_descricao" varchar(255) NOT NULL,
	"origem_municipio" varchar(120) NOT NULL,
	"origem_uf" varchar(2) NOT NULL,
	"toneladas" numeric(12, 3) NOT NULL,
	"valor_compra_centavos" bigint NOT NULL,
	"custos_centavos" bigint DEFAULT 0 NOT NULL,
	"nf_compra" varchar(64),
	"data_compra" date,
	"transportadora" varchar(160),
	"destino_municipio" varchar(120),
	"destino_uf" varchar(2),
	"comprador_tipo" varchar(24),
	"comprador_descricao" varchar(255),
	"valor_venda_centavos" bigint,
	"nf_venda" varchar(64),
	"data_venda" date,
	"vencimento_recebimento" date,
	"valor_recebido_centavos" bigint DEFAULT 0 NOT NULL,
	"data_recebimento" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"investidor_id" integer NOT NULL,
	"oferta_id" integer NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"prazo_meses" integer NOT NULL,
	"taxa_mensal" numeric(8, 6) NOT NULL,
	"status" varchar(16) DEFAULT 'ativa' NOT NULL,
	"contrato_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ccbs" ADD COLUMN "valor_elegivel_centavos" bigint;--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "codigo" varchar(32);--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "tese" text;--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "cobertura_minima" numeric(6, 4) DEFAULT '1.3' NOT NULL;--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "captacao_alvo_centavos" bigint;--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "prazo_medio_ciclo_dias" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "ofertas" ADD COLUMN "reservas_ate" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lancamentos_conta" ADD CONSTRAINT "lancamentos_conta_oferta_id_ofertas_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lancamentos_conta" ADD CONSTRAINT "lancamentos_conta_operacao_id_operacoes_graos_id_fk" FOREIGN KEY ("operacao_id") REFERENCES "public"."operacoes_graos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lancamentos_conta" ADD CONSTRAINT "lancamentos_conta_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operacoes_graos" ADD CONSTRAINT "operacoes_graos_oferta_id_ofertas_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservas" ADD CONSTRAINT "reservas_investidor_id_investidores_id_fk" FOREIGN KEY ("investidor_id") REFERENCES "public"."investidores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reservas" ADD CONSTRAINT "reservas_oferta_id_ofertas_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."ofertas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lancamentos_conta_oferta_idx" ON "lancamentos_conta" USING btree ("oferta_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operacoes_graos_codigo_idx" ON "operacoes_graos" USING btree ("oferta_id","codigo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operacoes_graos_status_idx" ON "operacoes_graos" USING btree ("oferta_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservas_investidor_idx" ON "reservas" USING btree ("investidor_id","status");