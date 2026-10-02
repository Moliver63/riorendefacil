/**
 * Criptografia de dados pessoais em repouso (CPF, RG, conta, Pix).
 *
 * - AES-256-GCM com IV aleatório por valor; formato "v1:iv:tag:dado" (base64url).
 * - Chave: DADOS_SECRET (recomendado, separado da sessão). Sem ela, deriva uma
 *   chave do SESSION_SECRET via HKDF com rótulo próprio, para o sistema
 *   funcionar desde o primeiro deploy. Defina DADOS_SECRET antes de dados reais
 *   e nunca troque depois sem migrar (dados cifrados ficariam ilegíveis).
 * - HMAC-SHA256 do CPF para checar duplicidade sem guardar o número em claro.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

let chaves: { cifra: Buffer; hmac: Buffer } | null = null;
function obterChaves() {
  if (chaves) return chaves;
  const base = ENV.dadosSecret || ENV.sessionSecret;
  const sal = ENV.dadosSecret ? "rrf-dados" : "rrf-dados-derivada-da-sessao";
  chaves = {
    cifra: Buffer.from(hkdfSync("sha256", base, sal, "aes-256-gcm v1", 32)),
    hmac: Buffer.from(hkdfSync("sha256", base, sal, "hmac cpf v1", 32)),
  };
  return chaves;
}

export function cifrar(valor: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", obterChaves().cifra, iv);
  const dado = Buffer.concat([c.update(valor, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), dado.toString("base64url")].join(":");
}

export function decifrar(cifrado: string): string {
  const [versao, iv, tag, dado] = cifrado.split(":");
  if (versao !== "v1" || !iv || !tag || !dado) throw new Error("Formato de dado cifrado desconhecido");
  const d = createDecipheriv("aes-256-gcm", obterChaves().cifra, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dado, "base64url")), d.final()]).toString("utf8");
}

export const decifrarOpcional = (v: string | null | undefined) => (v ? decifrar(v) : null);

export function hashDocumento(digitos: string): string {
  return createHmac("sha256", obterChaves().hmac).update(digitos).digest("hex");
}
