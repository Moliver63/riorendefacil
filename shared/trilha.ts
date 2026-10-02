/**
 * Trilha educativa "Antes de investir". Inspirada no learning path da Shadia,
 * com uma diferença: aqui a liberação é por conclusão, não por dia. Cada
 * módulo só abre quando o anterior foi concluído com acerto mínimo no quiz,
 * e a manifestação de interesse em aporte só abre com a trilha completa.
 */

export type Pergunta = {
  id: string;
  enunciado: string;
  opcoes: string[];
  /** índice da opção correta */
  correta: number;
  explicacao: string;
};

export type Modulo = {
  slug: string;
  titulo: string;
  minutos: number;
  paragrafos: string[];
  perguntas: Pergunta[];
};

export const ACERTO_MINIMO = 2 / 3;

export const TRILHA: Modulo[] = [
  {
    slug: "o-que-e-ccb",
    titulo: "Como funciona o lastro em grãos",
    minutos: 3,
    paragrafos: [
      "Seu aporte entra numa conta vinculada à oferta. Dali, o dinheiro só sai para comprar soja, milho ou sorgo à vista, direto do produtor rural, em operações aprovadas.",
      "O grão é transportado e vendido para cerealistas, cooperativas, indústrias ou tradings já analisados. A venda vira um recebível: um valor a receber, com data. Quando o comprador paga, o dinheiro volta para a conta vinculada e pode girar em outra operação.",
      "A sua remuneração é a taxa do contrato, não o lucro de cada operação. Do que entra na conta saem primeiro os custos, depois o seu principal e a sua remuneração. A margem da Rio vem por último.",
    ],
    perguntas: [
      {
        id: "ccb1",
        enunciado: "De onde vem o dinheiro que paga o investidor?",
        opcoes: ["Das vendas de grão recebidas na conta vinculada", "De um fundo garantido pelo governo", "Da valorização de ações"],
        correta: 0,
        explicacao: "Os compradores de grão pagam na conta vinculada, e é desse fluxo que saem principal e remuneração.",
      },
      {
        id: "ccb2",
        enunciado: "Na ordem de pagamentos, a margem da Rio vem:",
        opcoes: ["Antes do investidor", "Depois do principal e da remuneração do investidor", "Junto com os custos"],
        correta: 1,
        explicacao: "O investidor vem antes. O sistema bloqueia retirada de margem que passe na frente dele.",
      },
      {
        id: "ccb3",
        enunciado: "Durante o contrato, o mesmo dinheiro:",
        opcoes: ["Fica parado até o vencimento", "Pode girar em várias operações de compra e venda", "Vai para a conta da plataforma"],
        correta: 1,
        explicacao: "Cada ciclo de compra e venda leva semanas. O capital volta para a conta vinculada e pode financiar a próxima operação.",
      },
    ],
  },
  {
    slug: "riscos",
    titulo: "Os riscos, sem rodeio",
    minutos: 4,
    paragrafos: [
      "Risco de operação: o preço do grão pode cair entre a compra e a venda, e pode haver quebra de peso ou de qualidade no transporte. Isso aperta a margem e, em casos extremos, gera prejuízo na operação.",
      "Risco do comprador: quem comprou o grão pode atrasar ou não pagar. O recebível e as garantias em imóveis reduzem a perda, mas cobrar e executar uma garantia leva meses e pode não recuperar tudo.",
      "Não existe FGC aqui. O Fundo Garantidor de Créditos protege CDB e poupança até um limite, mas não cobre este investimento. A proteção vem da conta vinculada, do grão, do recebível e das garantias.",
      "Liquidez: o principal fica até o vencimento do contrato. Só o rendimento pode ser pedido antes. Não invista dinheiro de que você pode precisar de repente.",
    ],
    perguntas: [
      {
        id: "r1",
        enunciado: "Se a operação der problema, o FGC devolve meu dinheiro?",
        opcoes: ["Sim, até R$ 250 mil", "Não, este investimento não tem FGC", "Sim, integralmente"],
        correta: 1,
        explicacao: "Não há FGC. A proteção é a conta vinculada, o grão, o recebível e as garantias.",
      },
      {
        id: "r2",
        enunciado: "Posso resgatar o valor principal antes do vencimento?",
        opcoes: ["Sim, a qualquer momento", "Não, só o rendimento pode ser pedido antes", "Sim, pagando uma pequena multa"],
        correta: 1,
        explicacao: "O principal cumpre o prazo do contrato.",
      },
      {
        id: "r3",
        enunciado: "Uma garantia em imóvel significa que:",
        opcoes: ["Não há risco de perda", "A perda tende a ser menor, mas a recuperação leva tempo e pode ser parcial", "O rendimento é garantido"],
        correta: 1,
        explicacao: "Garantia reduz a perda esperada. Não zera o risco.",
      },
    ],
  },
  {
    slug: "como-ler-o-lastro",
    titulo: "Como ler operações e garantias",
    minutos: 3,
    paragrafos: [
      "Na ficha da oferta, cada operação aparece com grão, toneladas, origem, comprador, destino, valor de compra, valor de venda e situação: comprada, em transporte, vendida, recebida ou atrasada.",
      "As garantias são CCBs com imóvel. Só uma parte da avaliação conta como elegível, porque imóvel executado costuma valer menos. A cobertura é a soma das garantias elegíveis dividida pelo dinheiro captado. Uma cobertura de 150% quer dizer R$ 1,50 de garantia para cada R$ 1 investido.",
      "Se a cobertura cair abaixo do mínimo da oferta, normalmente 130%, novas captações e novas compras de grão param até a garantia ser recomposta. Atrasos aparecem na ficha com a data de vencimento. Mostramos porque transparência que esconde o problema não serve para nada.",
    ],
    perguntas: [
      {
        id: "l1",
        enunciado: "Com R$ 10 milhões captados e R$ 15 milhões de garantias elegíveis, a cobertura é:",
        opcoes: ["67%", "150%", "250%"],
        correta: 1,
        explicacao: "15 ÷ 10 = 1,5. Cada R$ 1 investido tem R$ 1,50 de garantia elegível.",
      },
      {
        id: "l2",
        enunciado: "Se a cobertura cair abaixo de 130%:",
        opcoes: ["Nada muda", "Novas captações e compras param até recompor a garantia", "O investidor perde o rendimento"],
        correta: 1,
        explicacao: "A trava protege quem já investiu: ninguém novo entra e nenhuma compra nova sai até a garantia voltar.",
      },
      {
        id: "l3",
        enunciado: "Uma operação \"atrasada\" na ficha quer dizer que:",
        opcoes: ["O investimento acabou", "O comprador passou do vencimento e a cobrança foi acionada", "É erro do sistema"],
        correta: 1,
        explicacao: "O atraso fica visível com a data. O recebível e as garantias seguem valendo.",
      },
    ],
  },
  {
    slug: "rendimento-e-ir",
    titulo: "Rendimento líquido e imposto",
    minutos: 3,
    paragrafos: [
      "O imposto de renda sobre renda fixa segue a tabela regressiva: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima disso, sempre sobre o rendimento, nunca sobre o principal.",
      "Por isso mostramos o valor líquido por padrão. Comparar o bruto de um investimento com a poupança, que é isenta, faz qualquer produto parecer melhor do que é.",
      "Rentabilidade simulada é uma projeção com as condições de hoje. Não é promessa: atrasos e inadimplência no pool reduzem o resultado.",
    ],
    perguntas: [
      {
        id: "i1",
        enunciado: "Em um contrato de 12 meses, a alíquota de IR é:",
        opcoes: ["22,5%", "17,5%", "15%"],
        correta: 1,
        explicacao: "12 meses são cerca de 365 dias, faixa de 361 a 720 dias: 17,5%.",
      },
      {
        id: "i2",
        enunciado: "Por que comparar sempre pelo líquido?",
        opcoes: ["Porque a poupança é isenta e o bruto distorce a comparação", "Porque o líquido é sempre maior", "Não faz diferença"],
        correta: 0,
        explicacao: "A comparação justa é o que chega na sua conta.",
      },
      {
        id: "i3",
        enunciado: "A rentabilidade do simulador é:",
        opcoes: ["Garantida em contrato", "Uma projeção que pode não se realizar", "O mínimo que vou receber"],
        correta: 1,
        explicacao: "Simulação não é garantia.",
      },
    ],
  },
];

