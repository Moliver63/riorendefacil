import { useState } from "react";
import { Link } from "wouter";
import { Seo } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatarBRL, formatarPct, tetoDaFaixa, aliquotaIR, type Faixa } from "~shared/finance";
import { PRAZOS_CONTRATO, formatarCobertura } from "~shared/lastroGraos";
import { MolduraOferta } from "./Ofertas";
import {
  BarraAlocacao,
  FluxoOperacao,
  MedidorCobertura,
  OrdemPagamentos,
  RISCOS_GRAOS,
  RegrasResgateAntecipado,
  TabelaGarantias,
  TabelaProgressiva,
  TabelaOperacoes,
  brlCurto,
  dataBR,
  fatiasDaFicha,
  type Ficha,
} from "@/components/oferta/Ficha";

const reais = (s: string) => Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100) || 0;

type Reserva = { id: number; valorCentavos: number; prazoMeses: number; taxaMensal: number } | null;

function CaixaReserva({ f, minhaReserva }: { f: Ficha; minhaReserva: Reserva }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const investidor = user?.papel === "investidor";
  const pend = trpc.investidor.pendencias.useQuery(undefined, { enabled: investidor });
  const prazos = PRAZOS_CONTRATO.filter((p) => p >= f.prazoMinimoMeses && p * 30 >= f.carenciaPrincipalDias);
  const [valor, setValor] = useState(minhaReserva ? (minhaReserva.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [prazo, setPrazo] = useState(minhaReserva?.prazoMeses ?? prazos[0] ?? 12);
  const recarregar = () => { void utils.investidor.oferta.invalidate(); void utils.investidor.reservas.invalidate(); };
  const reservar = trpc.investidor.reservar.useMutation({ onSuccess: recarregar });
  const cancelar = trpc.investidor.cancelarReserva.useMutation({ onSuccess: recarregar });

  const centavos = reais(valor);
  const taxa = centavos ? tetoDaFaixa(f.faixas as Faixa[], centavos, prazo) : null;
  const mensal = taxa ? Math.round(centavos * taxa) : 0;
  const ir = aliquotaIR(prazo * 30);

  return (
    <aside className="reserva">
      <h2>{minhaReserva ? "Sua reserva" : "Reservar"}</h2>
      {f.exemplo ? (
        <p className="bloco__nota">Oferta de exemplo. As reservas abrem quando o emissor estiver habilitado.</p>
      ) : !user ? (
        <>
          <p className="bloco__nota">Entre para reservar. Antes, você passa pela trilha, pelo perfil e pelo cadastro.</p>
          <Link href={`/entrar?voltar=/ofertas/${f.id}`} className="btn btn--primario btn--largo">Entrar para reservar</Link>
        </>
      ) : !investidor ? (
        <p className="bloco__nota">Reservas são feitas pela conta de investidor.</p>
      ) : pend.data && pend.data.length > 0 ? (
        <>
          <p className="bloco__nota">Falta pouco para reservar:</p>
          <ul className="reserva__pend">
            {pend.data.map((p) => <li key={p.etapa}><Link href={p.href}>{p.mensagem}</Link></li>)}
          </ul>
        </>
      ) : !f.captacaoLiberada && !minhaReserva ? (
        <p className="aviso aviso--erro">Reservas suspensas nesta oferta no momento.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (taxa) reservar.mutate({ ofertaId: f.id, valorCentavos: centavos, prazoMeses: prazo }); }}>
          {minhaReserva && (
            <p className="aviso aviso--ok">
              {formatarBRL(minhaReserva.valorCentavos)} por {minhaReserva.prazoMeses} meses a {formatarPct(minhaReserva.taxaMensal)} a.m. Um especialista entra em contato para o contrato.
            </p>
          )}
          <label className="campo-form">Valor (R$)
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder={(f.aplicacaoMinimaCentavos / 100).toLocaleString("pt-BR")} required />
          </label>
          <label className="campo-form">Prazo
            <select value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}>
              {prazos.map((p) => <option key={p} value={p}>{p} meses</option>)}
            </select>
          </label>
          <dl className="reserva__previa">
            <div><dt>Taxa pela faixa</dt><dd className="num">{taxa !== null ? `${formatarPct(taxa)} a.m.` : centavos ? "fora das faixas" : "–"}</dd></div>
            <div><dt>Rendimento bruto por mês</dt><dd className="num">{taxa ? formatarBRL(mensal) : "–"}</dd></div>
            <div><dt>IR no prazo escolhido</dt><dd className="num">{formatarPct(ir, 1)}</dd></div>
          </dl>
          {reservar.error && <p className="aviso aviso--erro">{reservar.error.message}</p>}
          <button className="btn btn--primario btn--largo" disabled={!taxa || reservar.isPending}>
            {reservar.isPending ? "Enviando…" : minhaReserva ? "Atualizar reserva" : "Reservar"}
          </button>
          {minhaReserva && (
            <button type="button" className="btn btn--ghost btn--largo" style={{ marginTop: 8 }} onClick={() => window.confirm("Cancelar sua reserva?") && cancelar.mutate({ id: minhaReserva.id })}>
              Cancelar reserva
            </button>
          )}
          <p className="bloco__nota">Reserva não é aporte. O valor só sai da sua conta depois do contrato assinado, direto para a conta vinculada.</p>
        </form>
      )}
    </aside>
  );
}

