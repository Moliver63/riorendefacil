ALTER TABLE "ccbs" ADD COLUMN "serie" varchar(32);--> statement-breakpoint
ALTER TABLE "ccbs" ADD COLUMN "data_emissao" date;--> statement-breakpoint
ALTER TABLE "ccbs" ADD COLUMN "valor_resgate_centavos" bigint;