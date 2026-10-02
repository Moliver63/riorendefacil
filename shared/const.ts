/** Constantes compartilhadas entre cliente e servidor. */

export const NOME_MARCA = "RioRendeFácil";

export const COOKIE_SESSAO = "rrf_sessao";
export const COOKIE_OAUTH_STATE = "rrf_oauth_state";
export const SESSAO_DIAS = 7;

export const PAPEIS = ["investidor", "assessor", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const MSG_NAO_AUTENTICADO = "Entre na sua conta para continuar.";
export const MSG_SEM_PERMISSAO = "Você não tem permissão para acessar esta área.";

export const LINK_ACESSO_MINUTOS = 15;

export const STATUS_LEAD = [
  "novo",
  "contatado",
  "reuniao_marcada",
  "em_onboarding",
  "convertido",
  "descartado",
] as const;
export type StatusLead = (typeof STATUS_LEAD)[number];

export const STATUS_LEAD_ROTULO: Record<StatusLead, string> = {
  novo: "Novo",
  contatado: "Contatado",
  reuniao_marcada: "Reunião marcada",
  em_onboarding: "Em onboarding",
  convertido: "Convertido",
  descartado: "Descartado",
};

export const SETORES = ["agro", "imobiliario", "outro"] as const;
export const SITUACOES_CCB = ["adimplente", "atraso", "renegociada", "executada", "liquidada"] as const;
export type SituacaoCCB = (typeof SITUACOES_CCB)[number];
