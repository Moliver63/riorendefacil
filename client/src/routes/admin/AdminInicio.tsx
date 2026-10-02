import { Link } from "wouter";
import { AreaLogada } from "../../components/AreaLogada";
import { trpc } from "../../lib/trpc";
import { Seo } from "../../lib/seo";

export default function AdminInicio() {
  const { data } = trpc.admin.resumo.useQuery();
  const status = trpc.plataforma.status.useQuery();
  const kpis = [
    { rot: "Leads novos", v: data?.leadsNovos, det: `${data?.leadsSemana ?? 0} nos últimos 7 dias`, href: "/admin/leads" },
    { rot: "Leads no total", v: data?.leadsTotal },
    { rot: "Investidores cadastrados", v: data?.investidores },
    { rot: "Trilha concluída", v: data?.trilhaConcluida },
    { rot: "Pediram conversa", v: data?.interesseAporte },
  ];

  return (
    <AreaLogada titulo="Visão geral" subtitulo="Funil de captação e pendências para liberar o aporte.">
      <Seo titulo="Admin" indexar={false} />
      <div className="kpis kpis--5">
        {kpis.map((k) => (
          <div key={k.rot} className="kpi">
            <span>{k.rot}</span>
            <strong className="num">{k.v ?? "–"}</strong>
            {k.det && <small>{k.det}</small>}
            {k.href && <Link href={k.href} className="kpi__link">Abrir</Link>}
          </div>
        ))}
      </div>

      <section className="bloco">
        <div className="bloco__cab">
          <h2>Para liberar a captação</h2>
          <span className={`status ${status.data?.captacaoLiberada ? "status--adimplente" : "status--alerta"}`}>
            {status.data?.captacaoLiberada ? "Liberada" : "Travada"}
          </span>
        </div>
        {status.data?.pendencias.length ? (
          <ul className="checklist">
            {status.data.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="bloco__nota">Todas as pendências resolvidas.</p>
        )}
        <p className="bloco__nota">Configuração em variáveis de ambiente do servidor (EMISSOR_*). Veja docs/COMPLIANCE.md.</p>
      </section>
    </AreaLogada>
  );
}
