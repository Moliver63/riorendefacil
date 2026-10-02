/**
 * Variáveis de ambiente, lidas uma vez. Em produção, a ausência de um segredo
 * obrigatório derruba o boot com mensagem clara, em vez de cair num valor
 * padrão escrito no código (falha encontrada na Shadia).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

function segredo(nome: string): string {
  const v = process.env[nome] ?? "";
  if (v.length >= 32) return v;
  if (isProduction) {
    throw new Error(`[env] ${nome} ausente ou curto (mínimo 32 caracteres). Configure no Render antes de subir.`);
  }
  if (!isTest) console.warn(`[env] ${nome} não configurado: usando segredo temporário (sessões caem a cada reinício).`);
  return randomBytes(32).toString("hex");
}

function lista(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const ENV = {
  isProduction,
  isTest,
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, ""),

  databaseUrl: process.env.DATABASE_URL ?? "",
  /** pasta do PGlite quando não há DATABASE_URL (só desenvolvimento) */
  pgliteDir: process.env.PGLITE_DIR ?? ".data/pglite",

  sessionSecret: segredo("SESSION_SECRET"),
  /** chave dos dados pessoais cifrados (CPF, conta). Ver server/cripto.ts */
  dadosSecret: process.env.DADOS_SECRET ?? "",
  /** e-mails que viram admin automaticamente no primeiro login */
  adminEmails: lista(process.env.ADMIN_EMAILS),

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** opcional: força a URL de retorno (padrão: {APP_URL}/api/auth/google/callback) */
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "",

  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailRemetente: process.env.EMAIL_REMETENTE ?? "RioRendeFácil <contato@riorendefacil.com.br>",
  /** quem recebe aviso de lead novo (assessores) */
  emailsAssessores: lista(process.env.EMAILS_ASSESSORES),

  cronSecret: process.env.CRON_SECRET ?? "",

  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
  },
};

export const googleConfigurado = () => Boolean(ENV.googleClientId && ENV.googleClientSecret);
export const r2Configurado = () =>
  Boolean(ENV.r2.accountId && ENV.r2.accessKeyId && ENV.r2.secretAccessKey && ENV.r2.bucket);
