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
    titulo: "O que é uma CCB",
    minutos: 3,
    paragrafos: [
      "A Cédula de Crédito Bancário é um título em que uma empresa reconhece uma dívida e se compromete a pagá-la com juros, em datas definidas. Ela é emitida a favor de uma instituição e depois pode ser cedida para investidores.",
      "O ponto forte da CCB é jurídico: ela é título executivo extrajudicial. Se o devedor não paga, a cobrança vai direto para a execução, sem precisar provar a dívida num processo longo.",
      "Quando você investe aqui, não empresta dinheiro para uma empresa só. Seu aporte vira participação num conjunto de CCBs, o pool, e o rendimento vem dos juros pagos por todos os devedores desse conjunto.",
    ],
    perguntas: [
      {
        id: "ccb1",
        enunciado: "De onde vem o rendimento de quem investe no pool?",
        opcoes: ["Dos juros pagos pelos devedores das CCBs", "De um fundo garantido pelo governo", "Da valorização de ações"],
        correta: 0,
        explicacao: "O rendimento é o juro que as empresas devedoras pagam. Se elas não pagam, o rendimento é afetado.",
      },
      {
        id: "ccb2",
        enunciado: "O que significa a CCB ser título executivo?",
        opcoes: ["Que ela tem garantia do FGC", "Que a cobrança judicial é mais direta se houver calote", "Que ela rende mais que o CDI"],
        correta: 1,
        explicacao: "Título executivo acelera a cobrança. Não elimina o risco nem garante rentabilidade.",
      },
      {
        id: "ccb3",
        enunciado: "Investir no pool significa:",
        opcoes: ["Emprestar para uma única empresa", "Participar de um conjunto de várias CCBs", "Comprar cotas de um fundo listado em bolsa"],
        correta: 1,
        explicacao: "O pool distribui o risco entre vários devedores.",
      },
    ],
  },
  {
    slug: "riscos",
    titulo: "Os riscos, sem rodeio",
    minutos: 4,
    paragrafos: [
      "Risco de crédito é a chance de um devedor atrasar ou não pagar. As garantias reais, como imóveis e safra, reduzem a perda, mas executar uma garantia leva meses e o valor recuperado pode não cobrir tudo.",
      "Não existe FGC aqui. O Fundo Garantidor de Créditos protege CDB e poupança até um limite, mas não cobre CCB estruturada. A proteção vem das garantias e da diversificação, não de um seguro do sistema.",
      "Liquidez: o principal fica travado até o vencimento do contrato. Só o rendimento pode ser pedido antes, e o pagamento depende do fluxo do pool. Não invista dinheiro de que você pode precisar de repente.",
      "Concentração: o pool reúne vários devedores, mas de poucos setores. Uma crise no agro ou no imobiliário atinge vários créditos ao mesmo tempo.",
    ],
    perguntas: [
      {
        id: "r1",
        enunciado: "Se o emissor tiver problemas, o FGC devolve meu dinheiro?",
        opcoes: ["Sim, até R$ 250 mil", "Não, CCB estruturada não tem FGC", "Sim, integralmente"],
        correta: 1,
        explicacao: "Não há FGC. A proteção é a garantia real, a conta vinculada e a diversificação.",
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
        enunciado: "Uma garantia imobiliária significa que:",
        opcoes: ["Não há risco de perda", "A perda tende a ser menor, mas a recuperação leva tempo e pode ser parcial", "O rendimento é garantido"],
        correta: 1,
        explicacao: "Garantia reduz a perda esperada. Não zera o risco.",
      },
    ],
  },
  {
    slug: "como-ler-o-lastro",
    titulo: "Como ler o lastro no painel",
    minutos: 3,
    paragrafos: [
      "Cada CCB aparece no painel com setor, região, tipo de garantia, LTV e situação de pagamento.",
      "LTV é o valor do crédito dividido pelo valor da garantia. Um LTV de 50% quer dizer que a garantia vale o dobro da dívida. Quanto menor o LTV, maior a folga se for preciso executar.",
      "Atrasos aparecem com o número de dias. Um atraso isolado é absorvido pelo pool, mas vários atrasos ao mesmo tempo reduzem o resultado. Mostramos os atrasos porque transparência que esconde o problema não serve para nada.",
    ],
    perguntas: [
      {
        id: "l1",
        enunciado: "Uma CCB com LTV de 40% tem garantia que vale:",
        opcoes: ["40% da dívida", "Duas vezes e meia a dívida", "Exatamente a dívida"],
        correta: 1,
        explicacao: "Dívida / garantia = 0,4. A garantia vale 2,5 vezes a dívida.",
      },
      {
        id: "l2",
        enunciado: "Entre duas CCBs iguais, qual tem mais folga?",
        opcoes: ["A de LTV 70%", "A de LTV 45%", "Tanto faz"],
        correta: 1,
        explicacao: "LTV menor, garantia proporcionalmente maior.",
      },
      {
        id: "l3",
        enunciado: "Uma CCB em atraso no painel quer dizer que:",
        opcoes: ["O investimento acabou", "Um devedor está atrasado e a cobrança foi acionada", "É erro do sistema"],
        correta: 1,
        explicacao: "O atraso é mostrado com os dias. O emissor aciona a cobrança.",
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
