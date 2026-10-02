import { AreaLogada, Vazio } from "../../components/AreaLogada";
import { trpc } from "../../lib/trpc";
import { Seo } from "../../lib/seo";

export default function AdminAuditoria() {
  const { data, isLoading } = trpc.admin.auditoria.useQuery({});
  return (
    <AreaLogada titulo="Auditoria" subtitulo="Registro permanente de logins, alterações e documentos. Os 200 eventos mais recentes.">
      <Seo titulo="Auditoria" indexar={false} />
      <section className="bloco">
        {isLoading ? (
          <p className="carregando">Carregando…</p>
        ) : !data?.length ? (
          <Vazio titulo="Nenhum evento registrado" />
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>Ator</th><th>IP</th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{new Date(a.criadoEm).toLocaleString("pt-BR")}</td>
                    <td className="mono">{a.acao}</td>
                    <td>{a.entidade}{a.entidadeId ? ` #${a.entidadeId}` : ""}</td>
                    <td>{a.atorId ?? "–"}</td>
                    <td className="mono">{a.ip ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AreaLogada>
  );
}
