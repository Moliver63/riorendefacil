/**
 * Questionário de perfil (suitability) simplificado. A versão final deve ser
 * validada com o emissor e o jurídico; o resultado é registrado com as
 * respostas e a data, para auditoria.
 */

export type QuestaoSuitability = {
  id: string;
  enunciado: string;
  opcoes: { texto: string; pontos: number }[];
};

export const QUESTOES_SUITABILITY: QuestaoSuitability[] = [
  {
    id: "objetivo",
    enunciado: "Qual o principal objetivo com este dinheiro?",
    opcoes: [
      { texto: "Preservar o valor, sem correr risco de perda", pontos: 0 },
      { texto: "Ganhar acima da renda fixa tradicional, aceitando algum risco", pontos: 2 },
      { texto: "Buscar retorno alto, aceitando perdas relevantes", pontos: 3 },
    ],
  },
  {
    id: "prazo",
    enunciado: "Por quanto tempo você pode deixar o valor aplicado sem precisar dele?",
    opcoes: [
      { texto: "Menos de 6 meses", pontos: 0 },
      { texto: "De 6 meses a 2 anos", pontos: 2 },
      { texto: "Mais de 2 anos", pontos: 3 },
    ],
  },
  {
    id: "reserva",
    enunciado: "Você tem reserva de emergência separada deste valor?",
    opcoes: [
      { texto: "Não", pontos: 0 },
      { texto: "Sim, para menos de 6 meses de gastos", pontos: 1 },
      { texto: "Sim, para 6 meses ou mais", pontos: 3 },
    ],
  },
  {
    id: "experiencia",
    enunciado: "Já investiu em crédito privado (CCB, CRI, CRA, debêntures)?",
    opcoes: [
      { texto: "Nunca", pontos: 0 },
      { texto: "Algumas vezes", pontos: 2 },
      { texto: "Com frequência", pontos: 3 },
    ],
  },
  {
    id: "perda",
    enunciado: "Se o investimento tivesse uma perda temporária de 10%, você:",
    opcoes: [
      { texto: "Resgataria tudo assim que pudesse", pontos: 0 },
      { texto: "Manteria e acompanharia", pontos: 2 },
      { texto: "Manteria e consideraria aportar mais", pontos: 3 },
    ],
  },
];

export type PerfilSuitability = "conservador" | "moderado" | "arrojado";

export function calcularPerfil(respostas: Record<string, number>): {
  perfil: PerfilSuitability;
  pontos: number;
  adequado: boolean;
  motivo: string | null;
} {
  let pontos = 0;
  for (const q of QUESTOES_SUITABILITY) {
    const i = respostas[q.id];
    if (i === undefined || !q.opcoes[i]) throw new Error(`Resposta ausente: ${q.id}`);
    pontos += q.opcoes[i]!.pontos;
  }
  const perfil: PerfilSuitability = pontos <= 5 ? "conservador" : pontos <= 10 ? "moderado" : "arrojado";

  // Bloqueios independentes da pontuação
  if (respostas.reserva === 0) {
    return { perfil, pontos, adequado: false, motivo: "Sem reserva de emergência, um investimento sem liquidez do principal não é adequado." };
  }
  if (respostas.prazo === 0) {
    return { perfil, pontos, adequado: false, motivo: "O principal fica travado pelo prazo do contrato. Prazo menor que 6 meses não combina com o produto." };
  }
  if (perfil === "conservador") {
    return { perfil, pontos, adequado: false, motivo: "Crédito privado sem FGC não é indicado para o perfil conservador." };
  }
  return { perfil, pontos, adequado: true, motivo: null };
}
