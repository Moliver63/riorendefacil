import { Fragment, useEffect, useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { Seo } from "@/components/SEO";
import { trpc, type Saidas } from "@/lib/trpc";
import { formatarBRL, formatarPct } from "~shared/finance";
import {
  COMPRADOR_ROTULO,
  COMPRADOR_TIPOS,
  GRAOS,
  GRAO_ROTULO,
  LANCAMENTO_ROTULO,
  STATUS_OPERACAO_ROTULO,
  formatarCobertura,
  margemDaOperacao,
  type StatusOperacao,
  type TipoLancamento,
} from "~shared/lastroGraos";
import { MedidorCobertura, OrdemPagamentos, dataBR } from "@/components/oferta/Ficha";
import { EnviarArquivo } from "./AdminInvestidores";

type Painel = Saidas["admin"]["operacoes"]["painel"];
type Op = Painel["operacoes"][number];

const reais = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) || 0;
const hoje = () => new Date().toISOString().slice(0, 10);
const STATUS_CLASSE: Record<string, string> = { recebida: "status--adimplente", vendida: "status--alerta", atrasada: "status--atraso", cancelada: "status--atraso" };

function useRecarregar(ofertaId: number) {
  const utils = trpc.useUtils();
  return () => {
    void utils.admin.operacoes.painel.invalidate({ ofertaId });
    void utils.admin.conta.extrato.invalidate({ ofertaId });
  };
}

function NovaOperacao({ ofertaId, proximo }: { ofertaId: number; proximo: string }) {
  const recarregar = useRecarregar(ofertaId);
  const vazio = { codigo: proximo, grao: "milho", produtor: "Produtor rural", municipio: "", uf: "MT", toneladas: "", valor: "" };
  const [f, setF] = useState(vazio);
  useEffect(() => setF((s) => ({ ...s, codigo: proximo })), [proximo]);
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const salvar = trpc.admin.operacoes.salvar.useMutation({ onSuccess: () => { setF({ ...vazio, codigo: "" }); recarregar(); } });
  const t = Number(f.toneladas.replace(",", ".")) || 0;
  const v = reais(f.valor);
  return (
    <form
      className="form-op"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate({ ofertaId, codigo: f.codigo, grao: f.grao as (typeof GRAOS)[number], produtorDescricao: f.produtor, origemMunicipio: f.municipio, origemUf: f.uf, toneladas: t, valorCompraCentavos: v });
      }}
    >
      <label className="campo-form campo-form--inline">Código<input value={f.codigo} onChange={set("codigo")} required /></label>
      <label className="campo-form campo-form--inline">Grão
        <select value={f.grao} onChange={set("grao")}>{GRAOS.map((g) => <option key={g} value={g}>{GRAO_ROTULO[g]}</option>)}</select>
      </label>
      <label className="campo-form campo-form--inline">Produtor (público)<input value={f.produtor} onChange={set("produtor")} required /></label>
      <label className="campo-form campo-form--inline">Município<input value={f.municipio} onChange={set("municipio")} required /></label>
      <label className="campo-form campo-form--inline">UF<input value={f.uf} onChange={set("uf")} maxLength={2} required /></label>
      <label className="campo-form campo-form--inline">Toneladas<input value={f.toneladas} onChange={set("toneladas")} inputMode="decimal" required /></label>
      <label className="campo-form campo-form--inline">Valor da compra (R$)<input value={f.valor} onChange={set("valor")} inputMode="decimal" required /></label>
      <div className="form-op__info">
        {t > 0 && v > 0 && <span className="sub">{formatarBRL(Math.round(v / t))} por tonelada · {formatarBRL(Math.round((v / t) * 0.06))} por saca de 60 kg</span>}
        <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Registrar operação</button>
      </div>
      {salvar.error && <p className="aviso aviso--erro">{salvar.error.message}</p>}
    </form>
  );
}