export default function OfertaDetalhe({ id }: { id: number }) {
  const { user, isLoading: carregandoAuth } = useAuth();
  const investidor = user?.papel === "investidor";
  const comoInvestidor = trpc.investidor.oferta.useQuery({ id }, { enabled: investidor });
  const publica = trpc.plataforma.oferta.useQuery({ id }, { enabled: !carregandoAuth && !investidor });
  const q = investidor ? comoInvestidor : publica;
  const f = q.data;

  if (q.error) {
    return (
      <MolduraOferta titulo="Oferta não encontrada">
        <p className="bloco__nota">{q.error.message} <Link href="/ofertas">Ver ofertas abertas</Link></p>
      </MolduraOferta>
    );
  }
  if (!f) return <MolduraOferta titulo="Oferta"><p className="carregando">Carregando…</p></MolduraOferta>;

  const p = f.posicao;
  const minhaReserva = "minhaReserva" in f ? (f.minhaReserva as Reserva) : null;
  return (
    <MolduraOferta titulo={f.nome} subtitulo={`${f.codigo} · lastro em operações de ${f.graos.map((g) => g.rotulo.toLowerCase()).join(", ") || "grãos"}`}>
      <Seo titulo={f.nome} descricao={f.tese.slice(0, 155)} />
      {f.exemplo && <p className="aviso">Oferta de exemplo, com números ilustrativos, para você conhecer a ficha.</p>}

      <div className="ficha-oferta">
        <div className="ficha-oferta__corpo">
          <section className="bloco">
            <dl className="ficha-kpis">
              <div><dt>Taxa</dt><dd className="num">{f.taxaDesde === f.taxaAte ? formatarPct(f.taxaAte) : `${formatarPct(f.taxaDesde)} a ${formatarPct(f.taxaAte)}`}<small> a.m.</small></dd></div>
              <div><dt>Aplicação mínima</dt><dd className="num">{brlCurto(f.aplicacaoMinimaCentavos)}</dd></div>
              <div><dt>Prazos</dt><dd className="num">{PRAZOS_CONTRATO.filter((p) => p >= f.prazoMinimoMeses).join(", ")} <small>meses</small></dd></div>
              <div><dt>Resgate do rendimento</dt><dd className="num">D+{f.prazoResgateDias}</dd></div>
              <div><dt>Principal</dt><dd className="num">no vencimento<small> · recompra pela Rio</small></dd></div>
              <div><dt>Cobertura</dt><dd className="num">{formatarCobertura(p.cobertura)}</dd></div>
            </dl>
            <p className="ficha-tese">{f.tese}</p>
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Tabela progressiva de rendimentos</h2><span className="bloco__det">juros creditados por dia, pré-fixados</span></div>
            <TabelaProgressiva faixas={f.faixas as Faixa[]} prazoResgateDias={f.prazoResgateDias} />
            <p className="bloco__nota">Acumulado no vencimento sem nenhum saque de juros. Se você resgatar juros durante o contrato, o valor sacado deixa de render a partir do pedido.</p>
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Como o dinheiro gira</h2></div>
            <FluxoOperacao cicloDias={f.prazoMedioCicloDias} />
          </section>

          <section className="bloco">
            <div className="bloco__cab">
              <h2>Operações de grãos</h2>
              <span className="bloco__det">{f.graos.map((g) => `${g.rotulo}: ${g.toneladas.toLocaleString("pt-BR")} t`).join(" · ")}</span>
            </div>
            <TabelaOperacoes operacoes={f.operacoes} />
            <p className="bloco__nota">Notas fiscais, comprovantes de transporte e de recebimento ficam com o emissor e a auditoria. O nome do produtor pessoa física não é divulgado.</p>
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Conta vinculada</h2><span className="bloco__det">onde está o dinheiro da oferta hoje</span></div>
            <BarraAlocacao fatias={fatiasDaFicha(f)} titulo={`${formatarBRL(p.ativosCentavos)} em ativos para ${formatarBRL(p.obrigacoesCentavos)} devidos a investidores`} />
            <h3 className="ficha-sub">Ordem de pagamento</h3>
            <OrdemPagamentos />
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Carteira de CCBs e garantias</h2><span className="bloco__det">{formatarBRL(p.garantiasElegiveisCentavos)} elegíveis para cobertura</span></div>
            <MedidorCobertura cobertura={p.cobertura} minima={p.coberturaMinima} />
            <TabelaGarantias garantias={f.garantias} />
            <p className="bloco__nota">Cada CCB tem garantia colateral em imóvel por alienação fiduciária e é emitida em favor da Rio. LTV é o custo da CCB dividido pela avaliação do imóvel. Para a cobertura conta só a parte elegível da avaliação.</p>
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Resgate antecipado do principal</h2></div>
            <RegrasResgateAntecipado />
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Riscos</h2></div>
            <div className="riscos-lista">
              {RISCOS_GRAOS.map((r) => <div key={r.t}><strong>{r.t}</strong><p>{r.d}</p></div>)}
            </div>
            {f.reservasAte && <p className="bloco__nota">Reservas até {dataBR(f.reservasAte)}.</p>}
          </section>
        </div>
        <CaixaReserva f={f} minhaReserva={minhaReserva} />
      </div>
    </MolduraOferta>
  );
}
