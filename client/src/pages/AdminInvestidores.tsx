import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { Seo } from "@/components/SEO";
import { trpc } from "@/lib/trpc";
import { formatarBRL, formatarPct, tetoDaFaixa, type Faixa } from "~shared/finance";
import { formatarCpf } from "~shared/cadastro";
import { PRAZOS_CONTRATO } from "~shared/lastroGraos";

const data = (iso: string | Date | null | undefined) => (iso ? new Date(typeof iso === "string" && iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "–");
const reais = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) || 0;

async function sha256Arquivo(f: File) {
  const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Envia arquivo ao R2 e registra no cofre. Devolve a chave (para comprovantes). */
export function EnviarArquivo({ escopo, escopoId, tipo, rotulo, onEnviado }: { escopo: "investidor" | "contrato" | "operacao"; escopoId: number; tipo: string; rotulo: string; onEnviado?: (chave: string) => void }) {
  const preparar = trpc.admin.documentos.prepararEnvio.useMutation();
  const registrar = trpc.admin.documentos.registrar.useMutation();
  const [estado, setEstado] = useState<string | null>(null);
  async function enviar(f: File) {
    try {
      setEstado("Enviando…");
      const hash = await sha256Arquivo(f);
      const { chave, url } = await preparar.mutateAsync({ escopo, escopoId, nomeArquivo: f.name, contentType: f.type, tamanho: f.size });
      const r = await fetch(url, { method: "PUT", body: f, headers: { "Content-Type": f.type } });
      if (!r.ok) throw new Error("Falha no envio para o armazenamento.");
      await registrar.mutateAsync({ escopo, escopoId, tipo, titulo: `${rotulo} (${f.name})`, chave, sha256: hash, tamanhoBytes: f.size });
      setEstado(escopo === "operacao" ? "Enviado e registrado." : "Enviado e disponível no cofre do investidor.");
      onEnviado?.(chave);
    } catch (e) {
      setEstado((e as Error).message);
    }
  }
  return (
    <label className="upload">
      <span>{rotulo}</span>
      <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && void enviar(e.target.files[0])} />
      {estado && <small>{estado}</small>}
    </label>
  );
}

type ReservaSel = { id: number; ofertaId: number; valorCentavos: number; prazoMeses: number };

