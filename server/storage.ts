/**
 * Cofre de documentos no Cloudflare R2 (API compatível com S3, como a Shadia
 * usa com @aws-sdk). Arquivos nunca são públicos: o download sai por URL
 * assinada que expira em poucos minutos, gerada só para quem tem permissão.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV, r2Configurado } from "./_core/env";

let s3: S3Client | null = null;
function cliente(): S3Client {
  if (!r2Configurado()) throw new Error("Armazenamento de documentos não configurado (R2_*).");
  s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${ENV.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ENV.r2.accessKeyId, secretAccessKey: ENV.r2.secretAccessKey },
  });
  return s3;
}

const TIPOS_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg"];
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export function chaveDocumento(escopo: string, escopoId: number | null, nomeArquivo: string): string {
  const limpo = nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
  return `docs/${escopo}/${escopoId ?? "geral"}/${Date.now()}-${limpo}`;
}

export async function urlEnvio(chave: string, contentType: string, tamanho: number) {
  if (!TIPOS_PERMITIDOS.includes(contentType)) throw new Error("Tipo de arquivo não permitido. Use PDF, PNG ou JPG.");
  if (tamanho > TAMANHO_MAXIMO) throw new Error("Arquivo acima de 20 MB.");
  return getSignedUrl(
    cliente(),
    new PutObjectCommand({ Bucket: ENV.r2.bucket, Key: chave, ContentType: contentType, ContentLength: tamanho }),
    { expiresIn: 300 },
  );
}

export async function urlDownload(chave: string, nomeArquivo: string) {
  return getSignedUrl(
    cliente(),
    new GetObjectCommand({
      Bucket: ENV.r2.bucket,
      Key: chave,
      ResponseContentDisposition: `attachment; filename="${nomeArquivo.replace(/"/g, "")}"`,
    }),
    { expiresIn: 300 },
  );
}
