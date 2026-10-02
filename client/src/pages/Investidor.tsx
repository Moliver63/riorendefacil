import { Link } from "react-router-dom";
import { Marca, SeloEmissor } from "../components/Layout";
import { trpc } from "../trpc";
import { formatarBRL, formatarPct } from "@shared/finance";

function data(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

export function Investidor() {
  const { data: p, isLoading } = trpc.investidor.painelDemo.useQuery();
  const c = p?.contratos[0];

  return (
    <div className="app">
      <header className="app__topo">
        <Marca />
        <span className="etiqueta etiqueta--alerta">Demonstração</span>
        <Link to="/" className="btn btn--ghost">
          Voltar ao site
        </Link>
      </header>

      {isLoading || !p || !c ? (
        <p className="carregando app__in">Carregando…</p>
      ) : (
        <main className="app__in">
          <h1 className="app__tit">Minha carteira</h1>
          <p className="app__sub">Dados fictícios para demonstrar o painel. Nenhum valor real.</p>

          <div className="kpis">
            <div className="kpi">
              <span>Principal aplicado</span>
              <strong className="num">{formatarBRL(c.principalCentavos)}</strong>
              <small>Disponível no vencimento, {data(c.vencimento)}</small>
            </div>
            <div className="kpi kpi--dest">
              <span>Rendimento disponível para resgate</span>
              <strong className="num">{formatarBRL(c.disponivelCentavos)}</strong>
              <small>Se pedir hoje, pago em {data(p.proximoPagamentoSeSolicitarHoje)}</small>
              <button className="btn btn--primario" disabled title="Disponível com emissor parceiro autorizado">
                Solicitar resgate
              </button>
            </div>
            <div className="kpi">
              <span>Rendimento bruto acumulado</span>
              <strong className="num">{formatarBRL(c.rendimentoBrutoCentavos)}</strong>
              <small>
                {formatarPct(c.taxaMensal)} a.m. · já resgatado {formatarBRL(c.resgatadoCentavos)}
              </small>
            </div>
          </div>

          <section className="bloco">
            <div className="bloco__cab">
              <h2>Lastro do pool</h2>
              <span className="bloco__det">{p.lastro.length} CCBs</span>
            </div>
            <div className="tabela-wrap">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>CCB</th>
                    <th>Devedor</th>
                    <th>Garantia</th>
                    <th className="dir">LTV</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lastro.map((l) => (
                    <tr key={l.codigo}>
                      <td className="mono">{l.codigo}</td>
                      <td>
                        <span className={`ponto ponto--${l.setor}`} aria-hidden="true" /> {l.devedor}
                      </td>
                      <td>{l.garantia}</td>
                      <td className="dir num">{formatarPct(l.ltv, 0)}</td>
                      <td>
                        <span className={`status status--${l.situacao}`}>
                          {l.situacao === "adimplente" ? "Em dia" : `${l.diasAtraso} dias de atraso`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="bloco__nota">LTV é o valor do crédito dividido pelo valor da garantia. Quanto menor, maior a folga.</p>
          </section>

          <section className="bloco bloco--duas">
            <div>
              <h2>Cofre de documentos</h2>
              <ul className="docs">
                <li>Contrato de investimento <span>disponível após assinatura</span></li>
                <li>CCBs registradas do pool <span>disponível após assinatura</span></li>
                <li>Laudos de avaliação das garantias <span>disponível após assinatura</span></li>
                <li>Parecer da auditoria independente <span>disponível após assinatura</span></li>
                <li>Informe de rendimentos <span>fevereiro</span></li>
              </ul>
            </div>
            <SeloEmissor />
          </section>
        </main>
      )}
    </div>
  );
}
