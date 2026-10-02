import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { Seo } from "@/components/SEO";
import { trpc } from "@/lib/trpc";
import { formatarBRL } from "~shared/finance";
import { FilaResgates } from "./AdminResgates";

const data = (iso: string | Date | null | undefined) => (iso ? new Date(typeof iso === "string" && iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "–");
const ROTULO: Record<string, string> = { informado: "Em conferência", confirmado: "Confirmado", solicitado: "Solicitado", aprovado: "Aprovado", pago: "Pago", recusado: "Recusado" };
const CLASSE: Record<string, string> = { confirmado: "status--adimplente", pago: "status--adimplente", recusado: "status--atraso" };
const hoje = () => new Date().toISOString().slice(0, 10);

function FilaDepositos() {
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState<"informado" | "confirmado" | "recusado" | "">("informado");
  const lista = trpc.admin.depositos.listar.useQuery(filtro ? { status: filtro } : {});
  const ok = () => { void utils.admin.depositos.listar.invalidate(); void utils.admin.investidores.invalidate(); };
  const confirmar = trpc.admin.depositos.confirmar.useMutation({ onSuccess: ok });
  const recusar = trpc.admin.depositos.recusar.useMutation({ onSuccess: ok });
  const erro = confirmar.error ?? recusar.error;
  return (
    <>
      <div className="fila__filtro">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar depósitos">
          <option value="informado">Em conferência</option>
          <option value="confirmado">Confirmados</option>
          <option value="recusado">Recusados</option>
          <option value="">Todos</option>
        </select>
      </div>
      {erro && <p className="aviso aviso--erro">{erro.message}</p>}
      {!lista.data?.length ? (
        <Vazio titulo="Nenhum depósito neste filtro" />
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Investidor</th><th className="dir">Informado</th><th className="dir">Contrato</th><th>Data do depósito</th><th>Comprovante</th><th>Status</th><th /></tr></thead>
            <tbody>
              {lista.data.map((d) => {
                const diferente = d.valorCentavos !== d.principalCentavos;
                return (
                  <tr key={d.id}>
                    <td><strong>{d.nome ?? d.email}</strong><span className="sub">Contrato #{d.contratoId} · {d.oferta}</span></td>
                    <td className={`dir num ${diferente ? "atrasado" : ""}`}>{formatarBRL(d.valorCentavos)}{diferente && <span className="sub">valor diferente</span>}</td>
                    <td className="dir num">{formatarBRL(d.principalCentavos)}</td>
                    <td className="num">{data(d.dataDeposito)}<span className="sub">avisado {data(d.criadoEm)}</span></td>
                    <td>{d.comprovanteChave ? "Enviado (no cofre do contrato)" : <span className="sub">sem comprovante</span>}</td>
                    <td><span className={`status ${CLASSE[d.status] ?? "status--alerta"}`}>{ROTULO[d.status] ?? d.status}</span>{d.motivoRecusa && <span className="sub">{d.motivoRecusa}</span>}</td>
                    <td className="dir acoes-linha">
                      {d.status === "informado" && (
                        <>
                          <button className="btn btn--primario btn--peq" onClick={() => window.confirm(`Confirmar que ${formatarBRL(d.valorCentavos)} caiu na conta vinculada? O contrato será ativado com início em ${data(d.dataDeposito)}.`) && confirmar.mutate({ id: d.id })}>Confirmar e ativar</button>
                          <button className="btn btn--ghost btn--peq" onClick={() => { const m = window.prompt("Motivo (o investidor recebe por e-mail)"); if (m) recusar.mutate({ id: d.id, motivo: m }); }}>Recusar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FilaSaquesPrincipal() {
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState<"solicitado" | "aprovado" | "pago" | "recusado" | "">("solicitado");
  const lista = trpc.admin.saquesPrincipal.listar.useQuery(filtro ? { status: filtro } : {});
  const ok = () => void utils.admin.saquesPrincipal.listar.invalidate();
  const aprovar = trpc.admin.saquesPrincipal.aprovar.useMutation({ onSuccess: ok });
  const pagar = trpc.admin.saquesPrincipal.marcarPago.useMutation({ onSuccess: ok });
  const recusar = trpc.admin.saquesPrincipal.recusar.useMutation({ onSuccess: ok });
  const erro = aprovar.error ?? pagar.error ?? recusar.error;
  return (
    <>
      <div className="fila__filtro">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar saques">
          <option value="solicitado">Aguardando aprovação</option>
          <option value="aprovado">Aprovados, a pagar</option>
          <option value="pago">Pagos</option>
          <option value="recusado">Recusados</option>
          <option value="">Todos</option>
        </select>
      </div>
      {erro && <p className="aviso aviso--erro">{erro.message}</p>}
      {!lista.data?.length ? (
        <Vazio titulo="Nenhum saque do principal neste filtro" />
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Investidor</th><th>Tipo e regra</th><th className="dir">Bruto</th><th className="dir">Penalidade</th><th className="dir">IR</th><th className="dir">Líquido</th><th>Conta</th><th>Previsto</th><th>Status</th><th /></tr></thead>
            <tbody>
              {lista.data.map(({ r, ...x }) => {
                const atrasado = (r.status === "solicitado" || r.status === "aprovado") && r.previstoPara < hoje();
                return (
                  <tr key={r.id}>
                    <td><strong>{x.nome ?? x.email}</strong><span className="sub">Contrato #{r.contratoId} · {x.oferta} · {r.diasPermanencia} dias</span></td>
                    <td>{r.tipo === "vencimento" ? "Vencimento" : "Antecipado"}<span className="sub">{r.regra}</span></td>
                    <td className="dir num">{formatarBRL(r.brutoCentavos)}</td>
                    <td className="dir num">{r.penalidadeCentavos ? formatarBRL(r.penalidadeCentavos) : "–"}</td>
                    <td className="dir num">{formatarBRL(r.irCentavos)}</td>
                    <td className="dir num"><strong>{formatarBRL(r.liquidoCentavos)}</strong></td>
                    <td>{x.banco ? `${x.banco}, ag. ${x.agencia}, ${x.contaTipo} final ${x.contaFinal}` : "–"}</td>
                    <td className={atrasado ? "atrasado" : ""}>{data(r.previstoPara)}{atrasado ? " · atrasado" : ""}</td>
                    <td><span className={`status ${CLASSE[r.status] ?? "status--alerta"}`}>{ROTULO[r.status] ?? r.status}</span>{r.motivoRecusa && <span className="sub">{r.motivoRecusa}</span>}</td>
                    <td className="dir acoes-linha">
                      {r.status === "solicitado" && <button className="btn btn--primario btn--peq" onClick={() => aprovar.mutate({ id: r.id })}>Aprovar</button>}
                      {r.status === "aprovado" && <button className="btn btn--primario btn--peq" onClick={() => window.confirm("Confirmar que a transferência já foi feita pela conta vinculada? O contrato será encerrado.") && pagar.mutate({ id: r.id })}>Marcar pago</button>}
                      {(r.status === "solicitado" || r.status === "aprovado") && (
                        <button className="btn btn--ghost btn--peq" onClick={() => { const m = window.prompt("Motivo (o investidor recebe por e-mail)"); if (m) recusar.mutate({ id: r.id, motivo: m }); }}>Recusar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminMovimentacoes() {
  const [aba, setAba] = useState<"depositos" | "rendimento" | "principal">("depositos");
  return (
    <AreaLogada titulo="Movimentações" subtitulo="Depósitos informados pelos investidores e pedidos de saque. O dinheiro passa só pela conta vinculada; aqui você registra cada etapa.">
      <Seo titulo="Movimentações" indexar={false} />
      <section className="bloco">
        <div className="abas" role="tablist">
          {([["depositos", "Depósitos"], ["rendimento", "Saques de rendimento"], ["principal", "Saques do principal"]] as const).map(([k, r]) => (
            <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? "on" : ""} onClick={() => setAba(k)}>{r}</button>
          ))}
        </div>
        {aba === "depositos" ? <FilaDepositos /> : aba === "rendimento" ? <FilaResgates /> : <FilaSaquesPrincipal />}
      </section>
    </AreaLogada>
  );
}
