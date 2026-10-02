/**
 * Configuração do emissor parceiro.
 *
 * O RioRendeFácil é a camada de tecnologia. Quem emite as CCBs, custodia os
 * recursos e responde pela oferta é o emissor licenciado.
 *
 * Enquanto `autorizado` for false, a interface NÃO exibe nome, logo nem marca
 * de nenhum emissor real: mostra o espaço "Emissor parceiro" vazio e o fluxo de
 * aporte fica desligado. Só ligue `autorizado` com contrato assinado e
 * autorização de uso de marca por escrito.
 */
import type { Faixa } from "./finance";

export type EmissorParceiro = {
  autorizado: boolean;
  nome: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  /** número/registro na CVM da securitizadora, se aplicável */
  registroCVM: string | null;
  /** URL pública da logo autorizada */
  logoUrl: string | null;
  site: string | null;
  /** administrador fiduciário / conta vinculada */
  custodiante: string | null;
  auditor: string | null;
  /** quadro de faixas de taxa vigente, fornecido pelo emissor */
  faixas: Faixa[];
  /** prazo de pagamento do resgate de rendimento, em dias corridos */
  prazoResgateDias: number;
  /** prazo mínimo do principal, em dias */
  carenciaPrincipalDias: number;
};

/**
 * Faixas de EXEMPLO para a demo. Não representam proposta de nenhum emissor.
 * Substituir pelo quadro oficial do parceiro.
 */
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

export function carregarEmissor(env: Record<string, string | undefined> = {}): EmissorParceiro {
  const autorizado = env.EMISSOR_AUTORIZADO === "true";
  const v = (k: string) => (autorizado ? env[k] || null : null);
  return {
    autorizado,
    nome: v("EMISSOR_NOME"),
    razaoSocial: v("EMISSOR_RAZAO_SOCIAL"),
    cnpj: v("EMISSOR_CNPJ"),
    registroCVM: v("EMISSOR_REGISTRO_CVM"),
    logoUrl: v("EMISSOR_LOGO_URL"),
    site: v("EMISSOR_SITE"),
    custodiante: v("EMISSOR_CUSTODIANTE"),
    auditor: v("EMISSOR_AUDITOR"),
    faixas: FAIXAS_EXEMPLO,
    prazoResgateDias: Number(env.PRAZO_RESGATE_DIAS ?? 7),
    carenciaPrincipalDias: Number(env.CARENCIA_PRINCIPAL_DIAS ?? 60),
  };
}

/**
 * Checklist mínimo para liberar o fluxo de aporte. Se faltar qualquer item,
 * o site funciona só como captação de interesse (lead), sem receber dinheiro.
 */
export function pendenciasParaCaptar(e: EmissorParceiro): string[] {
  const p: string[] = [];
  if (!e.autorizado) p.push("Contrato com emissor e autorização de uso de marca");
  if (!e.cnpj) p.push("CNPJ do emissor");
  if (!e.registroCVM) p.push("Registro do emissor na CVM (validar com advogado qual se aplica)");
  if (!e.custodiante) p.push("Conta vinculada / administrador fiduciário");
  if (!e.auditor) p.push("Auditoria independente");
  return p;
}