/** Formulário do próximo passo da operação, conforme o status atual. */
function Avancar({ o, ofertaId, onFeito }: { o: Op; ofertaId: number; onFeito: () => void }) {
  const recarregar = useRecarregar(ofertaId);
  const ok = () => { recarregar(); onFeito(); };
  const compra = trpc.admin.operacoes.registrarCompra.useMutation({ onSuccess: ok });
  const transp = trpc.admin.operacoes.registrarTransporte.useMutation({ onSuccess: ok });
  const venda = trpc.admin.operacoes.registrarVenda.useMutation({ onSuccess: ok });
  const receb = trpc.admin.operacoes.registrarRecebimento.useMutation({ onSuccess: ok });
  const atraso = trpc.admin.operacoes.marcarAtraso.useMutation({ onSuccess: ok });
  const cancelar = trpc.admin.operacoes.cancelar.useMutation({ onSuccess: ok });
  const erro = compra.error ?? transp.error ?? venda.error ?? receb.error ?? atraso.error ?? cancelar.error;
  const [f, setF] = useState({
    data: hoje(), nf: "", custos: "", comprovante: undefined as string | undefined,
    transportadora: o.transportadora ?? "", destinoMunicipio: o.destinoMunicipio ?? "", destinoUf: o.destinoUf ?? "",
    compradorTipo: "cooperativa", compradorDescricao: "", valorVenda: "", vencimento: "", valorReceb: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const falta = (o.valorVendaCentavos ?? 0) - o.valorRecebidoCentavos;
  const status = o.status as StatusOperacao;

  return (
    <div className="avancar">
      {status === "em_analise" && (
        <form className="linha-form" onSubmit={(e) => { e.preventDefault(); compra.mutate({ id: o.id, dataCompra: f.data, nfCompra: f.nf, custosCentavos: reais(f.custos), comprovanteChave: f.comprovante }); }}>
          <label className="campo-form campo-form--inline">Data da compra<input type="date" value={f.data} max={hoje()} onChange={set("data")} /></label>
          <label className="campo-form campo-form--inline">NF de aquisição<input value={f.nf} onChange={set("nf")} required /></label>
          <label className="campo-form campo-form--inline">Impostos e custos (R$)<input value={f.custos} onChange={set("custos")} inputMode="decimal" placeholder="0,00" /></label>
          <EnviarArquivo escopo="operacao" escopoId={o.id} tipo="nf_compra" rotulo="NF ou comprovante" onEnviado={(c) => setF((s) => ({ ...s, comprovante: c }))} />
          <button className="btn btn--primario btn--peq">Registrar compra</button>
          <button type="button" className="btn btn--ghost btn--peq" onClick={() => { const m = window.prompt("Motivo do cancelamento"); if (m) cancelar.mutate({ id: o.id, motivo: m }); }}>Cancelar operação</button>
        </form>
      )}
      {status === "comprada" && (
        <form className="linha-form" onSubmit={(e) => { e.preventDefault(); transp.mutate({ id: o.id, transportadora: f.transportadora, destinoMunicipio: f.destinoMunicipio, destinoUf: f.destinoUf }); }}>
          <label className="campo-form campo-form--inline">Transportadora<input value={f.transportadora} onChange={set("transportadora")} required /></label>
          <label className="campo-form campo-form--inline">Destino<input value={f.destinoMunicipio} onChange={set("destinoMunicipio")} required /></label>
          <label className="campo-form campo-form--inline">UF<input value={f.destinoUf} onChange={set("destinoUf")} maxLength={2} required /></label>
          <button className="btn btn--primario btn--peq">Registrar transporte</button>
        </form>
      )}
      {(status === "comprada" || status === "em_transporte") && (
        <form className="linha-form" onSubmit={(e) => { e.preventDefault(); venda.mutate({ id: o.id, compradorTipo: f.compradorTipo as (typeof COMPRADOR_TIPOS)[number], compradorDescricao: f.compradorDescricao, destinoMunicipio: f.destinoMunicipio, destinoUf: f.destinoUf, valorVendaCentavos: reais(f.valorVenda), nfVenda: f.nf, dataVenda: f.data, vencimentoRecebimento: f.vencimento }); }}>
          <label className="campo-form campo-form--inline">Comprador
            <select value={f.compradorTipo} onChange={set("compradorTipo")}>{COMPRADOR_TIPOS.map((c) => <option key={c} value={c}>{COMPRADOR_ROTULO[c]}</option>)}</select>
          </label>
          <label className="campo-form campo-form--inline">Nome do comprador<input value={f.compradorDescricao} onChange={set("compradorDescricao")} required /></label>
          {status === "comprada" && (
            <>
              <label className="campo-form campo-form--inline">Destino<input value={f.destinoMunicipio} onChange={set("destinoMunicipio")} required /></label>
              <label className="campo-form campo-form--inline">UF<input value={f.destinoUf} onChange={set("destinoUf")} maxLength={2} required /></label>
            </>
          )}
          <label className="campo-form campo-form--inline">Valor da venda (R$)<input value={f.valorVenda} onChange={set("valorVenda")} inputMode="decimal" required /></label>
          <label className="campo-form campo-form--inline">NF de venda<input value={f.nf} onChange={set("nf")} required /></label>
          <label className="campo-form campo-form--inline">Data da venda<input type="date" value={f.data} onChange={set("data")} /></label>
          <label className="campo-form campo-form--inline">Vencimento do recebível<input type="date" value={f.vencimento} onChange={set("vencimento")} required /></label>
          <button className="btn btn--primario btn--peq">Registrar venda</button>
        </form>
      )}
      {(status === "vendida" || status === "atrasada") && (
        <form className="linha-form" onSubmit={(e) => { e.preventDefault(); receb.mutate({ id: o.id, valorCentavos: reais(f.valorReceb), data: f.data, comprovanteChave: f.comprovante }); }}>
          <label className="campo-form campo-form--inline">Valor recebido (R$)<input value={f.valorReceb} onChange={set("valorReceb")} inputMode="decimal" placeholder={(falta / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} required /></label>
          <label className="campo-form campo-form--inline">Data<input type="date" value={f.data} max={hoje()} onChange={set("data")} /></label>
          <EnviarArquivo escopo="operacao" escopoId={o.id} tipo="comprovante_recebimento" rotulo="Comprovante" onEnviado={(c) => setF((s) => ({ ...s, comprovante: c }))} />
          <button className="btn btn--primario btn--peq">Registrar recebimento</button>
          {status === "vendida" && <button type="button" className="btn btn--ghost btn--peq" onClick={() => window.confirm("Marcar o recebimento como atrasado?") && atraso.mutate({ id: o.id })}>Marcar atraso</button>}
          <span className="sub">Falta receber {formatarBRL(falta)}</span>
        </form>
      )}
      {erro && <p className="aviso aviso--erro">{erro.message}</p>}
    </div>
  );
}

function TabelaOps({ painel, ofertaId }: { painel: Painel; ofertaId: number }) {
  const [aberta, setAberta] = useState<number | null>(null);
  if (!painel.operacoes.length) return <Vazio titulo="Nenhuma operação nesta oferta" />;
  return (
    <div className="tabela-wrap">
      <table className="tabela tabela--ops">
        <thead><tr><th>Operação</th><th>Origem</th><th className="dir">Compra</th><th>Comprador</th><th className="dir">Venda</th><th>Status</th><th /></tr></thead>
        <tbody>
          {painel.operacoes.map((o) => {
            const m = margemDaOperacao(o);
            const vencida = o.status === "vendida" && o.vencimentoRecebimento && o.vencimentoRecebimento < hoje();
            const finalizada = o.status === "recebida" || o.status === "cancelada";
            return (
              <Fragment key={o.id}>
                <tr>
                  <td><strong className="mono">{o.codigo}</strong><span className="sub">{GRAO_ROTULO[o.grao as keyof typeof GRAO_ROTULO]} · {o.toneladas.toLocaleString("pt-BR")} t</span></td>
                  <td>{o.produtorDescricao}, {o.origemMunicipio}/{o.origemUf}<span className="sub">{o.nfCompra ? `NF ${o.nfCompra} · ${dataBR(o.dataCompra)}` : "sem compra"}</span></td>
                  <td className="dir num">{formatarBRL(o.valorCompraCentavos)}{o.custosCentavos > 0 && <span className="sub">+ {formatarBRL(o.custosCentavos)}</span>}</td>
                  <td>{o.compradorDescricao ?? "–"}{o.destinoMunicipio && <span className="sub">{o.transportadora ? `${o.transportadora} → ` : ""}{o.destinoMunicipio}/{o.destinoUf}</span>}</td>
                  <td className="dir num">{o.valorVendaCentavos ? formatarBRL(o.valorVendaCentavos) : "–"}{m && <span className="sub">margem {formatarPct(m.pct, 1)}</span>}</td>
                  <td>
                    <span className={`status ${STATUS_CLASSE[o.status] ?? "status--neutro"}`}>{STATUS_OPERACAO_ROTULO[o.status as StatusOperacao]}</span>
                    {o.vencimentoRecebimento && !finalizada && <span className={`sub ${vencida ? "atrasado" : ""}`}>vence {dataBR(o.vencimentoRecebimento)}{vencida ? " · vencido" : ""}</span>}
                    {o.valorRecebidoCentavos > 0 && o.status !== "recebida" && <span className="sub">recebido {formatarBRL(o.valorRecebidoCentavos)}</span>}
                  </td>
                  <td className="dir">{!finalizada && <button className="btn btn--ghost btn--peq" onClick={() => setAberta(aberta === o.id ? null : o.id)}>{aberta === o.id ? "Fechar" : "Avançar"}</button>}</td>
                </tr>
                {aberta === o.id && (
                  <tr className="linha-acao"><td colSpan={7}><Avancar o={o} ofertaId={ofertaId} onFeito={() => setAberta(null)} /></td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TIPOS_MANUAIS: TipoLancamento[] = ["custos", "margem_rio", "pagamento_principal", "ajuste"];

function ContaVinculada({ painel, ofertaId }: { painel: Painel; ofertaId: number }) {
  const recarregar = useRecarregar(ofertaId);
  const extrato = trpc.admin.conta.extrato.useQuery({ ofertaId });
  const [f, setF] = useState({ tipo: "custos" as TipoLancamento, valor: "", descricao: "", data: hoje() });
  const lancar = trpc.admin.conta.lancar.useMutation({ onSuccess: () => { setF((s) => ({ ...s, valor: "", descricao: "" })); recarregar(); } });
  const valor = f.tipo === "ajuste" && f.valor.trim().startsWith("-") ? -reais(f.valor.replace("-", "")) : reais(f.valor);
  return (
    <>
      <form className="linha-form" onSubmit={(e) => { e.preventDefault(); lancar.mutate({ ofertaId, tipo: f.tipo as "custos", valorCentavos: valor, descricao: f.descricao, data: f.data }); }}>
        <label className="campo-form campo-form--inline">Lançamento
          <select value={f.tipo} onChange={(e) => setF((s) => ({ ...s, tipo: e.target.value as TipoLancamento }))}>
            {TIPOS_MANUAIS.map((t) => <option key={t} value={t}>{LANCAMENTO_ROTULO[t]}</option>)}
          </select>
        </label>
        <label className="campo-form campo-form--inline">Valor (R$){f.tipo === "ajuste" ? " · negativo para saída" : ""}<input value={f.valor} onChange={(e) => setF((s) => ({ ...s, valor: e.target.value }))} inputMode="decimal" required /></label>
        <label className="campo-form campo-form--inline">Descrição<input value={f.descricao} onChange={(e) => setF((s) => ({ ...s, descricao: e.target.value }))} required minLength={3} /></label>
        <label className="campo-form campo-form--inline">Data<input type="date" value={f.data} max={hoje()} onChange={(e) => setF((s) => ({ ...s, data: e.target.value }))} /></label>
        <button className="btn btn--primario btn--peq" disabled={lancar.isPending}>Lançar</button>
        {f.tipo === "margem_rio" && <span className="sub">Liberável hoje: <strong>{formatarBRL(painel.posicao.margemLiberavelCentavos)}</strong></span>}
      </form>
      {lancar.error && <p className="aviso aviso--erro">{lancar.error.message}</p>}
      {extrato.data?.length ? (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="dir">Valor</th></tr></thead>
            <tbody>
              {extrato.data.map((l) => (
                <tr key={l.id}>
                  <td className="num">{dataBR(l.data)}</td>
                  <td>{LANCAMENTO_ROTULO[l.tipo as TipoLancamento] ?? l.tipo}</td>
                  <td>{l.descricao}</td>
                  <td className={`dir num ${l.valorCentavos < 0 ? "" : "pos-texto"}`}>{l.valorCentavos < 0 ? "−" : "+"} {formatarBRL(Math.abs(l.valorCentavos))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="bloco__nota">Sem lançamentos. Aportes, compras, recebimentos e resgates pagos entram aqui sozinhos.</p>}
    </>
  );
}

export default function AdminOperacoes() {
  const ofertas = trpc.admin.ofertas.listar.useQuery();
  const [ofertaId, setOfertaId] = useState<number | null>(null);
  useEffect(() => {
    if (ofertaId === null && ofertas.data?.length) setOfertaId((ofertas.data.find((o) => o.ativa) ?? ofertas.data[0]!).id);
  }, [ofertas.data, ofertaId]);
  const painel = trpc.admin.operacoes.painel.useQuery({ ofertaId: ofertaId ?? 0 }, { enabled: ofertaId !== null });
  const p = painel.data?.posicao;
  const proximo = `OP-${String((painel.data?.operacoes.length ?? 0) + 1).padStart(4, "0")}`;

  return (
    <AreaLogada
      titulo="Operações e conta vinculada"
      subtitulo="Cada compra, venda e recebimento de grão, e o dinheiro entrando e saindo da conta vinculada na ordem de pagamento."
      acoes={
        ofertas.data?.length ? (
          <select value={ofertaId ?? ""} onChange={(e) => setOfertaId(Number(e.target.value))} aria-label="Oferta">
            {ofertas.data.map((o) => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} · ` : ""}{o.nome}</option>)}
          </select>
        ) : null
      }
    >
      <Seo titulo="Operações" indexar={false} />
      {!ofertas.data?.length ? (
        <section className="bloco"><Vazio titulo="Crie uma oferta primeiro">Em Ofertas e garantias.</Vazio></section>
      ) : !painel.data || !p ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <>
          <div className="kpis kpis--6">
            <div className="kpi"><span>Caixa na conta</span><strong className="num">{formatarBRL(p.saldoContaCentavos)}</strong></div>
            <div className="kpi"><span>Em operação</span><strong className="num">{formatarBRL(p.emOperacaoCentavos)}</strong><small>grão comprado ou em transporte</small></div>
            <div className="kpi"><span>A receber</span><strong className="num">{formatarBRL(p.aReceberCentavos)}</strong>{p.emAtrasoCentavos > 0 && <small className="atrasado">+ {formatarBRL(p.emAtrasoCentavos)} em atraso</small>}</div>
            <div className="kpi"><span>Devido a investidores</span><strong className="num">{formatarBRL(p.obrigacoesCentavos)}</strong><small>principal + rendimento acumulado</small></div>
            <div className={`kpi ${p.travada ? "kpi--alerta" : ""}`}><span>Cobertura</span><strong className="num">{formatarCobertura(p.cobertura)}</strong><small>mínimo {formatarCobertura(p.coberturaMinima)}</small></div>
            <div className="kpi kpi--dest"><span>Margem liberável</span><strong className="num">{formatarBRL(p.margemLiberavelCentavos)}</strong><small>depois do investidor</small></div>
          </div>
          {p.travada && <p className="aviso aviso--erro">Cobertura abaixo do mínimo: novos contratos, novas compras e a margem da Rio estão bloqueados até recompor as garantias.</p>}

          <section className="bloco">
            <div className="bloco__cab"><h2>Operações</h2></div>
            <TabelaOps painel={painel.data} ofertaId={painel.data.oferta.id} />
            <h3 className="ficha-sub">Nova operação</h3>
            <NovaOperacao ofertaId={painel.data.oferta.id} proximo={proximo} />
          </section>

          <section className="bloco">
            <div className="bloco__cab"><h2>Conta vinculada</h2></div>
            <ContaVinculada painel={painel.data} ofertaId={painel.data.oferta.id} />
          </section>

          <section className="bloco bloco--duas">
            <div>
              <h2>Cobertura</h2>
              <MedidorCobertura cobertura={p.cobertura} minima={p.coberturaMinima} />
            </div>
            <div>
              <h2>Ordem de pagamento</h2>
              <OrdemPagamentos />
            </div>
          </section>
        </>
      )}
    </AreaLogada>
  );
}
