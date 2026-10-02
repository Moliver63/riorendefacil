CREATE TABLE IF NOT EXISTS "cadastros" (
	"id" serial PRIMARY KEY NOT NULL,
	"investidor_id" integer NOT NULL,
	"nome_completo" varchar(255) NOT NULL,
	"cpf_cifrado" text NOT NULL,
	"cpf_hash" varchar(64) NOT NULL,
	"cpf_final" varchar(4) NOT NULL,
	"data_nascimento" date NOT NULL,
	"rg_cifrado" text,
	"rg_orgao" varchar(32),
	"nacionalidade" varchar(64) DEFAULT 'brasileira' NOT NULL,
	"estado_civil" varchar(32) NOT NULL,
	"profissao" varchar(128) NOT NULL,
	"telefone" varchar(32) NOT NULL,
	"cep" varchar(8) NOT NULL,
	"logradouro" varchar(255) NOT NULL,
	"numero" varchar(32) NOT NULL,
	"complemento" varchar(128),
	"bairro" varchar(128) NOT NULL,
	"cidade" varchar(128) NOT NULL,
	"uf" varchar(2) NOT NULL,
	"faixa_renda" varchar(64) NOT NULL,
	"faixa_patrimonio" varchar(64) NOT NULL,
	"origem_recursos" varchar(255) NOT NULL,
	"ppe" boolean DEFAULT false NOT NULL,
	"banco_codigo" varchar(8) NOT NULL,
	"banco_nome" varchar(128) NOT NULL,
	"agencia" varchar(16) NOT NULL,
	"conta_cifrada" text NOT NULL,
	"conta_final" varchar(4) NOT NULL,
	"conta_tipo" varchar(16) NOT NULL,
	"pix_cifrado" text,
	"declaracao_veracidade_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "qualificacao" jsonb;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "criado_por" integer;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "assinado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "ativado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "cancelado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resgates_rendimento" ADD COLUMN "aprovado_por" integer;--> statement-breakpoint
ALTER TABLE "resgates_rendimento" ADD COLUMN "pago_por" integer;--> statement-breakpoint
ALTER TABLE "resgates_rendimento" ADD COLUMN "comprovante_chave" text;--> statement-breakpoint
ALTER TABLE "resgates_rendimento" ADD COLUMN "motivo_recusa" varchar(500);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cadastros" ADD CONSTRAINT "cadastros_investidor_id_investidores_id_fk" FOREIGN KEY ("investidor_id") REFERENCES "public"."investidores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_investidor_idx" ON "cadastros" USING btree ("investidor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_cpf_idx" ON "cadastros" USING btree ("cpf_hash");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contratos" ADD CONSTRAINT "contratos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resgates_rendimento" ADD CONSTRAINT "resgates_rendimento_aprovado_por_usuarios_id_fk" FOREIGN KEY ("aprovado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resgates_rendimento" ADD CONSTRAINT "resgates_rendimento_pago_por_usuarios_id_fk" FOREIGN KEY ("pago_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
