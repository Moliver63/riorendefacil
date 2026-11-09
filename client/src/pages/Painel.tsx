import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { SeloEmissor } from "@/components/landing/SiteLayout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct, taxaAnualEquivalente } from "~shared/finance";
import { formatarMoeda, MOEDA_ROTULO, SITUACAO_ROTULO, type SituacaoAplicacao } from "~shared/moeda";
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

function Extrato({ contratoId, moeda = "BRL" }: { contratoId: number; moeda?: string }) {
  const { data: linhas } = trpc.investidor.extrato.useQuery({ contratoId });
  if (!linhas?.length) return <p className="bloco__nota">Sem lançamentos.</p>;
  return (
    <ul className="extrato">
      {linhas.map((l, i) => (
        <li key={i} className={l.status === "recusado" ? "extrato--recusado" : ""}>
          <span className="extrato__data num">{data(l.data)}</span>
          <span className="extrato__desc">{l.descricao}</span>
          <span className={`extrato__valor num ${l.valorCentavos < 0 ? "neg" : "pos"}`}>{l.valorCentavos < 0 ? "−" : "+"} {formatarMoeda(Math.abs(l.valorCentavos), moeda)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Rótulo da aplicação: número da CCB quando houver, senão o contrato. */
const rotuloAplicacao = (c: ContratoPainel) => (c.numeroCcb ? `CCB ${c.numeroCcb}` : `Contrato #${c.id}`);

const SITUACAO_CLASSE: Record<SituacaoAplicacao, string> = {
  ativa: "status--adimplente",
  vencida: "status--alerta",
  liquidada: "status--neutro",
  pendente: "status--alerta",
  cancelada: "status--atraso",
};

function Situacao({ c }: { c: ContratoPainel }) {
  const texto = c.saquePrincipal ? "Saque em andamento" : c.depositoInformado ? "Depósito em conferência" : SITUACAO_ROTULO[c.situacao];
  return <span className={`status ${SITUACAO_CLASSE[c.situacao]}`}>{texto}</span>;
}

/** Valor na moeda da aplicação e, se for dólar, o equivalente em reais logo abaixo. */
function Valor({ centavos, reais, moeda }: { centavos: number; reais: number | null; moeda: string }) {
  return (
    <>
      {formatarMoeda(centavos, moeda)}
      {moeda !== "BRL" && <span className="sub sub--conv">{reais !== null ? `≈ ${formatarBRL(reais)}` : "sem cotação"}</span>}
    </>
  );
}

function DocumentosDaAplicacao({ c }: { c: ContratoPainel }) {
  const baixar = trpc.investidor.baixarDocumento.useMutation({ onSuccess: (r) => window.open(r.url, "_blank", "noopener") });
  return (
    <div className="docs-aplicacao">
      <ul className="lista-docs">
        <li>
          <div><strong>Termo de adesão do contrato #{c.id}</strong><span className="sub">gerado pela plataforma, para leitura e impressão</span></div>
          <Link href={`/contrato/${c.id}`} className="btn btn--ghost btn--peq">Abrir</Link>
        </li>
        {c.documentos.map((d) => (
          <li key={d.id}>
            <div><strong>{d.titulo}</strong><span className="sub">{d.tipo}</span></div>
            <button className="btn btn--ghost btn--peq" onClick={() => baixar.mutate({ id: d.id })} disabled={baixar.isPending}>Baixar</button>
          </li>
        ))}
      </ul>
      {!c.documentos.length && <p className="bloco__nota">A CCB assinada e os demais documentos aparecem aqui assim que a equipe publicar.</p>}
      {baixar.error && <p className="aviso aviso--erro">{baixar.error.message}</p>}
      <Link href="/documentos" className="btn btn--ghost btn--peq">Todos os documentos</Link>
    </div>
  );
}

function ContratoAtivo({ c, painel }: { c: ContratoPainel; painel: Saidas["investidor"]["painel"] }) {
  type Aba = "evolucao" | "onde" | "resgate" | "extrato" | "documentos";
  const [aba, setAba] = useState<Aba>("evolucao");
  const abas: Aba[] = painel.modoConsulta ? ["evolucao", "onde", "extrato", "documentos"] : ["evolucao", "onde", "resgate", "extrato", "documentos"];
  const ROTULO_ABA: Record<Aba, string> = { evolucao: "Evolução", onde: "Onde está seu dinheiro", resgate: "Sacar", extrato: "Extrato", documentos: "Documentos" };
  const fm = (v: number) => formatarMoeda(v, c.moeda);
  return (
    <section className="bloco contrato">
      <div className="bloco__cab">
        <div>
          <h2>{rotuloAplicacao(c)}</h2>
          <span className="bloco__det">{c.emissora ? `${c.emissora} · ` : ""}{c.oferta}{c.numeroCcb ? ` · contrato #${c.id}` : ""}</span>
        </div>
        <Situacao c={c} />
      </div>

      <dl className="ficha-aplicacao">
        <div><dt>Valor inicial</dt><dd className="num">{fm(c.principalCentavos)}</dd></div>
        <div className="ficha-aplicacao__dest"><dt>Saldo atualizado</dt><dd className="num">{fm(c.saldoCentavos)}</dd>{c.moeda !== "BRL" && <small>{c.emReais.saldoCentavos !== null ? `≈ ${formatarBRL(c.emReais.saldoCentavos)}` : "sem cotação registrada"}</small>}</div>
        <div><dt>Rentabilidade acumulada</dt><dd className="num">{formatarPct(c.rentabilidadePct)}</dd><small>{fm(c.rendimentoTotalCentavos)} de rendimento</small></div>
        <div><dt>Rendimento disponível</dt><dd className="num">{fm(c.disponivelCentavos)}</dd><small>{painel.modoConsulta ? "saque com seu especialista" : `se pedir hoje, pago em ${data(painel.pagamentoSePedirHoje)}`}</small></div>
        <div><dt>Moeda</dt><dd>{MOEDA_ROTULO[c.moeda]}</dd></div>
        <div><dt>Taxa contratada</dt><dd className="num">{formatarPct(c.taxaMensal)} a.m.</dd><small>{formatarPct(taxaAnualEquivalente(c.taxaMensal))} a.a. equivalente</small></div>
        <div><dt>Emissão</dt><dd className="num">{data(c.inicio)}</dd></div>
        <div><dt>Vencimento</dt><dd className="num">{data(c.vencimento)}</dd><small>{c.prazoMeses} meses</small></div>
      </dl>
      {c.moeda !== "BRL" && <CotacaoUsada cotacao={painel.cotacao} />}

      <div className="abas" role="tablist">
        {abas.map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? "on" : ""} onClick={() => setAba(a)}>
            {ROTULO_ABA[a]}
          </button>
        ))}
      </div>
      {aba === "onde" && (
        <>
          <BarraAlocacao
            titulo="Sua parte proporcional nas operações da oferta, hoje (em reais)"
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
          moeda={c.moeda}
        />
      )}
      {aba === "resgate" && <PainelSaque c={c} painel={painel} />}
      {aba === "extrato" && <Extrato contratoId={c.id} moeda={c.moeda} />}
      {aba === "documentos" && <DocumentosDaAplicacao c={c} />}
    </section>
  );
}

function CotacaoUsada({ cotacao }: { cotacao: Saidas["investidor"]["painel"]["cotacao"] }) {
  if (!cotacao) return <p className="cotacao-nota">Conversão para reais indisponível: a equipe ainda não registrou a cotação do dólar.</p>;
  return (
    <p className="cotacao-nota">
      Conversão para reais: US$ 1 = <strong className="num">{cotacao.valor.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong> em {data(cotacao.data)} · {cotacao.fonte}
    </p>
  );
}

const STATUS_CLASSE: Record<string, string> = {
  ativo: "status--adimplente",
  liquidado: "status--neutro",
  cancelado: "status--atraso",
  aguardando_assinatura: "status--alerta",
  aguardando_aporte: "status--alerta",
};

function ContratoPendente({ c, onDepositar }: { c: ContratoPainel; onDepositar?: () => void }) {
  return (
    <section className="bloco bloco--pendente">
      <div className="bloco__cab">
        <div>
          <h2>{rotuloAplicacao(c)} · {formatarMoeda(c.principalCentavos, c.moeda)}</h2>
          <span className="bloco__det">{formatarPct(c.taxaMensal)} a.m. · {c.prazoMeses} meses · {c.oferta}</span>
        </div>
        <span className={`status ${STATUS_CLASSE[c.status] ?? ""}`}>{c.statusRotulo}</span>
      </div>
      <p className="bloco__nota">
        {c.status === "aguardando_assinatura"
          ? "Leia o contrato com calma. A assinatura é feita com o especialista."
          : c.depositoInformado
            ? `Depósito de ${formatarMoeda(c.depositoInformado.valorCentavos, c.moeda)} informado em ${data(c.depositoInformado.dataDeposito)}. A equipe está conferindo na conta vinculada.`
            : onDepositar
              ? "Contrato assinado. Faça o depósito na conta vinculada e avise por aqui; o rendimento conta a partir da data do depósito."
              : "Contrato assinado. Seu especialista envia os dados da conta vinculada; o rendimento conta a partir da data do depósito."}
      </p>
      <div className="acoes-inline">
        <Link href={`/contrato/${c.id}`} className="btn btn--ghost btn--peq">Ler o contrato</Link>
        {c.status === "aguardando_aporte" && !c.depositoInformado && onDepositar && <button className="btn btn--primario btn--peq" onClick={onDepositar}>Depositar</button>}
      </div>
    </section>
  );
}

function ContratoEncerrado({ c }: { c: ContratoPainel }) {
  return (
    <section className="bloco">
      <div className="bloco__cab">
        <div>
          <h2>{rotuloAplicacao(c)}</h2>
          <span className="bloco__det">{c.oferta} · {formatarMoeda(c.principalCentavos, c.moeda)} · {formatarPct(c.taxaMensal)} a.m.{c.inicio ? ` · ${data(c.inicio)} a ${data(c.vencimento)}` : ""}</span>
        </div>
        <Situacao c={c} />
      </div>
      <p className="bloco__nota">{c.status === "liquidado" ? "Aplicação liquidada com o pagamento do principal. O histórico está nas movimentações." : "Contrato cancelado antes do aporte."}</p>
      {c.status === "liquidado" && <Extrato contratoId={c.id} moeda={c.moeda} />}
    </section>
  );
}

/** Todas as aplicações numa tabela; a linha escolhida abre o detalhe logo abaixo. */
function MinhasAplicacoes({ contratos, selecionado, onSelecionar }: { contratos: ContratoPainel[]; selecionado: number | null; onSelecionar: (id: number) => void }) {
  return (
    <section className="bloco">
      <div className="bloco__cab"><h2>Minhas aplicações</h2><span className="bloco__det">{contratos.length} {contratos.length === 1 ? "aplicação" : "aplicações"}</span></div>
      <div className="tabela-wrap">
        <table className="tabela tabela--invest">
          <thead><tr><th>Aplicação</th><th>Situação</th><th className="dir">Valor inicial</th><th className="dir">Taxa</th><th>Emissão e vencimento</th><th className="dir">Saldo atualizado</th><th className="dir">Rentabilidade</th></tr></thead>
          <tbody>
            {contratos.map((c) => {
              const rende = c.status === "ativo";
              return (
                <tr key={c.id} className={selecionado === c.id ? "selecionada" : ""} onClick={() => onSelecionar(c.id)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelecionar(c.id)} aria-selected={selecionado === c.id}>
                  <td><strong>{rotuloAplicacao(c)}</strong><span className="sub">{c.moeda} · {c.emissora ?? c.oferta}</span></td>
                  <td><Situacao c={c} /></td>
                  <td className="dir num"><Valor centavos={c.principalCentavos} reais={c.emReais.principalCentavos} moeda={c.moeda} /></td>
                  <td className="dir num">{formatarPct(c.taxaMensal)} a.m.</td>
                  <td className="num">{c.inicio ? `${data(c.inicio)} a ${data(c.vencimento)}` : `${c.prazoMeses} meses`}</td>
                  <td className="dir num">{rende ? <strong><Valor centavos={c.saldoCentavos} reais={c.emReais.saldoCentavos} moeda={c.moeda} /></strong> : "–"}</td>
                  <td className="dir num">{rende ? <span className="pos-texto">+{formatarPct(c.rentabilidadePct)}</span> : "–"}</td>
                </tr>
              );
            })}
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

  // tudo em reais: aplicações em dólar entram pela cotação do painel; sem cotação ficam de fora e o aviso aparece
  const totais = useMemo(() => {
    const soma = (lista: ContratoPainel[], f: (c: ContratoPainel) => number | null) => lista.reduce((s, c) => s + (f(c) ?? 0), 0);
    const pendentes = contratos.filter((c) => c.status === "aguardando_aporte" || c.status === "aguardando_assinatura");
    const investido = soma(ativos, (c) => c.emReais.principalCentavos);
    const rendimento = soma(ativos, (c) => c.emReais.rendimentoCentavos);
    return {
      investido,
      saldo: soma(ativos, (c) => c.emReais.saldoCentavos),
      rendimento,
      rentabilidade: investido > 0 ? rendimento / investido : 0,
      disponivel: soma(ativos, (c) => c.emReais.disponivelCentavos),
      juros30: soma(ativos, (c) => c.emReais.jurosProximoMesCentavos),
      aguardando: soma(pendentes, (c) => c.emReais.principalCentavos),
      temDolar: contratos.some((c) => c.moeda !== "BRL" && c.status !== "cancelado"),
      semCotacao: ativos.some((c) => c.emReais.saldoCentavos === null),
    };
  }, [contratos, ativos]);
  const consulta = painel.data?.modoConsulta ?? false;

  return (
    <AreaLogada
      titulo="Minha carteira"
      subtitulo={consulta ? "Quanto você aplicou, quanto tem hoje e quanto rendeu, em cada CCB." : "Suas aplicações, depósitos e saques."}
      acoes={
        consulta ? undefined : (
          <div className="acoes-inline">
            <button className="btn btn--ghost" onClick={() => setModal({ tipo: "saque" })}>Sacar</button>
            <button className="btn btn--primario" onClick={() => setModal({ tipo: "deposito" })}>Depositar</button>
          </div>
        )
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
          <section className="saldo-hero" aria-label="Resumo da carteira">
            <div className="saldo-hero__principal">
              <span>Saldo atualizado</span>
              <strong className="num">{formatarBRL(totais.saldo)}</strong>
              <small>{ativos.length} {ativos.length === 1 ? "aplicação ativa" : "aplicações ativas"} · atualizado em {data(painel.data?.hoje)}</small>
            </div>
            <dl className="saldo-hero__cards">
              <div><dt>Total investido</dt><dd className="num">{formatarBRL(totais.investido)}</dd></div>
              <div><dt>Rendimento</dt><dd className="num">{formatarBRL(totais.rendimento)}</dd></div>
              <div><dt>Rentabilidade acumulada</dt><dd className="num saldo-hero__pct">+{formatarPct(totais.rentabilidade)}</dd></div>
            </dl>
          </section>
          <dl className="resumo-carteira resumo-carteira--sec">
            <div><dt>Rendimento disponível</dt><dd className="num">{formatarBRL(totais.disponivel)}</dd><small>{consulta ? "saque com seu especialista" : `saque em D+${painel.data?.prazoResgateDias ?? 7}`}</small></div>
            <div><dt>Juros nos próximos 30 dias</dt><dd className="num">{formatarBRL(totais.juros30)}</dd></div>
            {totais.aguardando > 0 && <div><dt>Aguardando aporte</dt><dd className="num">{formatarBRL(totais.aguardando)}</dd></div>}
          </dl>
          {totais.temDolar && <CotacaoUsada cotacao={painel.data?.cotacao ?? null} />}
          {totais.semCotacao && <p className="aviso aviso--alerta">As aplicações em dólar ficaram fora dos totais em reais até a cotação ser registrada.</p>}

          <MinhasAplicacoes contratos={contratos} selecionado={atual?.id ?? null} onSelecionar={setSelecionado} />

          {painel.data && atual && (
            atual.status === "ativo" ? (
              <ContratoAtivo key={atual.id} c={atual} painel={painel.data} />
            ) : atual.status === "aguardando_assinatura" || atual.status === "aguardando_aporte" ? (
              <ContratoPendente c={atual} onDepositar={consulta ? undefined : () => setModal({ tipo: "deposito", contrato: atual.id })} />
            ) : (
              <ContratoEncerrado c={atual} />
            )
          )}
        </>
      )}

      <section className="bloco">
        <div className="bloco__cab"><h2>Movimentações</h2><span className="bloco__det">{consulta ? "histórico registrado pela equipe" : "depósitos e saques"}</span></div>
        <TabelaMovimentacoes />
      </section>

      {!consulta && <MinhasReservas />}

      <section className="bloco bloco--duas">
        <div>
          <h2>Quem está por trás</h2>
          <p className="bloco__nota" style={{ marginTop: 8 }}>O CCB Rio Bank é a tecnologia. A Rio compra e vende os grãos, o emissor parceiro estrutura a oferta e os recursos ficam em conta vinculada, nunca na plataforma.</p>
        </div>
        <SeloEmissor />
      </section>

      {modal?.tipo === "deposito" && <ModalDeposito contratoInicial={modal.contrato} onFechar={() => setModal(null)} />}
      {modal?.tipo === "saque" && painel.data && <ModalSaque painel={painel.data} contratoInicial={modal.contrato ?? (atual?.status === "ativo" ? atual.id : undefined)} onFechar={() => setModal(null)} />}
    </AreaLogada>
  );
}
