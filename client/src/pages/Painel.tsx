import { Link } from "wouter";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { SeloEmissor } from "@/components/landing/SiteLayout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";

const data = (iso: string | null) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "a definir");

/** Próximo passo do onboarding, na ordem: trilha → perfil → interesse. */
function ProximoPasso() {
  const perfil = trpc.investidor.perfil.useQuery();
  const trilha = trpc.trilha.estado.useQuery();
  if (!perfil.data || !trilha.data) return null;

  const feitos = trilha.data.modulos.filter((m) => m.concluido).length;
  const passos = [
    { feito: trilha.data.completa, titulo: "Trilha Antes de investir", det: `${feitos} de ${trilha.data.modulos.length} módulos`, href: "/trilha" },
    { feito: perfil.data.suitability !== "nao_avaliado", titulo: "Questionário de perfil", det: "5 perguntas", href: "/perfil" },
    { feito: Boolean(perfil.data.interesseAporteEm), titulo: "Conversa com especialista", det: "manifestar interesse", href: "/perfil" },
  ];
  const atual = passos.findIndex((p) => !p.feito);
  if (atual === -1) return null;

  return (
    <section className="bloco">
      <div className="bloco__cab">
        <h2>Seus próximos passos</h2>
      </div>
      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.titulo} className={p.feito ? "feito" : i === atual ? "atual" : ""}>
            <span className="passos__n num">{p.feito ? "✓" : i + 1}</span>
            <div>
              <strong>{p.titulo}</strong>
              <span>{p.det}</span>
            </div>
            {i === atual && (
              <Link href={p.href} className="btn btn--primario btn--peq">
                Continuar
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Painel() {
  const painel = trpc.investidor.painel.useQuery();
  const lastro = trpc.plataforma.lastro.useQuery();
  const contratos = painel.data?.contratos ?? [];
  const ativos = contratos.filter((c) => c.status === "ativo");
  const soma = (k: "principalCentavos" | "disponivelCentavos" | "rendimentoBrutoCentavos") => ativos.reduce((s, c) => s + c[k], 0);

  return (
    <AreaLogada titulo="Minha carteira" subtitulo="Contratos, rendimento disponível e o lastro do pool.">
      <Seo titulo="Minha carteira" indexar={false} />
      <ProximoPasso />

      {painel.isLoading ? (
        <p className="carregando">Carregando…</p>
      ) : ativos.length === 0 ? (
        <section className="bloco">
          <Vazio titulo="Você ainda não tem contratos ativos">
            <p>Quando um contrato for assinado e o aporte confirmado na conta vinculada do emissor, ele aparece aqui com o rendimento do dia.</p>
          </Vazio>
        </section>
      ) : (
        <div className="kpis">
          <div className="kpi">
            <span>Principal aplicado</span>
            <strong className="num">{formatarBRL(soma("principalCentavos"))}</strong>
            <small>Disponível no vencimento de cada contrato</small>
          </div>
          <div className="kpi kpi--dest">
            <span>Rendimento disponível para resgate</span>
            <strong className="num">{formatarBRL(soma("disponivelCentavos"))}</strong>
            <small>Se pedir hoje, pago em {data(painel.data!.pagamentoSePedirHoje)}</small>
            <button className="btn btn--primario" disabled={!painel.data!.resgateHabilitado} title={painel.data!.resgateHabilitado ? undefined : "Disponível com o emissor parceiro habilitado"}>
              Solicitar resgate
            </button>
          </div>
          <div className="kpi">
            <span>Rendimento bruto acumulado</span>
            <strong className="num">{formatarBRL(soma("rendimentoBrutoCentavos"))}</strong>
            <small>Antes do IR, que é retido no pagamento</small>
          </div>
        </div>
      )}

      {ativos.length > 0 && (
        <section className="bloco">
          <div className="bloco__cab">
            <h2>Contratos</h2>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Oferta</th><th className="dir">Principal</th><th className="dir">Taxa</th><th>Início</th><th>Vencimento</th></tr>
              </thead>
              <tbody>
                {ativos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.oferta}</td>
                    <td className="dir num">{formatarBRL(c.principalCentavos)}</td>
                    <td className="dir num">{formatarPct(c.taxaMensal)} a.m.</td>
                    <td>{data(c.inicio)}</td>
                    <td>{data(c.vencimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bloco">
        <div className="bloco__cab">
          <h2>Lastro do pool</h2>
          <span className="bloco__det">
            {lastro.data?.exemplo ? <span className="etiqueta">exemplo</span> : `${lastro.data?.itens.length ?? 0} CCBs`}
          </span>
        </div>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr><th>CCB</th><th>Devedor</th><th>Garantia</th><th className="dir">LTV</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {(lastro.data?.itens ?? []).map((l) => (
                <tr key={l.codigo}>
                  <td className="mono">{l.codigo}</td>
                  <td><span className={`ponto ponto--${l.setor}`} aria-hidden="true" /> {l.devedor}</td>
                  <td>{l.garantia}</td>
                  <td className="dir num">{formatarPct(l.ltv, 0)}</td>
                  <td>
                    <span className={`status status--${l.situacao === "adimplente" ? "adimplente" : "atraso"}`}>
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
          <h2>Quem está por trás</h2>
          <p className="bloco__nota" style={{ marginTop: 8 }}>
            O RioRendeFácil é a tecnologia. O emissor parceiro emite as CCBs e os recursos ficam em conta vinculada em nome
            dele, nunca na plataforma.
          </p>
        </div>
        <SeloEmissor />
      </section>
    </AreaLogada>
  );
}
