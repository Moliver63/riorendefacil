import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { trpc, type Saidas } from "@/lib/trpc";
import { Seo } from "@/components/SEO";
import { formatarBRL, formatarPct } from "~shared/finance";
import { FAIXAS_EXEMPLO } from "~shared/issuer";
import { SITUACOES_CCB, SETORES } from "~shared/const";

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
    <form className="linha-form" onSubmit={(e) => { e.preventDefault(); salvar.mutate({ nome, faixas: FAIXAS_EXEMPLO, carenciaPrincipalDias: 180, prazoResgateDias: 7, coberturaMinima: 1.3, prazoMedioCicloDias: 60 }); }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da oferta (ex.: Giro de Grãos Centro-Oeste)" required minLength={3} />
      <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Criar oferta</button>
      {salvar.error && <span className="erro-inline">{salvar.error.message}</span>}
    </form>
  );
}

function FormCCB({ ofertaId }: { ofertaId: number }) {
  const utils = trpc.useUtils();
  const vazio = { codigo: "", setor: "imobiliario", devedor: "", valor: "", garantia: "", valorGarantia: "", elegivel: "", registro: "", serie: "", emissao: "", resgate: "", vencimento: "", situacao: "adimplente", dias: "0" };
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
          valorElegivelCentavos: f.elegivel ? reais(f.elegivel) : null,
          registroRef: f.registro || undefined,
          serie: f.serie || null,
          dataEmissao: f.emissao || null,
          valorResgateCentavos: f.resgate ? reais(f.resgate) : null,
        });
      }}
    >
      <input placeholder="Código" value={f.codigo} onChange={set("codigo")} required />
      <select value={f.setor} onChange={set("setor")}>{SETORES.map((s) => <option key={s}>{s}</option>)}</select>
      <input placeholder="Imóvel (ex.: Área rural, Sorriso/MT)" value={f.devedor} onChange={set("devedor")} required />
      <input placeholder="Valor da CCB (R$)" value={f.valor} onChange={set("valor")} required inputMode="decimal" />
      <input placeholder="Tipo (ex.: Alienação fiduciária)" value={f.garantia} onChange={set("garantia")} required />
      <input placeholder="Avaliação do imóvel (R$)" value={f.valorGarantia} onChange={set("valorGarantia")} inputMode="decimal" />
      <input placeholder="Valor elegível (R$, após desconto)" value={f.elegivel} onChange={set("elegivel")} inputMode="decimal" />
      <input placeholder="Registro (matrícula, cartório)" value={f.registro} onChange={set("registro")} />
      <input placeholder="Série (ex.: Série A)" value={f.serie} onChange={set("serie")} />
      <input type="date" value={f.emissao} onChange={set("emissao")} aria-label="Data de emissão" title="Data de emissão" />
      <input placeholder="Valor de resgate no vencimento (R$)" value={f.resgate} onChange={set("resgate")} inputMode="decimal" />
      <input type="date" value={f.vencimento} onChange={set("vencimento")} required aria-label="Vencimento" />
      <select value={f.situacao} onChange={set("situacao")}>{SITUACOES_CCB.map((s) => <option key={s}>{s}</option>)}</select>
      <input placeholder="Dias de atraso" value={f.dias} onChange={set("dias")} inputMode="numeric" />
      <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Adicionar garantia</button>
      {salvar.error && <span className="erro-inline">{salvar.error.message}</span>}
    </form>
  );
}

