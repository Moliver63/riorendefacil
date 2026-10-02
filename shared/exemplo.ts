/**
 * Dados de EXEMPLO para a vitrine enquanto não há emissor habilitado e oferta real.
 * Sempre exibidos com o selo "exemplo" na interface.
 */
import type { Faixa } from "./finance";

export const FAIXAS_EXEMPLO: Faixa[] = [
  // Tabela progressiva Rio (taxa mensal nominal, juros diários compostos)
  { minimoCentavos: 1_000_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.018 },
  { minimoCentavos: 1_000_000_00, prazoMinimoMeses: 24, taxaMensalTeto: 0.019 },
  { minimoCentavos: 1_000_000_00, prazoMinimoMeses: 36, taxaMensalTeto: 0.021 },
  { minimoCentavos: 2_000_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.019 },
  { minimoCentavos: 2_000_000_00, prazoMinimoMeses: 24, taxaMensalTeto: 0.02 },
  { minimoCentavos: 2_000_000_00, prazoMinimoMeses: 36, taxaMensalTeto: 0.022 },
  { minimoCentavos: 3_000_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.02 },
  { minimoCentavos: 3_000_000_00, prazoMinimoMeses: 24, taxaMensalTeto: 0.021 },
  { minimoCentavos: 3_000_000_00, prazoMinimoMeses: 36, taxaMensalTeto: 0.023 },
  { minimoCentavos: 3_500_000_00, prazoMinimoMeses: 12, taxaMensalTeto: 0.021 },
  { minimoCentavos: 3_500_000_00, prazoMinimoMeses: 24, taxaMensalTeto: 0.022 },
  { minimoCentavos: 3_500_000_00, prazoMinimoMeses: 36, taxaMensalTeto: 0.024 },
];

export const OFERTA_EXEMPLO = {
  id: 0,
  codigo: "RRF-GR-01",
  nome: "Giro de Grãos Centro-Oeste",
  tese:
    "O capital financia a compra à vista de soja, milho e sorgo direto do produtor rural, com revenda a cerealistas, cooperativas e indústrias já analisados. Cada operação tem nota fiscal, transporte e comprador identificados, e o pagamento do comprador cai na conta vinculada antes de qualquer margem para a Rio.",
  faixas: FAIXAS_EXEMPLO,
  carenciaPrincipalDias: 180,
  prazoResgateDias: 7,
  prazoMedioCicloDias: 55,
  coberturaMinima: 1.3,
  captacaoAlvoCentavos: 10_000_000_00,
  reservasAte: null as string | null,
  saldoContaCentavos: 1_420_000_00,
  principalComprometidoCentavos: 6_400_000_00,
  obrigacoesCentavos: 6_610_000_00,
};

export const OPERACOES_EXEMPLO = [
  { codigo: "OP-0107", grao: "milho", status: "recebida", produtorDescricao: "Produtor rural", origemMunicipio: "Sorriso", origemUf: "MT", toneladas: 850, valorCompraCentavos: 1_000_000_00, custosCentavos: 38_000_00, compradorTipo: "cooperativa", compradorDescricao: "Cooperativa agroindustrial", destinoMunicipio: "Rio Verde", destinoUf: "GO", valorVendaCentavos: 1_080_000_00, valorRecebidoCentavos: 1_080_000_00, dataCompra: "2026-07-02", vencimentoRecebimento: "2026-08-15", dataRecebimento: "2026-08-14" },
  { codigo: "OP-0112", grao: "soja", status: "vendida", produtorDescricao: "Produtor rural", origemMunicipio: "Alto Taquari", origemUf: "MT", toneladas: 1200, valorCompraCentavos: 2_280_000_00, custosCentavos: 96_000_00, compradorTipo: "industria", compradorDescricao: "Esmagadora de soja", destinoMunicipio: "Rancharia", destinoUf: "SP", valorVendaCentavos: 2_470_000_00, valorRecebidoCentavos: 0, dataCompra: "2026-08-20", vencimentoRecebimento: "2026-10-20", dataRecebimento: null },
  { codigo: "OP-0115", grao: "milho", status: "em_transporte", produtorDescricao: "Produtor rural", origemMunicipio: "Campo Verde", origemUf: "MT", toneladas: 1500, valorCompraCentavos: 1_650_000_00, custosCentavos: 72_000_00, compradorTipo: "trading", compradorDescricao: "Trading de grãos", destinoMunicipio: "Rondonópolis", destinoUf: "MT", valorVendaCentavos: null, valorRecebidoCentavos: 0, dataCompra: "2026-09-12", vencimentoRecebimento: null, dataRecebimento: null },
  { codigo: "OP-0118", grao: "sorgo", status: "comprada", produtorDescricao: "Produtor rural", origemMunicipio: "Primavera do Leste", origemUf: "MT", toneladas: 700, valorCompraCentavos: 560_000_00, custosCentavos: 21_000_00, compradorTipo: null, compradorDescricao: null, destinoMunicipio: null, destinoUf: null, valorVendaCentavos: null, valorRecebidoCentavos: 0, dataCompra: "2026-09-26", vencimentoRecebimento: null, dataRecebimento: null },
] as const;

