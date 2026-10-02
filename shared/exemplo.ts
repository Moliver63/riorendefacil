/**
 * Dados de EXEMPLO para a vitrine enquanto não há oferta real ativa.
 * Sempre exibidos com o selo "exemplo" na interface.
 */
export const LASTRO_EXEMPLO = [
  { codigo: "CCB-EX-001", setor: "agro", devedor: "Produtor de soja, MT", garantia: "CPR + alienação de grãos", ltv: 0.62, situacao: "adimplente", diasAtraso: 0 },
  { codigo: "CCB-EX-002", setor: "imobiliario", devedor: "Incorporadora, SC", garantia: "Alienação fiduciária de imóvel", ltv: 0.48, situacao: "adimplente", diasAtraso: 0 },
  { codigo: "CCB-EX-003", setor: "agro", devedor: "Cooperativa de café, MG", garantia: "Recebíveis + aval", ltv: 0.71, situacao: "atraso", diasAtraso: 12 },
  { codigo: "CCB-EX-004", setor: "imobiliario", devedor: "Loteadora, PR", garantia: "Alienação fiduciária de lotes", ltv: 0.55, situacao: "adimplente", diasAtraso: 0 },
];

export type ItemLastro = (typeof LASTRO_EXEMPLO)[number];
