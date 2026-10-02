/**
 * Cadastro do investidor: grava com dados sensíveis cifrados e monta a
 * qualificação que fica congelada no contrato.
 */
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "./db";
import { cadastros, type Cadastro } from "./schema";
import { cifrar, decifrar, decifrarOpcional, hashDocumento } from "./cripto";
import { mascararCpf, soDigitos, type DadosCadastro } from "../shared/cadastro";

export async function getCadastro(investidorId: number): Promise<Cadastro | null> {
  const [c] = await db.select().from(cadastros).where(eq(cadastros.investidorId, investidorId)).limit(1);
  return c ?? null;
}

export async function salvarCadastro(investidorId: number, d: DadosCadastro): Promise<Cadastro> {
  const cpf = soDigitos(d.cpf);
  const cpfHash = hashDocumento(cpf);

  const [outro] = await db.select({ inv: cadastros.investidorId }).from(cadastros).where(eq(cadastros.cpfHash, cpfHash)).limit(1);
  if (outro && outro.inv !== investidorId) {
    throw new TRPCError({ code: "CONFLICT", message: "Este CPF já está vinculado a outra conta. Fale com a equipe." });
  }

  const contaLimpa = d.conta.replace(/\s/g, "").toUpperCase();
  const valores = {
    investidorId,
    nomeCompleto: d.nomeCompleto,
    cpfCifrado: cifrar(cpf),
    cpfHash,
    cpfFinal: cpf.slice(-4),
    dataNascimento: d.dataNascimento,
    rgCifrado: d.rg ? cifrar(d.rg) : null,
    rgOrgao: d.rgOrgao || null,
    nacionalidade: d.nacionalidade,
    estadoCivil: d.estadoCivil,
    profissao: d.profissao,
    telefone: d.telefone,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento || null,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    faixaRenda: d.faixaRenda,
    faixaPatrimonio: d.faixaPatrimonio,
    origemRecursos: d.origemRecursos,
    ppe: d.ppe,
    bancoCodigo: d.bancoCodigo.padStart(3, "0"),
    bancoNome: d.bancoNome,
    agencia: d.agencia,
    contaCifrada: cifrar(contaLimpa),
    contaFinal: soDigitos(contaLimpa).slice(-4),
    contaTipo: d.contaTipo,
    pixCifrado: d.pix ? cifrar(d.pix) : null,
    declaracaoVeracidadeEm: new Date(),
    atualizadoEm: new Date(),
  };

  const [salvo] = await db
    .insert(cadastros)
    .values(valores)
    .onConflictDoUpdate({ target: cadastros.investidorId, set: valores })
    .returning();
  return salvo!;
}

/** Visão completa (dados decifrados). Só para o próprio investidor e para o admin, sempre auditado. */
export function cadastroRevelado(c: Cadastro) {
  return {
    nomeCompleto: c.nomeCompleto,
    cpf: decifrar(c.cpfCifrado),
    dataNascimento: c.dataNascimento,
    rg: decifrarOpcional(c.rgCifrado) ?? "",
    rgOrgao: c.rgOrgao ?? "",
    nacionalidade: c.nacionalidade,
    estadoCivil: c.estadoCivil,
    profissao: c.profissao,
    telefone: c.telefone,
    cep: c.cep,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento ?? "",
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    faixaRenda: c.faixaRenda,
    faixaPatrimonio: c.faixaPatrimonio,
    origemRecursos: c.origemRecursos,
    ppe: c.ppe,
    bancoCodigo: c.bancoCodigo,
    bancoNome: c.bancoNome,
    agencia: c.agencia,
    conta: decifrar(c.contaCifrada),
    contaTipo: c.contaTipo,
    pix: decifrarOpcional(c.pixCifrado) ?? "",
    atualizadoEm: c.atualizadoEm,
  };
}

export type Qualificacao = {
  nomeCompleto: string;
  cpfMascarado: string;
  dataNascimento: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  endereco: string;
  ppe: boolean;
  contaResgate: string;
  capturadaEm: string;
};

/**
 * Qualificação congelada no contrato. Guarda CPF e conta mascarados; o número
 * completo continua só no cadastro cifrado.
 */
export function qualificacaoDoCadastro(c: Cadastro): Qualificacao {
  const cep = c.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return {
    nomeCompleto: c.nomeCompleto,
    cpfMascarado: mascararCpf(c.cpfFinal),
    dataNascimento: c.dataNascimento,
    nacionalidade: c.nacionalidade,
    estadoCivil: c.estadoCivil,
    profissao: c.profissao,
    endereco: `${c.logradouro}, ${c.numero}${c.complemento ? `, ${c.complemento}` : ""}, ${c.bairro}, ${c.cidade}/${c.uf}, CEP ${cep}`,
    ppe: c.ppe,
    contaResgate: `${c.bancoNome} (${c.bancoCodigo}), ag. ${c.agencia}, conta ${c.contaTipo} final ${c.contaFinal}`,
    capturadaEm: new Date().toISOString(),
  };
}
