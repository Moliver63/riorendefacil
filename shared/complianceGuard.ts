/**
 * Guard de comunicação. Valida qualquer texto que vai para o público
 * (anúncios, landing, e-mails, WhatsApp) antes de ser publicado.
 *
 * Origem: Fact Guard do MecProAI, adaptado para produto de crédito.
 * Lições aplicadas:
 * - Nunca usar \b ao lado de vogal acentuada: o \b do JS trata "á", "é" etc.
 *   como não-palavra. Usamos fronteiras explícitas com lookahead/lookbehind.
 * - Padrões em literais de regex (/.../), nunca em template string com
 *   barra simples.
 *
 * Isto NÃO substitui revisão jurídica. É uma rede de segurança automática.
 */

const L = "a-zà-ÿ0-9"; // classe de caracteres de "palavra" em pt-BR
const INI = `(?<![${L}])`;
const FIM = `(?![${L}])`;

function termo(corpo: string): RegExp {
  return new RegExp(`${INI}(?:${corpo})${FIM}`, "iu");
}

export type Regra = {
  id: string;
  severidade: "bloqueia" | "alerta";
  padrao: RegExp;
  motivo: string;
};

export const REGRAS: Regra[] = [
  {
    id: "garantia_de_retorno",
    severidade: "bloqueia",
    padrao: termo(
      "(?:rentabilidade|rendimento|retorno|lucro|ganho)s?\\s+garantid[oa]s?|garantimos\\s+(?:o\\s+)?(?:rendimento|retorno|lucro)|retorno\\s+certo",
    ),
    motivo: "Promessa de retorno garantido. Crédito privado não tem garantia de rentabilidade.",
  },
  {
    id: "sem_risco",
    severidade: "bloqueia",
    padrao: termo("sem\\s+risco|risco\\s+zero|zero\\s+risco|livre\\s+de\\s+risco|100%\\s+segur[oa]"),
    motivo: "Afirma ausência de risco. Operações de crédito envolvem risco, inclusive de perda do capital.",
  },
  {
    id: "dinheiro_facil",
    severidade: "bloqueia",
    padrao: termo(
      "dinheiro\\s+f[aá]cil|ganhe\\s+f[aá]cil|lucro\\s+f[aá]cil|enrique[cç]a|fique\\s+rico|renda\\s+passiva\\s+garantida",
    ),
    motivo: "Linguagem de dinheiro fácil, associada a esquemas fraudulentos.",
  },
  {
    id: "rende_facil_fora_da_marca",
    severidade: "alerta",
    padrao: termo("rende\\s+f[aá]cil"),
    motivo:
      "\"Rende fácil\" usado como afirmação sobre o produto. Só é aceitável como nome da marca, nunca como promessa.",
  },
  {
    id: "fgc_indevido",
    severidade: "bloqueia",
    padrao: termo("garantid[oa]\\s+pelo\\s+fgc|com\\s+fgc|coberto\\s+pelo\\s+fgc"),
    motivo: "CCB estruturada não tem cobertura do FGC.",
  },
  {
    id: "urgencia_artificial",
    severidade: "alerta",
    padrao: termo("[uú]ltimas\\s+vagas|s[oó]\\s+hoje|corra|n[aã]o\\s+perca|por\\s+tempo\\s+limitado"),
    motivo: "Urgência artificial em produto de investimento. Evite pressionar a decisão.",
  },
  {
    id: "comparacao_bruta",
    severidade: "alerta",
    padrao: termo("rende\\s+mais\\s+que\\s+(?:a\\s+)?poupan[cç]a|bate\\s+(?:o\\s+)?cdi|melhor\\s+que\\s+(?:o\\s+)?cdi"),
    motivo:
      "Comparação com poupança/CDI deve informar base líquida de IR, prazo e que rentabilidade passada não garante futura.",
  },
  {
    id: "banco_indevido",
    severidade: "alerta",
    padrao: termo("somos\\s+um\\s+banco|nosso\\s+banco|banco\\s+digital"),
    motivo: "Só instituição autorizada pelo Banco Central pode se apresentar como banco.",
  },
];

export type Achado = {
  regra: string;
  severidade: Regra["severidade"];
  trecho: string;
  motivo: string;
};

export type ResultadoGuard = {
  aprovado: boolean;
  achados: Achado[];
  /** avisos que precisam acompanhar a peça quando ela fala de rentabilidade */
  avisosObrigatorios: string[];
};

export const AVISO_RISCO =
  "Operações de crédito envolvem risco, inclusive de perda do capital. Não há cobertura do FGC. Rentabilidade passada ou simulada não é garantia de rentabilidade futura.";

const FALA_DE_RENTABILIDADE = termo(
  "rend(?:e|imento|imentos)|rentabilidade|%\\s*a\\.?\\s*m|%\\s*ao\\s+m[eê]s|juros|retorno",
);

/**
 * @param texto peça de comunicação
 * @param nomeMarca nome oficial da marca, removido antes da checagem para não
 *        acusar o próprio nome do produto
 */
export function avaliarTexto(texto: string, nomeMarca = "RioRendeFácil"): ResultadoGuard {
  const variantesMarca = [nomeMarca, nomeMarca.replace("á", "a"), "rio rende fácil", "rio rende facil"];
  let limpo = texto;
  for (const v of variantesMarca) {
    limpo = limpo.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), " ");
  }

  const achados: Achado[] = [];
  for (const r of REGRAS) {
    const m = limpo.match(r.padrao);
    if (m) {
      achados.push({ regra: r.id, severidade: r.severidade, trecho: m[0], motivo: r.motivo });
    }
  }

  const avisosObrigatorios: string[] = [];
  if (FALA_DE_RENTABILIDADE.test(limpo) && !limpo.toLowerCase().includes("perda do capital")) {
    avisosObrigatorios.push(AVISO_RISCO);
  }

  return {
    aprovado: !achados.some((a) => a.severidade === "bloqueia"),
    achados,
    avisosObrigatorios,
  };
}
