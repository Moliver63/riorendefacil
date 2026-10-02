import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

export default function Documentos() {
  const { data, isLoading } = trpc.investidor.documentos.useQuery();
  const baixar = trpc.investidor.baixarDocumento.useMutation({
    onSuccess: (r) => {
      window.location.href = r.url;
    },
  });

  return (
    <AreaLogada titulo="Documentos" subtitulo="Contratos, CCBs, laudos e pareceres. Cada arquivo tem impressão digital (SHA-256) registrada.">
      <Seo titulo="Documentos" indexar={false} />
      <section className="bloco">
        {isLoading ? (
          <p className="carregando">Carregando…</p>
        ) : !data?.documentos.length ? (
          <Vazio titulo="Nenhum documento ainda">
            <p>Contrato, CCBs do pool, laudos das garantias e o parecer de auditoria aparecem aqui assim que forem publicados.</p>
          </Vazio>
        ) : (
          <ul className="docs">
            {data.documentos.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.titulo}</strong>
                  <span>{d.tipo} · {new Date(d.publicadoEm).toLocaleDateString("pt-BR")}</span>
                </div>
                <button className="btn btn--ghost btn--peq" onClick={() => baixar.mutate({ id: d.id })} disabled={!data.armazenamentoAtivo || baixar.isPending}>
                  Baixar
                </button>
              </li>
            ))}
          </ul>
        )}
        {baixar.error && <p className="aviso aviso--erro">{baixar.error.message}</p>}
      </section>
    </AreaLogada>
  );
}