function NovoContrato({ investidorId, apto, motivo, reserva }: { investidorId: number; apto: boolean; motivo: string | null; reserva?: ReservaSel }) {
  const utils = trpc.useUtils();
  const ofertas = trpc.admin.ofertas.listar.useQuery();
  const ativas = (ofertas.data ?? []).filter((o) => o.ativa);
  const [ofertaId, setOfertaId] = useState<number | "">(reserva?.ofertaId ?? "");
  const [valor, setValor] = useState(reserva ? (reserva.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [prazo, setPrazo] = useState(String(reserva?.prazoMeses ?? 12));
  const [obs, setObs] = useState("");
  const criar = trpc.admin.contratos.criar.useMutation({ onSuccess: () => { setValor(""); setObs(""); void utils.admin.investidores.detalhe.invalidate(); void utils.admin.investidores.listar.invalidate(); } });

  const oferta = ativas.find((o) => o.id === ofertaId) ?? ativas[0];
  const centavos = reais(valor);
  const taxa = oferta && centavos ? tetoDaFaixa(oferta.faixas as Faixa[], centavos, Number(prazo)) : null;

  if (!apto) return <p className="aviso aviso--erro">Ainda não dá para gerar contrato: {motivo}</p>;
  if (!ativas.length) return <p className="aviso aviso--erro">Nenhuma oferta ativa. Ative uma em Ofertas e lastro.</p>;
  return (
    <form className="novo-contrato" onSubmit={(e) => { e.preventDefault(); if (oferta && taxa) criar.mutate({ investidorId, ofertaId: oferta.id, principalCentavos: centavos, prazoMeses: Number(prazo), observacoes: obs || undefined, reservaId: reserva && reserva.ofertaId === oferta.id ? reserva.id : undefined }); }}>
      <label className="campo-form">Oferta
        <select value={oferta?.id ?? ""} onChange={(e) => setOfertaId(Number(e.target.value))}>
          {ativas.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <label className="campo-form">Valor do aporte (R$)
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="100.000,00" required />
      </label>
      <label className="campo-form">Prazo
        <select value={prazo} onChange={(e) => setPrazo(e.target.value)}>
          {PRAZOS_CONTRATO.map((p) => <option key={p} value={p}>{p} meses</option>)}
        </select>
      </label>
      <div className="novo-contrato__taxa">
        <span>Taxa pela faixa</span>
        <strong className="num">{taxa !== null ? `${formatarPct(taxa)} a.m.` : centavos ? "fora das faixas" : "–"}</strong>
      </div>
      <label className="campo-form novo-contrato__obs">Observações internas (opcional)
        <input value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      {criar.error && <p className="aviso aviso--erro novo-contrato__obs">{criar.error.message}</p>}
      <button className="btn btn--primario" disabled={!taxa || criar.isPending}>{reserva ? "Gerar contrato da reserva" : "Gerar contrato"}</button>
    </form>
  );
}

function AcoesContrato({ c }: { c: { id: number; status: string } }) {
  const utils = trpc.useUtils();
  const recarregar = () => { void utils.admin.investidores.detalhe.invalidate(); void utils.admin.contratos.listar.invalidate(); };
  const assinado = trpc.admin.contratos.marcarAssinado.useMutation({ onSuccess: recarregar });
  const aporte = trpc.admin.contratos.confirmarAporte.useMutation({ onSuccess: recarregar });
  const cancelar = trpc.admin.contratos.cancelar.useMutation({ onSuccess: recarregar });
  const [ref, setRef] = useState("");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [comprovante, setComprovante] = useState<string | undefined>();
  const erro = assinado.error ?? aporte.error ?? cancelar.error;

  return (
    <div className="acoes-contrato">
      {c.status === "aguardando_assinatura" && (
        <div className="linha-form">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Referência da assinatura (opcional)" />
          <button className="btn btn--primario btn--peq" onClick={() => assinado.mutate({ id: c.id, assinaturaRef: ref || undefined })}>Marcar como assinado</button>
        </div>
      )}
      {c.status === "aguardando_aporte" && (
        <div className="linha-form">
          <label className="campo-form campo-form--inline">Início do rendimento
            <input type="date" value={inicio} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <EnviarArquivo escopo="contrato" escopoId={c.id} tipo="comprovante_aporte" rotulo="Comprovante do aporte" onEnviado={setComprovante} />
          <button className="btn btn--primario btn--peq" onClick={() => aporte.mutate({ id: c.id, inicio, comprovanteChave: comprovante })}>Confirmar aporte</button>
        </div>
      )}
      {["aguardando_assinatura", "aguardando_aporte"].includes(c.status) && (
        <button className="btn btn--ghost btn--peq acoes-contrato__cancelar" onClick={() => { const m = window.prompt("Motivo do cancelamento"); if (m) cancelar.mutate({ id: c.id, motivo: m }); }}>
          Cancelar contrato
        </button>
      )}
      {c.status === "ativo" && <EnviarArquivo escopo="contrato" escopoId={c.id} tipo="documento_contrato" rotulo="Anexar documento ao contrato" />}
      {erro && <p className="aviso aviso--erro">{erro.message}</p>}
    </div>
  );
}

function Ficha({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { data: d, isLoading } = trpc.admin.investidores.detalhe.useQuery({ id });
  const [reservaSel, setReservaSel] = useState<ReservaSel | undefined>();
  if (isLoading || !d) return <div className="ficha"><p className="carregando">Carregando…</p></div>;
  const cad = d.cadastro;
  const apto = Boolean(cad);
  const motivo = !cad ? "cadastro incompleto" : null;

  return (
    <div className="ficha" role="dialog" aria-label={`Ficha de ${cad?.nomeCompleto ?? d.email}`}>
      <div className="ficha__cab">
        <div>
          <h2>{cad?.nomeCompleto ?? d.nome ?? d.email}</h2>
          <span className="bloco__det">{d.email}</span>
        </div>
        <button className="btn btn--ghost btn--peq" onClick={onFechar}>Fechar</button>
      </div>
      <p className="bloco__nota">Dados completos visíveis só para admin. Esta visualização fica registrada na auditoria.</p>

      {cad ? (
        <dl className="cad-revisao">
          <div><dt>CPF</dt><dd className="num">{formatarCpf(cad.cpf)}</dd></div>
          <div><dt>Nascimento</dt><dd>{data(cad.dataNascimento)}</dd></div>
          <div><dt>RG</dt><dd>{cad.rg || "–"} {cad.rgOrgao}</dd></div>
          <div><dt>Estado civil e profissão</dt><dd>{cad.estadoCivil}, {cad.profissao}</dd></div>
          <div><dt>Telefone</dt><dd>{cad.telefone}</dd></div>
          <div><dt>Endereço</dt><dd>{cad.logradouro}, {cad.numero}{cad.complemento ? `, ${cad.complemento}` : ""}, {cad.bairro}, {cad.cidade}/{cad.uf}, CEP {cad.cep}</dd></div>
          <div><dt>Renda / patrimônio</dt><dd>{cad.faixaRenda} · {cad.faixaPatrimonio}</dd></div>
          <div><dt>Origem dos recursos</dt><dd>{cad.origemRecursos}</dd></div>
          <div><dt>PEP</dt><dd>{cad.ppe ? <span className="status status--alerta">Sim, diligência reforçada</span> : "Não"}</dd></div>
          <div><dt>Conta para resgate</dt><dd>{cad.bancoNome} ({cad.bancoCodigo}), ag. {cad.agencia}, {cad.contaTipo} {cad.conta}{cad.pix ? ` · Pix ${cad.pix}` : ""}</dd></div>
        </dl>
      ) : (
        <Vazio titulo="Cadastro não preenchido" />
      )}

      <h3>Contratos</h3>
      {d.contratos.length === 0 && <p className="bloco__nota">Nenhum contrato.</p>}
      {d.contratos.map((c) => (
        <div key={c.id} className="ficha__contrato">
          <div className="ficha__contrato-cab">
            <strong>#{c.id} · {formatarBRL(c.principalCentavos)} · {formatarPct(c.taxaMensal)} a.m. · {c.prazoMeses}m</strong>
            <span className={`status ${c.status === "ativo" ? "status--adimplente" : c.status === "cancelado" ? "status--atraso" : "status--alerta"}`}>{c.statusRotulo}</span>
          </div>
          {c.status === "ativo" && <span className="bloco__det">{data(c.inicio)} a {data(c.vencimento)} · disponível {formatarBRL(c.disponivelCentavos)} · resgatado {formatarBRL(c.resgatadoCentavos)}</span>}
          <AcoesContrato c={c} />
        </div>
      ))}

      <h3>Reservas</h3>
      {d.reservas.filter((r) => r.status === "ativa").length === 0 ? (
        <p className="bloco__nota">Nenhuma reserva em aberto.</p>
      ) : (
        d.reservas.filter((r) => r.status === "ativa").map((r) => (
          <div key={r.id} className="ficha__contrato ficha__reserva">
            <div className="ficha__contrato-cab">
              <strong>{r.codigo ?? r.oferta} · {formatarBRL(r.valorCentavos)} · {r.prazoMeses}m · {formatarPct(r.taxaMensal)} a.m.</strong>
              <button className="btn btn--primario btn--peq" onClick={() => setReservaSel({ id: r.id, ofertaId: r.ofertaId, valorCentavos: r.valorCentavos, prazoMeses: r.prazoMeses })}>Usar no contrato</button>
            </div>
            <span className="bloco__det">Reservado em {data(r.criadoEm)}</span>
          </div>
        ))
      )}

      <h3>Novo contrato</h3>
      <NovoContrato key={reservaSel?.id ?? "novo"} investidorId={d.id} apto={apto} motivo={motivo} reserva={reservaSel} />

      <h3>Documentos do investidor</h3>
      <EnviarArquivo escopo="investidor" escopoId={d.id} tipo="documento_investidor" rotulo="Enviar documento" />
    </div>
  );
}

const Marca = ({ ok, texto }: { ok: boolean; texto: string }) => <span className={`check ${ok ? "check--ok" : ""}`} title={texto}>{ok ? "✓" : "·"} {texto}</span>;

export default function AdminInvestidores() {
  const { data: listaInvestidores, isLoading } = trpc.admin.investidores.listar.useQuery();
  const [aberto, setAberto] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "prontos" | "interesse">("todos");
  const lista = (listaInvestidores ?? []).filter((i) =>
    filtro === "todos" ? true : filtro === "interesse" ? Boolean(i.interesseAporteEm) : Boolean(i.cadastroEm),
  );

  return (
    <AreaLogada
      titulo="Investidores"
      subtitulo="Quem está apto para contrato, ficha completa e geração de contratos."
      acoes={
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtro">
          <option value="todos">Todos</option>
          <option value="interesse">Pediram conversa</option>
          <option value="prontos">Prontos para contrato</option>
        </select>
      }
    >
      <Seo titulo="Investidores" indexar={false} />
      <section className="bloco">
        {isLoading ? <p className="carregando">Carregando…</p> : !lista.length ? <Vazio titulo="Nenhum investidor neste filtro" /> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Investidor</th><th>Etapas</th><th className="dir">Reserva</th><th className="dir">Contratos</th><th /></tr></thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.nomeCompleto ?? i.nome ?? "Sem nome"}</strong><span className="sub">{i.email}{i.cpfMascarado ? ` · ${i.cpfMascarado}` : ""}</span></td>
                    <td className="checks">
                      <Marca ok={Boolean(i.cadastroEm)} texto="Cadastro" />
                      {i.ppe && <span className="status status--alerta">PEP</span>}
                    </td>
                    <td className="dir num">{i.reservaCentavos ? <strong>{formatarBRL(i.reservaCentavos)}</strong> : "–"}{i.interesseAporteEm && <span className="sub">{data(i.interesseAporteEm)}</span>}</td>
                    <td className="dir num">{i.contratos}</td>
                    <td className="dir"><button className="btn btn--ghost btn--peq" onClick={() => setAberto(i.id)}>Abrir ficha</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {aberto !== null && (
        <div className="ficha-fundo" onClick={(e) => e.target === e.currentTarget && setAberto(null)}>
          <Ficha id={aberto} onFechar={() => setAberto(null)} />
        </div>
      )}
    </AreaLogada>
  );
}
