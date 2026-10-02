/**
 * Cadastro do investidor pessoa física. Mesmas regras no navegador e no
 * servidor (zod). O servidor é quem decide; o cliente só antecipa o erro.
 */
import { z } from "zod";

export const ESTADOS_CIVIS = ["solteiro(a)", "casado(a)", "união estável", "divorciado(a)", "separado(a)", "viúvo(a)"] as const;
export const FAIXAS_RENDA = ["Até R$ 5 mil", "R$ 5 mil a R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "Acima de R$ 50 mil"] as const;
export const FAIXAS_PATRIMONIO = ["Até R$ 100 mil", "R$ 100 mil a R$ 500 mil", "R$ 500 mil a R$ 1 mi", "R$ 1 mi a R$ 5 mi", "Acima de R$ 5 mi"] as const;
export const TIPOS_CONTA = ["corrente", "poupança", "pagamento"] as const;
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Valida CPF pelos dígitos verificadores (rejeita sequências repetidas). */
export function cpfValido(entrada: string): boolean {
  const c = soDigitos(entrada);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

export const formatarCpf = (v: string) => soDigitos(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
/** "***.***.*89-01": mostra só os 4 últimos dígitos. */
export const mascararCpf = (final4: string) => `***.***.*${final4.slice(0, 2)}-${final4.slice(2)}`;

export function idadeEm(dataIso: string, hoje = new Date()): number {
  const n = new Date(dataIso + "T12:00:00Z");
  let idade = hoje.getUTCFullYear() - n.getUTCFullYear();
  const m = hoje.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < n.getUTCDate())) idade--;
  return idade;
}

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const esquemaCadastro = z.object({
  nomeCompleto: texto(5, 255).refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  cpf: z.string().refine(cpfValido, "CPF inválido"),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .refine((v) => idadeEm(v) >= 18, "É preciso ter 18 anos ou mais")
    .refine((v) => idadeEm(v) <= 120, "Data inválida"),
  rg: texto(4, 20).optional().or(z.literal("")),
  rgOrgao: texto(2, 32).optional().or(z.literal("")),
  nacionalidade: texto(3, 64).default("brasileira"),
  estadoCivil: z.enum(ESTADOS_CIVIS),
  profissao: texto(2, 128),
  telefone: z.string().transform(soDigitos).pipe(z.string().regex(/^\d{10,11}$/, "Telefone com DDD")),
  cep: z.string().transform(soDigitos).pipe(z.string().length(8, "CEP com 8 dígitos")),
  logradouro: texto(3, 255),
  numero: texto(1, 32),
  complemento: z.string().trim().max(128).optional(),
  bairro: texto(2, 128),
  cidade: texto(2, 128),
  uf: z.enum(UFS),
  faixaRenda: z.enum(FAIXAS_RENDA),
  faixaPatrimonio: z.enum(FAIXAS_PATRIMONIO),
  origemRecursos: texto(3, 255),
  ppe: z.boolean(),
  bancoCodigo: z.string().transform(soDigitos).pipe(z.string().min(3).max(4)),
  bancoNome: texto(2, 128),
  agencia: z.string().transform(soDigitos).pipe(z.string().min(3).max(6)),
  conta: z.string().trim().regex(/^[0-9]{3,15}-?[0-9xX]?$/, "Conta inválida (números e dígito)"),
  contaTipo: z.enum(TIPOS_CONTA),
  pix: z.string().trim().max(140).optional(),
  declaracao: z.literal(true, { errorMap: () => ({ message: "Confirme a declaração" }) }),
});

export type EntradaCadastro = z.input<typeof esquemaCadastro>;
export type DadosCadastro = z.output<typeof esquemaCadastro>;

/** Bancos mais comuns para o seletor. Outros podem ser digitados. */
export const BANCOS = [
  ["001", "Banco do Brasil"],
  ["033", "Santander"],
  ["077", "Inter"],
  ["104", "Caixa Econômica Federal"],
  ["208", "BTG Pactual"],
  ["237", "Bradesco"],
  ["260", "Nubank"],
  ["290", "PagBank"],
  ["323", "Mercado Pago"],
  ["336", "C6 Bank"],
  ["341", "Itaú"],
  ["748", "Sicredi"],
  ["756", "Sicoob"],
] as const;
