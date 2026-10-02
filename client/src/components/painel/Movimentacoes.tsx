import { useEffect, useState } from "react";
import { trpc, type Saidas } from "@/lib/trpc";
import { formatarBRL, formatarPct } from "~shared/finance";
import { RESGATE_ANTECIPADO } from "~shared/lastroGraos";

type Painel = Saidas["investidor"]["painel"];
export type ContratoPainel = Painel["contratos"][number];

export const dataBR = (iso: string | Date | null | undefined) =>
  iso ? new Date(typeof iso === "string" && iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "–";
const reais = (s: string) => Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100) || 0;
const hojeIso = () => new Date().toISOString().slice(0, 10);

async function sha256Arquivo(f: File) {
  const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function useRecarregarCarteira() {
  const utils = trpc.useUtils();
  return () => {
    void utils.investidor.painel.invalidate();
    void utils.investidor.movimentacoes.invalidate();
    void utils.investidor.dadosDeposito.invalidate();
    void utils.investidor.extrato.invalidate();
    void utils.investidor.resgates.invalidate();
  };
}

/** Janela sobreposta acessível (fecha com Esc e clique fora). */
export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div className="modal-fundo" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal__cab">
          <h2>{titulo}</h2>
          <button className="btn btn--ghost btn--peq" onClick={onFechar} aria-label="Fechar">Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Copiar({ valor }: { valor: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="copiar"
      onClick={() => { void navigator.clipboard?.writeText(valor); setOk(true); setTimeout(() => setOk(false), 1500); }}
    >
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

// ─── Depósito ────────────────────────────────────────────────────────────────

export function ModalDeposito({ onFechar, contratoInicial }: { onFechar: () => void; contratoInicial?: number }) {
  const recarregar = useRecarregarCarteira();
  const dados = trpc.investidor.dadosDeposito.useQuery();
  const preparar = trpc.investidor.prepararComprovante.useMutation();
  const informar = trpc.investidor.informarDeposito.useMutation({ onSuccess: recarregar });
  const abertos = (dados.data?.contratos ?? []).filter((c) => !c.depositoInformado);
  const [contratoId, setContratoId] = useState<number | null>(contratoInicial ?? null);
  const c = abertos.find((x) => x.id === contratoId) ?? abertos[0];
  const [valor, setValor] = useState("");
  const [dataDep, setDataDep] = useState(hojeIso());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  useEffect(() => { if (c) setValor((c.principalCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })); }, [c?.id]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    let comprovante: { chave: string; sha256: string; tamanhoBytes: number } | undefined;
    try {
      if (arquivo) {
        setEstado("Enviando comprovante…");
        const sha = await sha256Arquivo(arquivo);
        const { chave, url } = await preparar.mutateAsync({ contratoId: c.id, nomeArquivo: arquivo.name, contentType: arquivo.type, tamanho: arquivo.size });
        const r = await fetch(url, { method: "PUT", body: arquivo, headers: { "Content-Type": arquivo.type } });
        if (!r.ok) throw new Error("Falha no envio do comprovante.");
        comprovante = { chave, sha256: sha, tamanhoBytes: arquivo.size };
      }
      setEstado(null);
      informar.mutate({ contratoId: c.id, valorCentavos: reais(valor), dataDeposito: dataDep, comprovante });
    } catch (err) {
      setEstado((err as Error).message);
    }
  }

  const conta = dados.data?.conta;
  return (
    <Modal titulo="Depositar" onFechar={onFechar}>
      {!dados.data ? (
        <p className="carregando">Carregando…</p>
      ) : informar.isSuccess ? (
        <div className="aviso aviso--ok">
          Depósito informado. A equipe confere na conta vinculada e ativa o contrato; o rendimento conta a partir da data do depósito.
          {informar.data.aviso && <><br />{informar.data.aviso}</>}
        </div>
      ) : !dados.data.habilitado ? (
        <p className="bloco__nota">Depósitos abrem quando o emissor parceiro e a conta vinculada estiverem configurados na plataforma.</p>
      ) : !c ? (
        <p className="bloco__nota">
          Nenhum contrato aguardando aporte. O depósito é feito depois que o contrato é gerado e assinado a partir da sua reserva.
        </p>
      ) : (
        <form className="deposito" onSubmit={enviar}>
          {abertos.length > 1 && (
            <label className="campo-form">Contrato
              <select value={c.id} onChange={(e) => setContratoId(Number(e.target.value))}>
                {abertos.map((x) => <option key={x.id} value={x.id}>#{x.id} · {x.codigo ?? x.oferta} · {formatarBRL(x.principalCentavos)}</option>)}
              </select>
            </label>
          )}
          <div className="deposito__valor">
            <span>Valor do aporte</span>
            <strong className="num">{formatarBRL(c.principalCentavos)}</strong>
            <small>Contrato #{c.id} · {c.oferta} · {formatarPct(c.taxaMensal)} a.m. · {c.prazoMeses} meses</small>
          </div>
          <dl className="deposito__conta">
            <div><dt>Favorecido</dt><dd>{conta?.favorecido ?? "–"}{conta?.documento ? <small>{conta.documento}</small> : null}</dd></div>
            {conta?.pix && <div><dt>Pix</dt><dd className="num">{conta.pix} <Copiar valor={conta.pix} /></dd></div>}
            {conta?.conta && (
              <div><dt>Transferência</dt><dd className="num">Banco {conta.banco} · ag. {conta.agencia} · conta {conta.conta} <Copiar valor={`${conta.banco} ${conta.agencia} ${conta.conta}`} /></dd></div>
            )}
          </dl>
          <p className="bloco__nota">Transfira de uma conta no seu nome e CPF. O dinheiro vai direto para a conta vinculada da oferta, nunca para a plataforma.</p>
          <div className="deposito__form">
            <label className="campo-form">Valor depositado (R$)
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" required />
            </label>
            <label className="campo-form">Data do depósito
              <input type="date" value={dataDep} max={hojeIso()} onChange={(e) => setDataDep(e.target.value)} required />
            </label>
          </div>
          {dados.data.comprovantes ? (
            <label className="campo-form">Comprovante (PDF ou imagem, opcional)
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <p className="bloco__nota">Se quiser, envie o comprovante pelo WhatsApp ou e-mail do seu especialista.</p>
          )}
          {(estado || informar.error) && <p className="aviso aviso--erro">{estado ?? informar.error?.message}</p>}
          <button className="btn btn--primario btn--largo" disabled={informar.isPending || !reais(valor)}>
            {informar.isPending ? "Enviando…" : "Já depositei, avisar a equipe"}
          </button>
        </form>
      )}
    </Modal>
  );
}

// ─── Saque ───────────────────────────────────────────────────────────────────

export function FormResgate({ c, habilitado, previsto, onFeito }: { c: ContratoPainel; habilitado: boolean; previsto: string; onFeito: () => void }) {
  const [valor, setValor] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  const centavos = reais(valor);
  const valido = centavos > 0 && centavos <= c.disponivelCentavos;
  const previa = trpc.investidor.previaResgate.useQuery({ contratoId: c.id, valorCentavos: centavos }, { enabled: valido });
  const pedir = trpc.investidor.solicitarResgate.useMutation({ onSuccess: onFeito });

  if (!habilitado) return <p className="bloco__nota">Saques abrem quando o emissor parceiro estiver habilitado na plataforma.</p>;
  if (c.saquePrincipal) return <p className="bloco__nota">Há um saque do principal em andamento neste contrato. Ele já inclui o rendimento.</p>;
  if (pedir.isSuccess) {
    return <p className="aviso aviso--ok">Pedido enviado. Previsão de pagamento: {dataBR(pedir.data.previstoPara)}, valor líquido {formatarBRL(pedir.data.liquidoCentavos)}.</p>;
  }
  return (
    <form className="resgate" onSubmit={(e) => { e.preventDefault(); if (valido) pedir.mutate({ contratoId: c.id, valorCentavos: centavos, idempotencyKey: chave }); }}>
      <label className="campo-form">
        Valor bruto a sacar
        <div className="resgate__linha">
          <span>R$</span>
          <input value={valor} inputMode="decimal" placeholder="0,00" onChange={(e) => setValor(e.target.value)} aria-describedby={`resgate-max-${c.id}`} />
          <button type="button" className="btn btn--ghost btn--peq" onClick={() => setValor((c.disponivelCentavos / 100).toFixed(2).replace(".", ","))}>Tudo</button>
        </div>
      </label>
      <span id={`resgate-max-${c.id}`} className="bloco__nota">Rendimento disponível: {formatarBRL(c.disponivelCentavos)}</span>
      {centavos > c.disponivelCentavos && <p className="aviso aviso--erro">Acima do disponível.</p>}
      {valido && previa.data && (
        <dl className="resgate__previa">
          <div><dt>IR retido ({formatarPct(previa.data.aliquota, 1)})</dt><dd className="num">− {formatarBRL(previa.data.irCentavos)}</dd></div>
          <div><dt>Você recebe</dt><dd className="num"><strong>{formatarBRL(previa.data.liquidoCentavos)}</strong></dd></div>
          <div><dt>Previsão</dt><dd>{dataBR(previsto)}</dd></div>
        </dl>
      )}
      {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
      <button className="btn btn--primario" disabled={!valido || pedir.isPending}>{pedir.isPending ? "Enviando…" : "Sacar rendimento"}</button>
    </form>
  );
}

export function SaquePrincipal({ c, habilitado, onFeito }: { c: ContratoPainel; habilitado: boolean; onFeito: () => void }) {
  const previa = trpc.investidor.previaSaquePrincipal.useQuery({ contratoId: c.id }, { enabled: habilitado && !c.saquePrincipal });
  const pedir = trpc.investidor.solicitarSaquePrincipal.useMutation({ onSuccess: onFeito });
  const [ciente, setCiente] = useState(false);

  if (!habilitado) return <p className="bloco__nota">Saques abrem quando o emissor parceiro estiver habilitado na plataforma.</p>;
  if (c.saquePrincipal) {
    const s = c.saquePrincipal;
    return (
      <p className="aviso aviso--ok">
        Saque do principal {s.status === "aprovado" ? "aprovado" : "solicitado"}: {formatarBRL(s.liquidoCentavos)} líquidos, previsto para {dataBR(s.previstoPara)}.
      </p>
    );
  }
  if (pedir.isSuccess) return <p className="aviso aviso--ok">Pedido enviado. Previsão de pagamento: {dataBR(pedir.data.previstoPara)}.</p>;
  if (!previa.data) return <p className="carregando">Calculando…</p>;
  const p = previa.data;
  const antecipado = p.tipo === "antecipado";
  return (
    <div className="saque-principal">
      <p className={`aviso ${antecipado ? "aviso--alerta" : "aviso--ok"}`}>
        {antecipado
          ? `Resgate antecipado: você está há ${p.dias} dias no contrato, antes do vencimento. ${p.regra}`
          : "Contrato no vencimento: a Rio recompra os títulos e você recebe o saldo inteiro."}
      </p>
      <dl className="resgate__previa">
        <div><dt>Saldo hoje (principal + juros não sacados)</dt><dd className="num">{formatarBRL(p.saldoCentavos)}</dd></div>
        {p.rendimentoSacadoCentavos > 0 && <div><dt>Juros já sacados (descontados)</dt><dd className="num">{formatarBRL(p.rendimentoSacadoCentavos)}</dd></div>}
        {antecipado && <div><dt>Penalidade</dt><dd className="num">− {formatarBRL(p.penalidadeCentavos)}</dd></div>}
        <div><dt>Valor bruto do saque</dt><dd className="num">{formatarBRL(p.brutoCentavos)}</dd></div>
        <div><dt>IR retido ({formatarPct(p.aliquotaIR, 1)})</dt><dd className="num">− {formatarBRL(p.irCentavos)}</dd></div>
        <div><dt>Você recebe</dt><dd className="num"><strong>{formatarBRL(p.liquidoCentavos)}</strong></dd></div>
        <div><dt>Previsão</dt><dd>{dataBR(p.previstoPara)} ({antecipado ? `D+${RESGATE_ANTECIPADO.liquidacaoDias}` : `D+${p.prazoPagamentoDias}`})</dd></div>
      </dl>
      <label className="cad-declaracao">
        <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
        <span>
          {antecipado
            ? "Entendo que estou saindo antes do vencimento, com a penalidade acima, e que o contrato será encerrado quando o pagamento for feito."
            : "Confirmo o saque do principal e o encerramento do contrato."}
        </span>
      </label>
      {pedir.error && <p className="aviso aviso--erro">{pedir.error.message}</p>}
      <button className="btn btn--primario" disabled={!ciente || pedir.isPending} onClick={() => pedir.mutate({ contratoId: c.id, ciente: true })}>
        {pedir.isPending ? "Enviando…" : antecipado ? "Pedir resgate antecipado" : "Sacar principal"}
      </button>
    </div>
  );
}

/** Sacar: escolhe o contrato e o tipo (rendimento ou principal). */
export function PainelSaque({ c, painel }: { c: ContratoPainel; painel: Painel }) {
  const recarregar = useRecarregarCarteira();
  const [tipo, setTipo] = useState<"rendimento" | "principal">("rendimento");
  return (
    <div className="saque">
      <div className="segmento" role="radiogroup" aria-label="O que sacar">
        <button type="button" role="radio" aria-checked={tipo === "rendimento"} className={tipo === "rendimento" ? "on" : ""} onClick={() => setTipo("rendimento")}>
          Rendimento <small>D+{painel.prazoResgateDias}</small>
        </button>
        <button type="button" role="radio" aria-checked={tipo === "principal"} className={tipo === "principal" ? "on" : ""} onClick={() => setTipo("principal")}>
          Principal <small>vencimento ou antecipado</small>
        </button>
      </div>
      {tipo === "rendimento" ? (
        <FormResgate c={c} habilitado={painel.resgateHabilitado} previsto={painel.pagamentoSePedirHoje} onFeito={recarregar} />
      ) : (
        <SaquePrincipal c={c} habilitado={painel.resgateHabilitado} onFeito={recarregar} />
      )}
    </div>
  );
}

export function ModalSaque({ painel, onFechar, contratoInicial }: { painel: Painel; onFechar: () => void; contratoInicial?: number }) {
  const ativos = painel.contratos.filter((c) => c.status === "ativo");
  const [id, setId] = useState<number | undefined>(contratoInicial ?? ativos[0]?.id);
  const c = ativos.find((x) => x.id === id) ?? ativos[0];
  return (
    <Modal titulo="Sacar" onFechar={onFechar}>
      {!c ? (
        <p className="bloco__nota">Você ainda não tem contrato ativo para sacar.</p>
      ) : (
        <>
          {ativos.length > 1 && (
            <label className="campo-form" style={{ marginBottom: 16 }}>Contrato
              <select value={c.id} onChange={(e) => setId(Number(e.target.value))}>
                {ativos.map((x) => <option key={x.id} value={x.id}>#{x.id} · {x.ofertaCodigo ?? x.oferta} · saldo {formatarBRL(x.saldoCentavos)}</option>)}
              </select>
            </label>
          )}
          <PainelSaque key={c.id} c={c} painel={painel} />
        </>
      )}
    </Modal>
  );
}

// ─── Movimentações ───────────────────────────────────────────────────────────

const CLASSE_MOV: Record<string, string> = { confirmado: "status--adimplente", pago: "status--adimplente", recusado: "status--atraso" };

export function TabelaMovimentacoes() {
  const movs = trpc.investidor.movimentacoes.useQuery();
  if (!movs.data?.length) return <p className="bloco__nota">Nenhuma movimentação ainda. Depósitos e saques aparecem aqui com o status de cada um.</p>;
  return (
    <div className="tabela-wrap">
      <table className="tabela">
        <thead><tr><th>Data</th><th>Movimentação</th><th className="dir">Valor</th><th className="dir">Líquido</th><th>Status</th></tr></thead>
        <tbody>
          {movs.data.map((m) => (
            <tr key={m.chave}>
              <td className="num">{dataBR(m.data)}</td>
              <td><strong>{m.rotulo}</strong><span className="sub">Contrato #{m.contratoId} · {m.oferta}{m.detalhe ? ` · ${m.detalhe}` : ""}</span></td>
              <td className={`dir num ${m.valorCentavos > 0 ? "pos-texto" : ""}`}>{m.valorCentavos > 0 ? "+" : "−"} {formatarBRL(Math.abs(m.valorCentavos))}</td>
              <td className="dir num">{formatarBRL(Math.abs(m.liquidoCentavos))}</td>
              <td>
                <span className={`status ${CLASSE_MOV[m.status] ?? "status--alerta"}`}>{m.statusRotulo}</span>
                {m.previstoPara && m.status !== "pago" && m.status !== "recusado" && <span className="sub">previsto {dataBR(m.previstoPara)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
