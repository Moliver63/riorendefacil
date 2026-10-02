import type { Config } from "drizzle-kit";

// Gera SQL de migração a partir de shared/schema.ts (sem precisar de banco).
// O servidor aplica as migrações no boot. NUNCA usar `drizzle-kit push`.
export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
} satisfies Config;