function Lastro({ ofertaId }: { ofertaId: number }) {
  const { data } = trpc.admin.ccbs.listar.useQuery({ ofertaId });
  const total = data?.filter((c) => ["adimplente", "atraso", "renegociada"].includes(c.situacao)).reduce((s, c) => s + (c.valorElegivelCentavos ?? c.garantiaValorCentavos ?? 0), 0) ?? 0;
  return (
    <>
      {data?.length ? (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>CCB</th><th>Imóvel</th><th>Garantia</th><th className="dir">Custo</th><th className="dir">Resgate</th><th className="dir">Elegível</th><th className="dir">LTV</th><th>Vencimento</th><th>Situação</th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><span className="mono">{c.codigo}</span>{c.serie && <span className="sub">{c.serie}</span>}</td>
                  <td><span className={`ponto ponto--${c.setor}`} /> {c.devedorDescricao}</td>
                  <td>{c.garantiaTipo}</td>
                  <td className="dir num">{formatarBRL(c.valorCentavos)}</td>
                  <td className="dir num">{c.valorResgateCentavos ? formatarBRL(c.valorResgateCentavos) : "–"}</td>
                  <td className="dir num">{formatarBRL(c.valorElegivelCentavos ?? c.garantiaValorCentavos ?? 0)}</td>
                  <td className="dir num">{c.garantiaValorCentavos ? formatarPct(c.valorCentavos / c.garantiaValorCentavos, 0) : "–"}</td>
                  <td>{new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td><span className={`status status--${c.situacao === "adimplente" ? "adimplente" : "atraso"}`}>{c.situacao}{c.diasAtraso ? ` · ${c.diasAtraso}d` : ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bloco__nota">Garantias elegíveis (em dia, em atraso ou renegociadas): <strong className="num">{formatarBRL(total)}</strong>. A cobertura e a trava ficam em Operações.</p>
        </div>
      ) : (
        <p className="bloco__nota">Nenhuma garantia cadastrada. Sem garantia, a oferta não aceita contratos.</p>
      )}
      <FormCCB ofertaId={ofertaId} />
    </>
  );
}

type Oferta = Saidas["admin"]["ofertas"]["listar"][number];
type LinhaFaixa = { minimo: string; prazo: string; taxa: string };

function EditarFicha({ o }: { o: Oferta }) {
  const utils = trpc.useUtils();
  const [f, setF] = useState({
    nome: o.nome,
    codigo: o.codigo ?? "",
    tese: o.tese ?? "",
    carencia: String(o.carenciaPrincipalDias),
    resgate: String(o.prazoResgateDias),
    cobertura: String(Math.round(Number(o.coberturaMinima) * 100)),
    alvo: o.captacaoAlvoCentavos ? (o.captacaoAlvoCentavos / 100).toLocaleString("pt-BR") : "",
    ciclo: String(o.prazoMedioCicloDias),
    reservasAte: o.reservasAte ?? "",
  });
  const [faixas, setFaixas] = useState<LinhaFaixa[]>(
    (o.faixas as { minimoCentavos: number; prazoMinimoMeses: number; taxaMensalTeto: number }[]).map((x) => ({
      minimo: (x.minimoCentavos / 100).toLocaleString("pt-BR"),
      prazo: String(x.prazoMinimoMeses),
      taxa: (x.taxaMensalTeto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 3 }),
    })),
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setFx = (i: number, k: keyof LinhaFaixa) => (e: React.ChangeEvent<HTMLInputElement>) => setFaixas((l) => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const salvar = trpc.admin.ofertas.salvar.useMutation({ onSuccess: () => { void utils.admin.ofertas.listar.invalidate(); void utils.plataforma.ofertas.invalidate(); } });
  const num = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

  return (
    <form
      className="ficha-editor"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate({
          id: o.id,
          nome: f.nome,
          codigo: f.codigo || undefined,
          tese: f.tese || undefined,
          carenciaPrincipalDias: Number(f.carencia),
          prazoResgateDias: Number(f.resgate),
          coberturaMinima: num(f.cobertura) / 100,
          captacaoAlvoCentavos: f.alvo ? reais(f.alvo) : null,
          prazoMedioCicloDias: Number(f.ciclo),
          reservasAte: f.reservasAte || null,
          faixas: faixas.map((x) => ({ minimoCentavos: reais(x.minimo), prazoMinimoMeses: Number(x.prazo), taxaMensalTeto: num(x.taxa) / 100 })),
        });
      }}
    >
      <div className="ficha-editor__grade">
        <label className="campo-form">Nome<input value={f.nome} onChange={set("nome")} required minLength={3} /></label>
        <label className="campo-form">Código<input value={f.codigo} onChange={set("codigo")} placeholder="RRF-GR-01" /></label>
        <label className="campo-form">Carência do principal (dias)<input value={f.carencia} onChange={set("carencia")} inputMode="numeric" /></label>
        <label className="campo-form">Resgate do rendimento (D+)<input value={f.resgate} onChange={set("resgate")} inputMode="numeric" /></label>
        <label className="campo-form">Cobertura mínima (%)<input value={f.cobertura} onChange={set("cobertura")} inputMode="decimal" /></label>
        <label className="campo-form">Captação alvo (R$)<input value={f.alvo} onChange={set("alvo")} inputMode="decimal" /></label>
        <label className="campo-form">Ciclo médio do grão (dias)<input value={f.ciclo} onChange={set("ciclo")} inputMode="numeric" /></label>
        <label className="campo-form">Reservas até<input type="date" value={f.reservasAte} onChange={set("reservasAte")} /></label>
      </div>
      <label className="campo-form">Tese da oferta (aparece na ficha)
        <textarea value={f.tese} onChange={set("tese")} rows={4} maxLength={4000} />
      </label>
      <fieldset className="faixas-editor">
        <legend>Quadro de faixas</legend>
        {faixas.map((x, i) => (
          <div key={i} className="faixas-editor__linha">
            <label className="campo-form campo-form--inline">A partir de (R$)<input value={x.minimo} onChange={setFx(i, "minimo")} inputMode="decimal" /></label>
            <label className="campo-form campo-form--inline">Prazo mín. (meses)<input value={x.prazo} onChange={setFx(i, "prazo")} inputMode="numeric" /></label>
            <label className="campo-form campo-form--inline">Taxa (% a.m.)<input value={x.taxa} onChange={setFx(i, "taxa")} inputMode="decimal" /></label>
            {faixas.length > 1 && <button type="button" className="btn btn--ghost btn--peq" onClick={() => setFaixas((l) => l.filter((_, j) => j !== i))}>Remover</button>}
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--peq" onClick={() => setFaixas((l) => [...l, { minimo: "", prazo: "12", taxa: "" }])}>Adicionar faixa</button>
      </fieldset>
      <div className="form-grade__acoes">
        {salvar.isSuccess && <span className="ok-inline">Salvo</span>}
        {salvar.error && <span className="erro-inline">{salvar.error.message}</span>}
        <button className="btn btn--primario btn--peq" disabled={salvar.isPending}>Salvar ficha</button>
      </div>
    </form>
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
  const ativar = trpc.admin.ofertas.ativar.useMutation({ onSuccess: () => { void utils.admin.ofertas.listar.invalidate(); void utils.plataforma.ofertas.invalidate(); } });
  const [aberta, setAberta] = useState<number | null>(null);
  const [aba, setAba] = useState<"ficha" | "garantias">("ficha");

  return (
    <AreaLogada titulo="Ofertas e garantias" subtitulo="Ficha de cada oferta e as CCBs com imóvel que formam a camada de garantia. Ofertas ativas aparecem na prateleira quando o emissor estiver habilitado.">
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
                    <span className="sub">{o.codigo ? `${o.codigo} · ` : ""}carência {o.carenciaPrincipalDias} dias · resgate D+{o.prazoResgateDias} · cobertura mínima {Math.round(Number(o.coberturaMinima) * 100)}%</span>
                  </div>
                  <span className={`status ${o.ativa ? "status--adimplente" : ""}`}>{o.ativa ? "Ativa" : "Inativa"}</span>
                  <button className="btn btn--ghost btn--peq" onClick={() => ativar.mutate({ id: o.id, ativa: !o.ativa })}>{o.ativa ? "Desativar" : "Ativar"}</button>
                  <button className="btn btn--ghost btn--peq" onClick={() => setAberta(aberta === o.id ? null : o.id)}>{aberta === o.id ? "Fechar" : "Editar"}</button>
                </div>
                {aberta === o.id && (
                  <div className="ofertas__painel">
                    <div className="abas" role="tablist">
                      <button role="tab" aria-selected={aba === "ficha"} className={aba === "ficha" ? "on" : ""} onClick={() => setAba("ficha")}>Ficha e faixas</button>
                      <button role="tab" aria-selected={aba === "garantias"} className={aba === "garantias" ? "on" : ""} onClick={() => setAba("garantias")}>Garantias (CCBs com imóvel)</button>
                    </div>
                    {aba === "ficha" ? <EditarFicha o={o} /> : <Lastro ofertaId={o.id} />}
                  </div>
                )}
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
