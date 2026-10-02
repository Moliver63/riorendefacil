import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { Seo } from "@/components/SEO";
import { trpc } from "@/lib/trpc";
import { formatarBRL } from "~shared/finance";

type Filtro = "solicitado" | "aprovado" | "pago" | "recusado" | "";
const ROTULO: Record<string, string> = { solicitado: "Solicitado", aprovado: "Aprovado", pago: "Pago", recusado: "Recusado" };
const CLASSE: Record<string, string> = { solicitado: "status--alerta", aprovado: "status--alerta", pago: "status--adimplente", recusado: "status--atraso" };
const data = (iso: string | Date | null) => (iso ? new Date(typeof iso === "string" && iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "–");

export default function AdminResgates() {
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState<Filtro>("solicitado");
  const { data: lista, isLoading } = trpc.admin.resgates.listar.useQuery(filtro ? { status: filtro } : {});
  const recarregar = () => void utils.admin.resgates.listar.invalidate();
  const aprovar = trpc.admin.resgates.aprovar.useMutation({ onSuccess: recarregar });
  const pagar = trpc.admin.resgates.marcarPago.useMutation({ onSuccess: recarregar });
  const recusar = trpc.admin.resgates.recusar.useMutation({ onSuccess: recarregar });
  const erro = aprovar.error ?? pagar.error ?? recusar.error;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <AreaLogada
      titulo="Resgates"
      subtitulo="Pedidos de resgate de rendimento. A transferência é feita pela conta vinculada do emissor; aqui você registra cada etapa."
      acoes={
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar por status">
          <option value="solicitado">Aguardando aprovação</option>
          <option value="aprovado">Aprovados, a pagar</option>
          <option value="pago">Pagos</option>
          <option value="recusado">Recusados</option>
          <option value="">Todos</option>
        </select>
      }
    >
      <Seo titulo="Resgates" indexar={false} />
      {erro && <p className="aviso aviso--erro">{erro.message}</p>}
      <section className="bloco">
        {isLoading ? <p className="carregando">Carregando…</p> : !lista?.length ? <Vazio titulo="Nenhum pedido neste filtro" /> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Investidor</th><th className="dir">Bruto</th><th className="dir">IR</th><th className="dir">Líquido</th><th>Conta</th><th>Previsto</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const atrasado = r.status !== "pago" && r.status !== "recusado" && r.previstoPara < hoje;
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.nome ?? r.email}</strong><span className="sub">Contrato #{r.contratoId} · pedido {data(r.solicitadoEm)}</span></td>
                      <td className="dir num">{formatarBRL(r.valorCentavos)}</td>
                      <td className="dir num">{formatarBRL(Number(r.irRetidoCentavos))}</td>
                      <td className="dir num"><strong>{formatarBRL(r.valorCentavos - Number(r.irRetidoCentavos))}</strong></td>
                      <td>{r.banco ? `${r.banco}, ag. ${r.agencia}, ${r.contaTipo} final ${r.contaFinal}` : "–"}</td>
                      <td className={atrasado ? "atrasado" : ""}>{data(r.previstoPara)}{atrasado ? " · atrasado" : ""}{r.pagoEm ? <span className="sub">pago {data(r.pagoEm)}</span> : null}</td>
                      <td><span className={`status ${CLASSE[r.status] ?? ""}`}>{ROTULO[r.status] ?? r.status}</span>{r.motivoRecusa && <span className="sub">{r.motivoRecusa}</span>}</td>
                      <td className="dir acoes-linha">
                        {r.status === "solicitado" && <button className="btn btn--primario btn--peq" onClick={() => aprovar.mutate({ id: r.id })}>Aprovar</button>}
                        {r.status === "aprovado" && <button className="btn btn--primario btn--peq" onClick={() => window.confirm("Confirmar que a transferência já foi feita pela conta vinculada?") && pagar.mutate({ id: r.id })}>Marcar pago</button>}
                        {(r.status === "solicitado" || r.status === "aprovado") && (
                          <button className="btn btn--ghost btn--peq" onClick={() => { const m = window.prompt("Motivo da recusa (o investidor recebe por e-mail)"); if (m) recusar.mutate({ id: r.id, motivo: m }); }}>Recusar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AreaLogada>
  );
}
