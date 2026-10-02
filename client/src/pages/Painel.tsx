import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { SeloEmissor } from "@/components/landing/SiteLayout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";
import { BarraAlocacao, type ChaveFatia } from "@/components/oferta/Ficha";
import { EvolucaoPatrimonio } from "@/components/painel/EvolucaoPatrimonio";
import { ModalDeposito, ModalSaque, PainelSaque, TabelaMovimentacoes } from "@/components/painel/Movimentacoes";

type ContratoPainel = Saidas["investidor"]["painel"]["contratos"][number];

const data = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "a definir");

/** Próximo passo: cadastro → reserva. A trilha fica como leitura opcional. */
function ProximoPasso({ temContrato }: { temContrato: boolean }) {
  const perfil = trpc.investidor.perfil.useQuery();
  if (!perfil.data || temContrato) return null;

  const passos = [
    { feito: Boolean(perfil.data.cadastroCompletoEm), titulo: "Cadastro do investidor", det: "dados para o contrato", href: "/cadastro" },
    { feito: Boolean(perfil.data.interesseAporteEm), titulo: "Reserva numa oferta", det: perfil.data.interesseAporteEm ? "reserva enviada" : "escolha a oferta, o valor e o prazo", href: "/ofertas" },
  ];
  const atual = passos.findIndex((p) => !p.feito);
  if (atual === -1) {
    return (
      <section className="bloco">
        <p className="aviso aviso--ok" style={{ margin: 0 }}>
          Tudo pronto do seu lado. Um especialista vai entrar em contato para gerar o contrato a partir da sua reserva.
        </p>
      </section>
    );
  }
  return (
    <section className="bloco">
      <div className="bloco__cab"><h2>Seus próximos passos</h2></div>
      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.titulo} className={p.feito ? "feito" : i === atual ? "atual" : ""}>
            <span className="passos__n num">{p.feito ? "✓" : i + 1}</span>
            <div><strong>{p.titulo}</strong><span>{p.det}</span></div>
            {i === atual && <Link href={p.href} className="btn btn--primario btn--peq">Continuar</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function MinhasReservas() {
  const utils = trpc.useUtils();
  const reservas = trpc.investidor.reservas.useQuery();
  const cancelar = trpc.investidor.cancelarReserva.useMutation({ onSuccess: () => void utils.investidor.reservas.invalidate() });
  if (!reservas.data?.length) {
    return (
      <section className="bloco bloco--cta">
        <div>
          <h2>Ofertas abertas</h2>
          <p className="bloco__nota">Veja as operações de grãos, as garantias e a cobertura de cada oferta antes de reservar.</p>
        </div>
        <Link href="/ofertas" className="btn btn--primario btn--peq">Ver ofertas</Link>
      </section>
    );
  }
  return (
    <section className="bloco">
      <div className="bloco__cab"><h2>Minhas reservas</h2><Link href="/ofertas" className="btn btn--ghost btn--peq">Ver ofertas</Link></div>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Oferta</th><th className="dir">Valor</th><th>Prazo</th><th className="dir">Taxa</th><th /></tr></thead>
          <tbody>
            {reservas.data.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/ofertas/${r.ofertaId}`}><strong>{r.oferta}</strong></Link><span className="sub">{r.codigo} · reservado em {data(r.criadoEm as unknown as string)}</span></td>
                <td className="dir num">{formatarBRL(r.valorCentavos)}</td>
                <td>{r.prazoMeses} meses</td>
                <td className="dir num">{formatarPct(r.taxaMensal)} a.m.</td>
                <td className="dir"><button className="btn btn--ghost btn--peq" onClick={() => window.confirm("Cancelar esta reserva?") && cancelar.mutate({ id: r.id })}>Cancelar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bloco__nota">Um especialista entra em contato para gerar o contrato a partir da reserva.</p>
    </section>
  );
}

function Extrato({ contratoId }: { contratoId: number }) {
  const { data: linhas } = trpc.investidor.extrato.useQuery({ contratoId });
  if (!linhas?.length) return <p className="bloco__nota">Sem lançamentos.</p>;
  return (
    <ul className="extrato">
      {linhas.map((l, i) => (
        <li key={i} className={l.status === "recusado" ? "extrato--recusado" : ""}>
          <span className="extrato__data num">{data(l.data)}</span>
          <span className="extrato__desc">{l.descricao}</span>
          <span className={`extrato__valor num ${l.valorCentavos < 0 ? "neg" : "pos"}`}>{l.valorCentavos < 0 ? "−" : "+"} {formatarBRL(Math.abs(l.valorCentavos))}</span>
        </li>
      ))}
    </ul>
  );
}

function ContratoAtivo({ c, painel }: { c: ContratoPainel; painel: Saidas["investidor"]["painel"] }) {
  const [aba, setAba] = useState<"onde" | "evolucao" | "resgate" | "extrato">("evolucao");
  return (
    <section className="bloco contrato">
      <div className="bloco__cab">
        <div>
          <h2>{c.oferta}</h2>
          <span className="bloco__det">{c.ofertaCodigo ? `${c.ofertaCodigo} · ` : ""}Contrato #{c.id} · {formatarPct(c.taxaMensal)} a.m. · {data(c.inicio)} a {data(c.vencimento)}</span>
        </div>
        <Link href={`/contrato/${c.id}`} className="btn btn--ghost btn--peq">Ver contrato</Link>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Saldo aportado</span><strong className="num">{formatarBRL(c.principalCentavos)}</strong><small>Disponível no vencimento, {data(c.vencimento)}</small></div>
        <div className="kpi kpi--dest"><span>Rendimento disponível</span><strong className="num">{formatarBRL(c.disponivelCentavos)}</strong><small>Se pedir hoje, pago em {data(painel.pagamentoSePedirHoje)}</small></div>
        <div className="kpi"><span>Saldo total</span><strong className="num">{formatarBRL(c.principalCentavos + c.disponivelCentavos)}</strong><small>Rendimento bruto acumulado {formatarBRL(c.rendimentoBrutoCentavos)} · já resgatado {formatarBRL(c.resgatadoCentavos)}</small></div>
      </div>
      <div className="abas" role="tablist">
        {(["evolucao", "onde", "resgate", "extrato"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "on" : ""} onClick={() => setAba(a)}>
            {a === "onde" ? "Onde está seu dinheiro" : a === "evolucao" ? "Evolução" : a === "resgate" ? "Sacar" : "Extrato"}
          </button>
        ))}
      </div>
      {aba === "onde" && (
        <>
          <BarraAlocacao
            titulo="Sua parte proporcional nas operações da oferta, hoje"
            fatias={c.alocacao.map((a) => ({ chave: a.grao as ChaveFatia, rotulo: a.rotulo, centavos: a.centavos, det: a.operacoes ? `${a.grao === "a_receber" ? "" : "grão comprado · "}${a.operacoes} ${a.operacoes === 1 ? "operação" : "operações"}` : undefined }))}
          />
          <Link href={`/ofertas/${c.ofertaId}`} className="btn btn--ghost btn--peq">Ver operações e garantias da oferta</Link>
        </>
      )}
      {aba === "evolucao" && (
        <EvolucaoPatrimonio
          principalCentavos={c.principalCentavos}
          taxaMensal={c.taxaMensal}
          taxaMensalEfetiva={c.taxaMensalEfetiva}
          saldoCentavos={c.saldoCentavos}
          jurosProximoMesCentavos={c.jurosProximoMesCentavos}
          valorNoVencimentoCentavos={c.valorNoVencimentoCentavos}
          prazoResgateDias={painel.prazoResgateDias}
          vencimento={c.vencimento}
          hoje={painel.hoje}
          pontos={c.evolucao}
        />
      )}
      {aba === "resgate" && <PainelSaque c={c} painel={painel} />}
      {aba === "extrato" && <Extrato contratoId={c.id} />}
    </section>
  );
}

const STATUS_CLASSE: Record<string, string> = {
  ativo: "status--adimplente",
  liquidado: "status--neutro",
  cancelado: "status--atraso",
  aguardando_assinatura: "status--alerta",
  aguardando_aporte: "status--alerta",
};

function ContratoPendente({ c, onDepositar }: { c: ContratoPainel; onDepositar: () => void }) {
  return (
    <section className="bloco bloco--pendente">
      <div className="bloco__cab">
        <div>
          <h2>Contrato #{c.id} · {formatarBRL(c.principalCentavos)}</h2>
          <span className="bloco__det">{formatarPct(c.taxaMensal)} a.m. · {c.prazoMeses} meses · {c.oferta}</span>
        </div>
        <span className={`status ${STATUS_CLASSE[c.status] ?? ""}`}>{c.statusRotulo}</span>
      </div>
      <p className="bloco__nota">
        {c.status === "aguardando_assinatura"
          ? "Leia o contrato com calma. A assinatura é feita com o especialista."
          : c.depositoInformado
            ? `Depósito de ${formatarBRL(c.depositoInformado.valorCentavos)} informado em ${data(c.depositoInformado.dataDeposito)}. A equipe está conferindo na conta vinculada.`
            : "Contrato assinado. Faça o depósito na conta vinculada e avise por aqui; o rendimento conta a partir da data do depósito."}
      </p>
      <div className="acoes-inline">
        <Link href={`/contrato/${c.id}`} className="btn btn--ghost btn--peq">Ler o contrato</Link>
        {c.status === "aguardando_aporte" && !c.depositoInformado && <button className="btn btn--primario btn--peq" onClick={onDepositar}>Depositar</button>}
      </div>
    </section>
  );
}

function ContratoEncerrado({ c }: { c: ContratoPainel }) {
  return (
    <section className="bloco">
      <div className="bloco__cab">
        <div>
          <h2>{c.oferta}</h2>
          <span className="bloco__det">Contrato #{c.id} · {formatarBRL(c.principalCentavos)} · {formatarPct(c.taxaMensal)} a.m.{c.inicio ? ` · desde ${data(c.inicio)}` : ""}</span>
        </div>
        <span className={`status ${STATUS_CLASSE[c.status] ?? ""}`}>{c.statusRotulo}</span>
      </div>
      <p className="bloco__nota">{c.status === "liquidado" ? "Contrato encerrado com o saque do principal. O histórico está nas movimentações." : "Contrato cancelado antes do aporte."}</p>
      {c.status === "liquidado" && <Extrato contratoId={c.id} />}
    </section>
  );
}

/** Todos os investimentos numa tabela; a linha escolhida abre o detalhe logo abaixo. */
function MeusInvestimentos({ contratos, selecionado, onSelecionar }: { contratos: ContratoPainel[]; selecionado: number | null; onSelecionar: (id: number) => void }) {
  return (
    <section className="bloco">
      <div className="bloco__cab"><h2>Meus investimentos</h2><span className="bloco__det">{contratos.length} {contratos.length === 1 ? "contrato" : "contratos"}</span></div>
      <div className="tabela-wrap">
        <table className="tabela tabela--invest">
          <thead><tr><th>Investimento</th><th>Situação</th><th className="dir">Aportado</th><th className="dir">Taxa</th><th>Período</th><th className="dir">Saldo hoje</th><th className="dir">Rendimento disponível</th></tr></thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id} className={selecionado === c.id ? "selecionada" : ""} onClick={() => onSelecionar(c.id)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelecionar(c.id)} aria-selected={selecionado === c.id}>
                <td><strong>{c.oferta}</strong><span className="sub">{c.ofertaCodigo ? `${c.ofertaCodigo} · ` : ""}contrato #{c.id}</span></td>
                <td>
                  <span className={`status ${STATUS_CLASSE[c.status] ?? ""}`}>{c.saquePrincipal ? "Saque em andamento" : c.depositoInformado ? "Depósito em conferência" : c.statusRotulo}</span>
                </td>
                <td className="dir num">{formatarBRL(c.principalCentavos)}</td>
                <td className="dir num">{formatarPct(c.taxaMensal)} a.m.</td>
                <td className="num">{c.inicio ? `${data(c.inicio)} a ${data(c.vencimento)}` : `${c.prazoMeses} meses`}</td>
                <td className="dir num">{c.status === "ativo" ? <strong>{formatarBRL(c.saldoCentavos)}</strong> : "–"}</td>
                <td className="dir num">{c.status === "ativo" ? formatarBRL(c.disponivelCentavos) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Painel() {
  const painel = trpc.investidor.painel.useQuery();
  const contratos = painel.data?.contratos ?? [];
  const ativos = contratos.filter((c) => c.status === "ativo");
  const [modal, setModal] = useState<{ tipo: "deposito" | "saque"; contrato?: number } | null>(null);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const atual = contratos.find((c) => c.id === selecionado) ?? ativos[0] ?? contratos[0];

  const totais = useMemo(() => ({
    patrimonio: ativos.reduce((s, c) => s + c.saldoCentavos, 0),
    aportado: ativos.reduce((s, c) => s + c.principalCentavos, 0),
    disponivel: ativos.reduce((s, c) => s + c.disponivelCentavos, 0),
    juros30: ativos.reduce((s, c) => s + c.jurosProximoMesCentavos, 0),
    aguardando: contratos.filter((c) => c.status === "aguardando_aporte" || c.status === "aguardando_assinatura").reduce((s, c) => s + c.principalCentavos, 0),
  }), [contratos, ativos]);

  return (
    <AreaLogada
      titulo="Minha carteira"
      subtitulo="Todos os seus investimentos, depósitos e saques."
      acoes={
        <div className="acoes-inline">
          <button className="btn btn--ghost" onClick={() => setModal({ tipo: "saque" })}>Sacar</button>
          <button className="btn btn--primario" onClick={() => setModal({ tipo: "deposito" })}>Depositar</button>
        </div>
      }
    >
      <Seo titulo="Minha carteira" indexar={false} />
      <ProximoPasso temContrato={contratos.some((c) => c.status !== "cancelado")} />

      {painel.isLoading ? (
        <p className="carregando">Carregando…</p>
      ) : contratos.length === 0 ? (
        <section className="bloco">
          <Vazio titulo="Você ainda não tem investimentos">
            <p>Escolha uma oferta e faça a reserva. Quando o contrato for gerado e o depósito confirmado, você acompanha o rendimento do dia aqui.</p>
          </Vazio>
        </section>
      ) : (
        <>
          <dl className="resumo-carteira">
            <div className="resumo-carteira__dest"><dt>Patrimônio investido hoje</dt><dd className="num">{formatarBRL(totais.patrimonio)}</dd><small>{ativos.length} {ativos.length === 1 ? "contrato ativo" : "contratos ativos"}</small></div>
            <div><dt>Total aportado</dt><dd className="num">{formatarBRL(totais.aportado)}</dd></div>
            <div><dt>Rendimento disponível</dt><dd className="num">{formatarBRL(totais.disponivel)}</dd><small>saque em D+{painel.data?.prazoResgateDias ?? 7}</small></div>
            <div><dt>Juros nos próximos 30 dias</dt><dd className="num">{formatarBRL(totais.juros30)}</dd></div>
            {totais.aguardando > 0 && <div><dt>Aguardando aporte</dt><dd className="num">{formatarBRL(totais.aguardando)}</dd></div>}
          </dl>

          <MeusInvestimentos contratos={contratos} selecionado={atual?.id ?? null} onSelecionar={setSelecionado} />

          {painel.data && atual && (
            atual.status === "ativo" ? (
              <ContratoAtivo key={atual.id} c={atual} painel={painel.data} />
            ) : atual.status === "aguardando_assinatura" || atual.status === "aguardando_aporte" ? (
              <ContratoPendente c={atual} onDepositar={() => setModal({ tipo: "deposito", contrato: atual.id })} />
            ) : (
              <ContratoEncerrado c={atual} />
            )
          )}
        </>
      )}

      <section className="bloco">
        <div className="bloco__cab"><h2>Movimentações</h2><span className="bloco__det">depósitos e saques</span></div>
        <TabelaMovimentacoes />
      </section>

      <MinhasReservas />

      <section className="bloco bloco--duas">
        <div>
          <h2>Quem está por trás</h2>
          <p className="bloco__nota" style={{ marginTop: 8 }}>O RioRendeFácil é a tecnologia. A Rio compra e vende os grãos, o emissor parceiro estrutura a oferta e os recursos ficam em conta vinculada, nunca na plataforma.</p>
        </div>
        <SeloEmissor />
      </section>

      {modal?.tipo === "deposito" && <ModalDeposito contratoInicial={modal.contrato} onFechar={() => setModal(null)} />}
      {modal?.tipo === "saque" && painel.data && <ModalSaque painel={painel.data} contratoInicial={modal.contrato ?? (atual?.status === "ativo" ? atual.id : undefined)} onFechar={() => setModal(null)} />}
    </AreaLogada>
  );
}
