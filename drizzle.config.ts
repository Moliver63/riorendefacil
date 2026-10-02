import type { Config } from "drizzle-kit";

// Use apenas `drizzle-kit generate` para gerar SQL e revisar.
// Nunca `drizzle-kit push` contra produção.
export default {
  schema: "./server/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
} satisfies Config;
