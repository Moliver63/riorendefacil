import { useState } from "react";
import { AreaLogada, Vazio } from "../../components/AreaLogada";
import { trpc } from "../../lib/trpc";
import { Seo } from "../../lib/seo";
import { formatarBRL, formatarPct } from "@shared/finance";
import { FAIXAS_EXEMPLO } from "@shared/issuer";
import { SITUACOES_CCB, SETORES } from "@shared/const";

const reais = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);

async function sha256Arquivo(f: File) {
  const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function NovaOferta() {
  const utils = trpc.useUtils();
  const [nome, setNome] = useState("");
  const salvar = trpc.admin.ofertas.salvar.useMutation({ onSuccess: () => { setNome(""); void utils.admin.ofertas.listar.invalidate(); } });
  return (
    <form className="linha-form" onSubmit={(e) => { e.preventDefault(); salvar.mutate({ nome, faixas: FAIXAS_EXEMPLO, carenciaPrincipalDias: 60, prazoResgateDias: 7 }); }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da oferta (ex.: Pool Agro + Imobiliário 01)" required minLength={3} />
      <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Criar oferta</button>
      {salvar.error && <span className="erro-inline">{salvar.error.message}</span>}
    </form>
  );
}

function FormCCB({ ofertaId }: { ofertaId: number }) {
  const utils = trpc.useUtils();
  const vazio = { codigo: "", setor: "agro", devedor: "", valor: "", garantia: "", valorGarantia: "", vencimento: "", situacao: "adimplente", dias: "0" };
  const [f, setF] = useState(vazio);
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const salvar = trpc.admin.ccbs.salvar.useMutation({ onSuccess: () => { setF(vazio); void utils.admin.ccbs.listar.invalidate({ ofertaId }); } });

  return (
    <form
      className="form-ccb"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate({
          ofertaId,
          codigo: f.codigo,
          setor: f.setor as (typeof SETORES)[number],
          devedorDescricao: f.devedor,
          valorCentavos: reais(f.valor),
          garantiaTipo: f.garantia,
          garantiaValorCentavos: f.valorGarantia ? reais(f.valorGarantia) : null,
          vencimento: f.vencimento,
          situacao: f.situacao as (typeof SITUACOES_CCB)[number],
          diasAtraso: Number(f.dias) || 0,
        });
      }}
    >
      <input placeholder="Código" value={f.codigo} onChange={set("codigo")} required />
      <select value={f.setor} onChange={set("setor")}>{SETORES.map((s) => <option key={s}>{s}</option>)}</select>
      <input placeholder="Devedor (anonimizado: Produtor de soja, MT)" value={f.devedor} onChange={set("devedor")} required />
      <input placeholder="Valor (R$)" value={f.valor} onChange={set("valor")} required inputMode="decimal" />
      <input placeholder="Garantia" value={f.garantia} onChange={set("garantia")} required />
      <input placeholder="Valor da garantia (R$)" value={f.valorGarantia} onChange={set("valorGarantia")} inputMode="decimal" />
      <input type="date" value={f.vencimento} onChange={set("vencimento")} required aria-label="Vencimento" />
      <select value={f.situacao} onChange={set("situacao")}>{SITUACOES_CCB.map((s) => <option key={s}>{s}</option>)}</select>
      <input placeholder="Dias de atraso" value={f.dias} onChange={set("dias")} inputMode="numeric" />
      <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Adicionar CCB</button>
      {salvar.error && <span className="erro-inline">{salvar.error.message}</span>}
    </form>
  );
}

