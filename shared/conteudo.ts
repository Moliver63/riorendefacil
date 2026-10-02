/**
 * Artigos educativos públicos (SEO). Texto próprio, sem promessa de retorno.
 * Cada artigo passa pelo revisor de comunicação nos testes.
 */

export type Artigo = {
  slug: string;
  titulo: string;
  resumo: string;
  publicadoEm: string;
  minutos: number;
  secoes: { titulo?: string; paragrafos: string[] }[];
};

export const ARTIGOS: Artigo[] = [
  {
    slug: "o-que-e-ccb",
    titulo: "O que é CCB e como ela funciona como investimento",
    resumo: "Cédula de Crédito Bancário explicada sem jargão: quem emite, de onde vem o rendimento e o que acontece se o devedor não paga.",
    publicadoEm: "2026-10-02",
    minutos: 5,
    secoes: [
      {
        paragrafos: [
          "CCB é a sigla de Cédula de Crédito Bancário. É um documento em que uma empresa reconhece que deve um valor e se compromete a pagá-lo com juros, em datas definidas.",
          "Para quem investe, a CCB é uma forma de emprestar para empresas da economia real recebendo os juros que elas pagam. Em troca de um rendimento maior que o da renda fixa tradicional, o investidor assume o risco de o devedor atrasar ou não pagar.",
        ],
      },
      {
        titulo: "Por que a CCB tem força jurídica",
        paragrafos: [
          "A CCB é título executivo extrajudicial. Se a dívida não é paga, o credor pode ir direto para a execução, sem precisar primeiro provar que a dívida existe. Isso encurta o caminho da cobrança.",
          "Encurtar não é eliminar. Uma execução ainda leva meses e depende de haver bens ou garantias para cobrir o valor.",
        ],
      },
      {
        titulo: "O papel da garantia",
        paragrafos: [
          "Boa parte das CCBs tem garantia real: um imóvel em alienação fiduciária, uma safra, recebíveis de vendas. A garantia não impede o calote, mas reduz a perda quando ele acontece.",
          "Um bom indicador é o LTV, a relação entre o valor da dívida e o valor da garantia. Quanto menor, maior a folga.",
        ],
      },
    ],
  },
  {
    slug: "investimento-sem-fgc",
    titulo: "Investimento sem FGC: o que muda na prática",
    resumo: "CCB estruturada não tem cobertura do Fundo Garantidor de Créditos. Entenda o que protege o investidor nesse caso e o que não protege.",
    publicadoEm: "2026-10-02",
    minutos: 4,
    secoes: [
      {
        paragrafos: [
          "O FGC é um fundo privado que devolve até um limite por CPF quando um banco quebra. Ele cobre CDB, LCI, LCA e poupança. Não cobre CCB estruturada, CRI, CRA nem debêntures.",
          "Isso não torna o investimento ilegal nem necessariamente pior. Torna diferente: a proteção não vem de um seguro do sistema, vem da estrutura da operação.",
        ],
      },
      {
        titulo: "O que protege no lugar do FGC",
        paragrafos: [
          "Garantias reais vinculadas a cada crédito, diversificação entre vários devedores, conta vinculada que separa o dinheiro do caixa do emissor e auditoria independente.",
          "Nenhum desses mecanismos zera o risco. Vale olhar cada um com atenção antes de investir: quem é o custodiante, quem audita, qual o LTV médio do pool e quantos créditos estão em atraso hoje.",
        ],
      },
    ],
  },
  {
    slug: "como-ler-o-ltv",
    titulo: "LTV: o número que mostra a folga de uma garantia",
    resumo: "Como calcular e interpretar o LTV de uma operação de crédito com garantia, com exemplos simples.",
    publicadoEm: "2026-10-02",
    minutos: 3,
    secoes: [
      {
        paragrafos: [
          "LTV vem do inglês loan to value: o valor do empréstimo dividido pelo valor da garantia. Uma dívida de R$ 500 mil com um imóvel de R$ 1 milhão como garantia tem LTV de 50%.",
          "Quanto menor o LTV, maior a margem para absorver queda no valor da garantia e custos de execução. Em operações imobiliárias, LTVs abaixo de 60% costumam ser vistos como conservadores.",
        ],
      },
      {
        titulo: "O que o LTV não mostra",
        paragrafos: [
          "O LTV usa o valor de avaliação da garantia, que pode estar otimista. Também não mostra liquidez: um imóvel em cidade pequena pode demorar a ser vendido.",
          "Por isso, além do LTV, vale ver quem fez o laudo, quando ele foi feito e o tipo de garantia.",
        ],
      },
    ],
  },
  {
    slug: "conta-vinculada",
    titulo: "Conta vinculada: por que o dinheiro não passa pelo caixa de ninguém",
    resumo: "Como a conta de garantia separa os recursos dos investidores do caixa do emissor e da plataforma.",
    publicadoEm: "2026-10-02",
    minutos: 3,
    secoes: [
      {
        paragrafos: [
          "Conta vinculada, ou conta escrow, é uma conta em nome da operação, movimentada por um administrador independente segundo regras definidas em contrato.",
          "O aporte do investidor e os pagamentos dos devedores transitam por ela. Isso evita que o dinheiro se misture ao caixa operacional de quem estrutura a operação.",
          "No RioRendeFácil, nenhum valor passa pela plataforma. Registramos e mostramos as movimentações; quem liquida é a conta vinculada do emissor.",
        ],
      },
    ],
  },
];

export function artigoPorSlug(slug: string): Artigo | undefined {
  return ARTIGOS.find((a) => a.slug === slug);
}
