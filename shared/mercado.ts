import type { Referencia } from "./finance";

/**
 * Referências de mercado para comparação no simulador.
 * ATUALIZAR mensalmente com a fonte oficial (B3/Banco Central). A data de
 * referência aparece na interface ao lado da comparação.
 */
export const REFERENCIAS_MERCADO: { dataReferencia: string; fonte: string; itens: Referencia[] } = {
  dataReferencia: "set/2026",
  fonte: "Valores de referência a confirmar com Banco Central e B3 antes de publicar",
  itens: [
    { nome: "CDB 100% do CDI", taxaAnual: 0.139, isento: false },
    { nome: "Poupança", taxaAnual: 0.0834, isento: true },
  ],
};
