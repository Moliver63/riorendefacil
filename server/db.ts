/**
 * Conexão com o banco.
 * - Com DATABASE_URL: Postgres via `pg` (ajuste de SSL da Caro para o Render).
 * - Sem DATABASE_URL (desenvolvimento e testes): PGlite, um Postgres real
 *   rodando dentro do Node. Mesmo SQL, mesmas migrações, zero instalação.
 * Em produção, DATABASE_URL é obrigatória.
 */
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { migrate as migrateLite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";
import { ENV } from "./_core/env";
import { raizDoProjeto } from "./_core/raiz";

const pastaMigracoes = path.join(raizDoProjeto(), "drizzle");

/** Remove sslmode da URL: o driver trata require como verify-full e rejeita o certificado do Render. */
function urlSemSslMode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return url;
  }
}

function criarDb() {
  if (ENV.databaseUrl) {
    const pool = new pg.Pool({
      connectionString: urlSemSslMode(ENV.databaseUrl),
      ssl: /localhost|127\.0\.0\.1/.test(ENV.databaseUrl) ? false : { rejectUnauthorized: false },
      max: 10,
    });
    const db = drizzlePg(pool, { schema });
    return { db, tipo: "postgres" as const, migrar: () => migratePg(db, { migrationsFolder: pastaMigracoes }) };
  }
  if (ENV.isProduction) {
    throw new Error("[db] DATABASE_URL é obrigatória em produção.");
  }
  const cliente = new PGlite(ENV.isTest ? undefined : ENV.pgliteDir);
  const db = drizzleLite(cliente, { schema });
  return { db, tipo: "pglite" as const, migrar: () => migrateLite(db, { migrationsFolder: pastaMigracoes }) };
}

const conexao = criarDb();

/**
 * Tipo comum aos dois drivers. O PGlite e o node-postgres expõem a mesma API
 * do Drizzle; o cast evita uniões de tipo em cada consulta.
 */
export const db = conexao.db as unknown as ReturnType<typeof drizzlePg<typeof schema>>;
export const tipoBanco = conexao.tipo;

/** Erros de rede em que vale tentar de novo (banco reiniciando, acordando ou ainda subindo). */
const ERROS_TRANSITORIOS = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "57P03"]);

export function erroTransitorio(e: unknown): boolean {
  const codigo = (e as { code?: string })?.code;
  if (codigo && ERROS_TRANSITORIOS.has(codigo)) return true;
  const causa = (e as { cause?: unknown })?.cause;
  return causa ? erroTransitorio(causa) : false;
}

/** Explica em português o que fazer quando o banco não responde. */
export function diagnosticoBanco(e: unknown): string {
  const codigo = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  switch (codigo) {
    case "ECONNREFUSED":
      return "O endereço do banco respondeu, mas o Postgres recusou a conexão. No Render: confira se o banco está Available (não suspenso nem expirado), se está na mesma região do web service e se DATABASE_URL é a Internal Database URL do banco atual.";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "O nome do host do banco não existe. DATABASE_URL provavelmente aponta para um banco apagado: copie a Internal Database URL do banco atual pelo botão de copiar.";
    case "28P01":
      return "Usuário ou senha do banco incorretos. Cole de novo a Internal Database URL pelo botão de copiar, sem digitar.";
    case "ETIMEDOUT":
      return "O banco não respondeu a tempo. Confira se banco e web service estão na mesma região do Render.";
    default:
      return "Verifique DATABASE_URL e o status do Postgres no painel do Render.";
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tenta migrar algumas vezes com espera crescente antes de desistir (cerca de 1 minuto no total). */
async function migrarComTentativas(tentativas = 6, esperaInicialMs = 2000): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await conexao.migrar();
      return;
    } catch (e) {
      if (conexao.tipo !== "postgres" || !erroTransitorio(e) || i >= tentativas) {
        if (conexao.tipo === "postgres") console.error(`[db] banco indisponível: ${diagnosticoBanco(e)}`);
        throw e;
      }
      const ms = Math.min(esperaInicialMs * 2 ** (i - 1), 20_000);
      console.warn(`[db] banco não respondeu (${(e as { code?: string })?.code ?? "erro de rede"}), tentativa ${i}/${tentativas}; nova tentativa em ${ms / 1000}s`);
      await esperar(ms);
    }
  }
}

let migrado: Promise<void> | null = null;
/** Aplica migrações pendentes uma única vez por processo. */
export function aplicarMigracoes(): Promise<void> {
  if (!migrado) {
    migrado = migrarComTentativas().then(() => {
      if (!ENV.isTest) console.log(`[db] migrações aplicadas (${conexao.tipo})`);
    });
  }
  return migrado;
}

// ─── Funções de acesso a dados (padrão MecProAI: named exports em db.ts) ────
// Consultas usadas em mais de um lugar ficam aqui. Consultas específicas de um
// router podem ficar no próprio router.

export async function getUserById(id: number) {
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.id, id)).limit(1);
  return u ?? null;
}

export async function getUserByEmail(email: string) {
  const [u] = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, email.trim().toLowerCase())).limit(1);
  return u ?? null;
}

/** Cadastro de investidor do usuário; cria se ainda não existir. */
export async function getOrCreateInvestidor(usuarioId: number) {
  const [inv] = await db.select().from(schema.investidores).where(eq(schema.investidores.usuarioId, usuarioId)).limit(1);
  if (inv) return inv;
  await db.insert(schema.investidores).values({ usuarioId }).onConflictDoNothing();
  const [criado] = await db.select().from(schema.investidores).where(eq(schema.investidores.usuarioId, usuarioId)).limit(1);
  return criado!;
}

export async function getOfertaAtiva() {
  const [o] = await db.select().from(schema.ofertas).where(eq(schema.ofertas.ativa, true)).orderBy(desc(schema.ofertas.criadoEm)).limit(1);
  return o ?? null;
}
