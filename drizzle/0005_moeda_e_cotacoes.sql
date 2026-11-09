CREATE TABLE IF NOT EXISTS "cotacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"moeda" varchar(3) NOT NULL,
	"valor" numeric(12, 6) NOT NULL,
	"data" date NOT NULL,
	"fonte" varchar(120) NOT NULL,
	"registrado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "moeda" varchar(3) DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "numero_ccb" varchar(64);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cotacoes" ADD CONSTRAINT "cotacoes_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cotacoes_moeda_data_fonte_idx" ON "cotacoes" USING btree ("moeda","data","fonte");