export type EstadoModulo = {
  slug: string;
  titulo: string;
  minutos: number;
  liberado: boolean;
  concluido: boolean;
};

/** Calcula o estado de cada módulo a partir dos slugs concluídos. */
export function estadoTrilha(concluidos: string[]): { modulos: EstadoModulo[]; completa: boolean; proximo: string | null } {
  const feitos = new Set(concluidos);
  let anteriorConcluido = true;
  const modulos = TRILHA.map((m) => {
    const concluido = feitos.has(m.slug);
    const liberado = anteriorConcluido;
    anteriorConcluido = concluido;
    return { slug: m.slug, titulo: m.titulo, minutos: m.minutos, liberado, concluido };
  });
  const proximo = modulos.find((m) => m.liberado && !m.concluido)?.slug ?? null;
  return { modulos, completa: modulos.every((m) => m.concluido), proximo };
}

export function corrigir(modulo: Modulo, respostas: Record<string, number>) {
  const acertos = modulo.perguntas.filter((p) => respostas[p.id] === p.correta).length;
  const total = modulo.perguntas.length;
  return { acertos, total, aprovado: acertos / total >= ACERTO_MINIMO };
}

/** Versão pública do módulo, sem gabarito. */
export function moduloSemGabarito(m: Modulo) {
  return {
    ...m,
    perguntas: m.perguntas.map(({ id, enunciado, opcoes }) => ({ id, enunciado, opcoes })),
  };
}
