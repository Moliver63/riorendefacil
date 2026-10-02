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
    titulo: "Garantias e riscos, sem rodeio",
    minutos: 4,
    paragrafos: [
      "Não existe FGC aqui. O Fundo Garantidor de Créditos protege CDB e poupança até um limite, mas não cobre este investimento.",
      "Quem garante é a própria Rio, com contratos de CCB lastreados em imóveis. O dinheiro só circula pela conta vinculada da oferta, as cargas de grão têm seguro durante o transporte e, no vencimento, a Rio recompra os títulos do investidor.",
      "Garantia reduz o risco, não elimina. Se a Rio não conseguir honrar a recompra, os imóveis das CCBs são executados, e isso leva meses e pode não recuperar o valor inteiro. O seguro cobre a carga no transporte, não a queda de preço do grão nem o atraso de um comprador.",
      "Os contratos têm prazo de 12, 24 ou 36 meses. Os juros são creditados por dia e podem ser resgatados a qualquer momento, com pagamento em até 7 dias. O principal fica até o vencimento. Se precisar sair antes, o resgate antecipado leva até 60 dias e tem penalidade: até 12 meses você recebe só o principal; entre 12 e 24 meses, o principal corrigido pelo CDI; entre 24 e 36 meses, metade da performance acumulada. Não invista dinheiro de que você pode precisar de repente.",
    ],
    perguntas: [
      {
        id: "r1",
        enunciado: "Se a operação der problema, o FGC devolve meu dinheiro?",
        opcoes: ["Sim, até R$ 250 mil", "Não, este investimento não tem FGC", "Sim, integralmente"],
        correta: 1,
        explicacao: "Não há FGC. A proteção vem da garantia da Rio com CCBs lastreadas em imóveis, da conta vinculada e do seguro das cargas.",
      },
      {
        id: "r2",
        enunciado: "Quem garante o investimento?",
        opcoes: [
          "O Fundo Garantidor de Créditos",
          "A própria Rio, com CCBs lastreadas em imóveis, conta vinculada, seguro das cargas e recompra dos títulos",
          "Ninguém, o investidor fica sem nenhuma garantia",
        ],
        correta: 1,
        explicacao: "A garantia é da Rio. Ela reduz o risco, mas depende da capacidade da Rio de pagar e, no limite, da execução dos imóveis, que leva tempo.",
      },
      {
        id: "r3",
        enunciado: "Como funcionam os prazos e o principal?",
        opcoes: [
          "Saque do principal a qualquer momento, sem prazo",
          "Contratos de 12, 24 ou 36 meses; o principal volta no vencimento, com a recompra dos títulos pela Rio",
          "Prazo fixo de 3 meses, renovado automaticamente",
        ],
        correta: 1,
        explicacao: "Os juros podem ser resgatados a qualquer momento, em até 7 dias. Sair com o principal antes do prazo é possível em até 60 dias, com penalidade sobre a performance.",
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