function Lastro({ ofertaId }: { ofertaId: number }) {
  const { data } = trpc.admin.ccbs.listar.useQuery({ ofertaId });
  const total = data?.reduce((s, c) => s + c.valorCentavos, 0) ?? 0;
  return (
    <>
      {data?.length ? (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>CCB</th><th>Devedor</th><th>Garantia</th><th className="dir">Valor</th><th className="dir">LTV</th><th>Vencimento</th><th>Situação</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.codigo}</td>
                  <td><span className={`ponto ponto--${c.setor}`} /> {c.devedorDescricao}</td>
                  <td>{c.garantiaTipo}</td>
                  <td className="dir num">{formatarBRL(c.valorCentavos)}</td>
                  <td className="dir num">{c.garantiaValorCentavos ? formatarPct(c.valorCentavos / c.garantiaValorCentavos, 0) : "–"}</td>
                  <td>{new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td><span className={`status status--${c.situacao === "adimplente" ? "adimplente" : "atraso"}`}>{c.situacao}{c.diasAtraso ? ` · ${c.diasAtraso}d` : ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bloco__nota">Total do pool: <strong className="num">{formatarBRL(total)}</strong></p>
        </div>
      ) : (
        <p className="bloco__nota">Nenhuma CCB cadastrada nesta oferta.</p>
      )}
      <FormCCB ofertaId={ofertaId} />
    </>
  );
}

function EnviarDocumento() {
  const preparar = trpc.admin.documentos.prepararEnvio.useMutation();
  const registrar = trpc.admin.documentos.registrar.useMutation();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("parecer_auditoria");
  const [estado, setEstado] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    try {
      setEstado("Calculando impressão digital…");
      const hash = await sha256Arquivo(arquivo);
      setEstado("Enviando…");
      const { chave, url } = await preparar.mutateAsync({ escopo: "publico", escopoId: null, nomeArquivo: arquivo.name, contentType: arquivo.type, tamanho: arquivo.size });
      const r = await fetch(url, { method: "PUT", body: arquivo, headers: { "Content-Type": arquivo.type } });
      if (!r.ok) throw new Error("Falha no envio para o armazenamento.");
      await registrar.mutateAsync({ escopo: "publico", escopoId: null, tipo, titulo, chave, sha256: hash, tamanhoBytes: arquivo.size });
      setEstado(`Publicado. SHA-256 ${hash.slice(0, 16)}…`);
      setArquivo(null);
      setTitulo("");
    } catch (err) {
      setEstado((err as Error).message);
    }
  }

  return (
    <form className="linha-form" onSubmit={enviar}>
      <input placeholder="Título do documento" value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="parecer_auditoria">Parecer de auditoria</option>
        <option value="laudo_garantia">Laudo de garantia</option>
        <option value="ccb">CCB</option>
        <option value="relatorio">Relatório</option>
      </select>
      <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} required />
      <button className="btn btn--primario btn--peq" disabled={!arquivo}>Publicar para todos os investidores</button>
      {estado && <span className="bloco__nota">{estado}</span>}
    </form>
  );
}

export default function AdminOfertas() {
  const utils = trpc.useUtils();
  const ofertas = trpc.admin.ofertas.listar.useQuery();
  const ativar = trpc.admin.ofertas.ativar.useMutation({ onSuccess: () => { void utils.admin.ofertas.listar.invalidate(); void utils.plataforma.lastro.invalidate(); } });
  const [aberta, setAberta] = useState<number | null>(null);

  return (
    <AreaLogada titulo="Ofertas e lastro" subtitulo="Cadastro das CCBs que compõem cada pool. Só a oferta ativa aparece para investidores, e só com o emissor autorizado.">
      <Seo titulo="Ofertas" indexar={false} />
      <section className="bloco">
        <NovaOferta />
        {!ofertas.data?.length ? (
          <Vazio titulo="Nenhuma oferta cadastrada" />
        ) : (
          <ul className="ofertas">
            {ofertas.data.map((o) => (
              <li key={o.id}>
                <div className="ofertas__cab">
                  <div>
                    <strong>{o.nome}</strong>
                    <span className="sub">Carência {o.carenciaPrincipalDias} dias · resgate D+{o.prazoResgateDias}</span>
                  </div>
                  <span className={`status ${o.ativa ? "status--adimplente" : ""}`}>{o.ativa ? "Ativa" : "Inativa"}</span>
                  <button className="btn btn--ghost btn--peq" onClick={() => ativar.mutate({ id: o.id, ativa: !o.ativa })}>{o.ativa ? "Desativar" : "Ativar"}</button>
                  <button className="btn btn--ghost btn--peq" onClick={() => setAberta(aberta === o.id ? null : o.id)}>{aberta === o.id ? "Fechar lastro" : "Ver lastro"}</button>
                </div>
                {aberta === o.id && <Lastro ofertaId={o.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="bloco">
        <h2>Documentos públicos</h2>
        <p className="bloco__nota" style={{ margin: "6px 0 14px" }}>Pareceres e laudos que todo investidor cadastrado pode baixar. Requer R2 configurado.</p>
        <EnviarDocumento />
      </section>
    </AreaLogada>
  );
}
