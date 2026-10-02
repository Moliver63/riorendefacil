CREATE TABLE IF NOT EXISTS "depositos" (
	"id" serial PRIMARY KEY NOT NULL,
	"investidor_id" integer NOT NULL,
	"contrato_id" integer NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"data_deposito" date NOT NULL,
	"comprovante_chave" text,
	"status" varchar(16) DEFAULT 'informado' NOT NULL,
	"motivo_recusa" text,
	"confirmado_por" integer,
	"confirmado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resgates_principal" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"tipo" varchar(16) NOT NULL,
	"regra" varchar(255) NOT NULL,
	"dias_permanencia" integer NOT NULL,
	"principal_centavos" bigint NOT NULL,
	"rendimento_sacado_centavos" bigint NOT NULL,
	"bruto_centavos" bigint NOT NULL,
	"penalidade_centavos" bigint NOT NULL,
	"ir_centavos" bigint NOT NULL,
	"liquido_centavos" bigint NOT NULL,
	"previsto_para" date NOT NULL,
	"status" varchar(16) DEFAULT 'solicitado' NOT NULL,
	"motivo_recusa" text,
	"comprovante_chave" text,
	"solicitado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"pago_em" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "depositos" ADD CONSTRAINT "depositos_investidor_id_investidores_id_fk" FOREIGN KEY ("investidor_id") REFERENCES "public"."investidores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "depositos" ADD CONSTRAINT "depositos_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "depositos" ADD CONSTRAINT "depositos_confirmado_por_usuarios_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resgates_principal" ADD CONSTRAINT "resgates_principal_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "depositos_investidor_idx" ON "depositos" USING btree ("investidor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resgates_principal_contrato_idx" ON "resgates_principal" USING btree ("contrato_id");