const resgateCcb = (custo: number, meses: number) => Math.round(custo * Math.pow(1 + 0.0197 / 30, 30 * meses));

/** Carteira de CCBs da Rio (exemplo): cada CCB com garantia colateral em imóvel e valor de resgate no vencimento. */
export const GARANTIAS_EXEMPLO = [
  { codigo: "CCB-RIO-01", serie: "Única", dataEmissao: "2026-03-10", vencimento: "2029-03-10", devedorDescricao: "Comércio de cereais e transporte de cargas, Cuiabá/MT", garantiaTipo: "Alienação fiduciária de área rural", valorCentavos: 3_000_000_00, valorResgateCentavos: resgateCcb(3_000_000_00, 36), garantiaValorCentavos: 6_600_000_00, valorElegivelCentavos: 5_280_000_00, situacao: "adimplente", registroRef: "Matrícula registrada, Sorriso/MT" },
  { codigo: "CCB-RIO-02", serie: "Série A", dataEmissao: "2026-04-22", vencimento: "2028-04-22", devedorDescricao: "Armazém e beneficiamento de grãos, Rondonópolis/MT", garantiaTipo: "Alienação fiduciária de galpão logístico", valorCentavos: 2_000_000_00, valorResgateCentavos: resgateCcb(2_000_000_00, 24), garantiaValorCentavos: 4_480_000_00, valorElegivelCentavos: 3_584_000_00, situacao: "adimplente", registroRef: "Matrícula registrada, Rondonópolis/MT" },
  { codigo: "CCB-RIO-03", serie: "Série B", dataEmissao: "2026-05-15", vencimento: "2027-05-15", devedorDescricao: "Transportadora de grãos, Rio Verde/GO", garantiaTipo: "Alienação fiduciária de imóvel urbano", valorCentavos: 1_200_000_00, valorResgateCentavos: resgateCcb(1_200_000_00, 12), garantiaValorCentavos: 2_640_000_00, valorElegivelCentavos: 2_112_000_00, situacao: "adimplente", registroRef: "Matrícula registrada, Rio Verde/GO" },
  { codigo: "CCB-RIO-04", serie: "Única", dataEmissao: "2026-06-30", vencimento: "2029-06-30", devedorDescricao: "Incorporadora, Balneário Camboriú/SC", garantiaTipo: "Alienação fiduciária de salas comerciais", valorCentavos: 1_500_000_00, valorResgateCentavos: resgateCcb(1_500_000_00, 36), garantiaValorCentavos: 3_300_000_00, valorElegivelCentavos: 2_640_000_00, situacao: "adimplente", registroRef: "Matrícula registrada, Balneário Camboriú/SC" },
] as const;

/** Mantido para compatibilidade com telas antigas do lastro. */
export interface ItemLastro {
  codigo: string;
  setor: string;
  devedor: string;
  garantia: string;
  ltv: number;
  situacao: string;
  diasAtraso: number;
}
export const LASTRO_EXEMPLO: ItemLastro[] = GARANTIAS_EXEMPLO.map((g) => ({
  codigo: g.codigo,
  setor: "garantia",
  devedor: g.devedorDescricao,
  garantia: g.garantiaTipo,
  ltv: g.valorCentavos / g.garantiaValorCentavos,
  situacao: g.situacao,
  diasAtraso: 0,
}));
