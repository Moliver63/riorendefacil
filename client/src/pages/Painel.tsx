import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { SeloEmissor } from "@/components/landing/SiteLayout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";
import { BarraAlocacao, type ChaveFatia } from "@/components/oferta/Ficha";
import { EvolucaoPatrimonio } from "@/components/painel/EvolucaoPatrimonio";

type ContratoPainel = Saidas["investidor"]["painel"]["contratos"][number];

const data = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "a definir");

/** Próximo passo do onboarding: trilha → perfil → cadastro → conversa. */
function ProximoPasso({ temContrato }: { temContrato: boolean }) {
  const perfil = trpc.investidor.perfil.useQuery();
  const trilha = trpc.trilha.estado.useQuery();
  if (!perfil.data || !trilha.data || temContrato) return null;

  const feitos = trilha.data.modulos.filter((m) => m.concluido).length;
  const passos = [
    { feito: trilha.data.completa, titulo: "Trilha Antes de investir", det: `${feitos} de ${trilha.data.modulos.length} módulos`, href: "/trilha" },
    { feito: perfil.data.suitability !== "nao_avaliado", titulo: "Questionário de perfil", det: "5 perguntas", href: "/perfil" },
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

function FormResgate({ c, habilitado, previsto, onFeito }: { c: ContratoPainel; habilitado: boolean; previsto: string; onFeito: () => void }) {
  const [valor, setValor] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const centavos = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const valido = centavos > 0 && centavos <= c.disponivelCentavos;
  const previa = trpc.investidor.previaResgate.useQuery({ contratoId: c.id, valorCentavos: centavos }, { enabled: valido });
  const pedir = trpc.investidor.solicitarResgate.useMutation({ onSuccess: onFeito });

  if (!habilitado) return <p className="bloco__nota">Resgates abrem quando o emissor parceiro estiver habilitado na plataforma.</p>;
  if (pedir.isSuccess) {
    return <p className="aviso aviso--ok">Pedido enviado. Previsão de pagamento: {data(pedir.data.previstoPara)}, valor líquido {formatarBRL(pedir.data.liquidoCentavos)}.</p>;
  }
  return (
    <form className="resgate" onSubmit={(e) => { e.preventDefault(); if (valido) pedir.mutate({ contratoId: c.id, valorCentavos: centavos, idempotencyKey: chave }); }}>
      <label className="campo-form">
        Valor bruto a resgatar
        <div className="resgate__linha">
          <span>R$</span>
          <input value={valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setValor(e.target.value)} aria-describedby="resgate-max" />
          <button type="button" className="btn btn--ghost btn--peq" onClick={() => setValor((c.disponivelCentavos / 100).toFixed(2).replace(".", ","))}>Tudo</button>
        </div>
      </label>
      <span id="resgate-max" className="bloco__nota">Disponível: {formatarBRL(c.disponivelCentavos)}</span>
      {centavos > c.disponivelCentavos && <p className="aviso aviso--erro">Acima do disponível.</p>}
      {valido && previa.data && (
        <dl className="resgate__previa">
          <div><dt>IR retido ({formatarPct(previa.data.aliquota, 1)})</dt><dd className="num">− {formatarBRL(previa.data.irCentavos)}</dd></div>
          <div><dt>Você recebe</dt><dd className="num"><strong>{formatarBRL(previa.data.liquidoCentavos)}</strong></dd></div>
          <div><dt>Previsão</dt><dd>{data(previsto)}</dd></div>
        </dl>
      )}
      {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
      <button className="btn btn--primario" disabled={!valido || pedir.isPending}>{pedir.isPending ? "Enviando…" : "Pedir resgate"}</button>
    </form>
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
  const utils = trpc.useUtils();
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
            {a === "onde" ? "Onde está seu dinheiro" : a === "evolucao" ? "Evolução" : a === "resgate" ? "Pedir resgate" : "Extrato"}
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
      {aba === "resgate" && (
        <FormResgate c={c} habilitado={painel.resgateHabilitado} previsto={painel.pagamentoSePedirHoje}
          onFeito={() => { void utils.investidor.painel.invalidate(); void utils.investidor.extrato.invalidate(); void utils.investidor.resgates.invalidate(); }} />
      )}
      {aba === "extrato" && <Extrato contratoId={c.id} />}
    </section>
  );
}

const STATUS_CLASSE: Record<string, string> = { ativo: "status--adimplente", cancelado: "status--atraso", aguardando_assinatura: "status--alerta", aguardando_aporte: "status--alerta" };

export default function Painel() {
  const painel = trpc.investidor.painel.useQuery();
  const contratos = painel.data?.contratos ?? [];
  const ativos = contratos.filter((c) => c.status === "ativo");
  const pendentes = contratos.filter((c) => c.status === "aguardando_assinatura" || c.status === "aguardando_aporte");
  const totais = useMemo(() => ({
    aportado: ativos.reduce((s, c) => s + c.principalCentavos, 0),
    disponivel: ativos.reduce((s, c) => s + c.disponivelCentavos, 0),
  }), [ativos]);

  return (
    <AreaLogada titulo="Minha carteira" subtitulo={ativos.length > 1 ? `${ativos.length} contratos ativos · ${formatarBRL(totais.aportado)} aportado · ${formatarBRL(totais.disponivel)} disponível` : "Contratos, rendimento e onde está o seu dinheiro."}>
      <Seo titulo="Minha carteira" indexar={false} />
      <ProximoPasso temContrato={contratos.some((c) => c.status !== "cancelado")} />

      {pendentes.map((c) => (
        <section key={c.id} className="bloco bloco--pendente">
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
              : "Contrato assinado. Assim que o aporte for confirmado na conta vinculada do emissor, o rendimento começa a contar."}
          </p>
          <Link href={`/contrato/${c.id}`} className="btn btn--primario btn--peq" style={{ marginTop: 12 }}>Ler o contrato</Link>
        </section>
      ))}

      {painel.isLoading ? <p className="carregando">Carregando…</p> : ativos.length === 0 && pendentes.length === 0 ? (
        <section className="bloco">
          <Vazio titulo="Você ainda não tem contratos">
            <p>Quando um contrato for gerado para você, ele aparece aqui. Depois do aporte confirmado, você acompanha o rendimento do dia.</p>
          </Vazio>
        </section>
      ) : null}

      {painel.data && ativos.map((c) => <ContratoAtivo key={c.id} c={c} painel={painel.data!} />)}

      <MinhasReservas />

      <section className="bloco bloco--duas">
        <div>
          <h2>Quem está por trás</h2>
          <p className="bloco__nota" style={{ marginTop: 8 }}>O RioRendeFácil é a tecnologia. A Rio compra e vende os grãos, o emissor parceiro estrutura a oferta e os recursos ficam em conta vinculada, nunca na plataforma.</p>
        </div>
        <SeloEmissor />
      </section>
    </AreaLogada>
  );
}
