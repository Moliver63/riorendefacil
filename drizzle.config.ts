import type { Config } from "drizzle-kit";

// Gera SQL de migração a partir de server/schema.ts (sem precisar de banco).
// O servidor aplica as migrações no boot. NUNCA usar `drizzle-kit push`.
export default {
  schema: "./server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
} satisfies Config;
