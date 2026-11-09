import { useState } from "react";
import { AreaLogada, Vazio } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";

const dataBR = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
const hojeIso = () => new Date().toISOString().slice(0, 10);
const quatro = (v: number | string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function AdminCotacoes() {
  const utils = trpc.useUtils();
  const lista = trpc.admin.cotacoes.listar.useQuery();
  const depois = () => void utils.admin.cotacoes.listar.invalidate();
  const importar = trpc.admin.cotacoes.importarPtax.useMutation({ onSuccess: depois });
  const registrar = trpc.admin.cotacoes.registrar.useMutation({ onSuccess: () => { setValor(""); depois(); } });
  const [valor, setValor] = useState("");
  const [dataCot, setDataCot] = useState(hojeIso());
  const [fonte, setFonte] = useState("PTAX venda · Banco Central do Brasil");
  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  const ultima = lista.data?.ultima;

  return (
    <AreaLogada titulo="Cotações" subtitulo="Dólar usado para converter as aplicações em USD para reais. Toda cotação tem data e fonte e aparece para o investidor junto do valor convertido.">
      <Seo titulo="Cotações" indexar={false} />
      <section className="bloco bloco--duas">
        <div>
          <h2>Cotação em uso</h2>
          {ultima ? (
            <p className="cotacao-atual"><strong className="num">US$ 1 = R$ {quatro(ultima.valor)}</strong><span className="sub">{dataBR(ultima.data)} · {ultima.fonte}</span></p>
          ) : (
            <p className="aviso aviso--alerta">Nenhuma cotação registrada. Aplicações em dólar ficam sem valor em reais e não podem ser criadas.</p>
          )}
          <button className="btn btn--primario" onClick={() => importar.mutate()} disabled={importar.isPending}>{importar.isPending ? "Consultando o Banco Central…" : "Importar PTAX do Banco Central"}</button>
          {importar.isSuccess && <p className="aviso aviso--ok">PTAX de {dataBR(importar.data.data)} importada: R$ {quatro(importar.data.valor)}.</p>}
          {importar.error && <p className="aviso aviso--erro">{importar.error.message}</p>}
        </div>
        <form className="form-cotacao" onSubmit={(e) => { e.preventDefault(); if (numero > 0) registrar.mutate({ valor: numero, data: dataCot, fonte }); }}>
          <h2>Registrar à mão</h2>
          <label className="campo-form">Reais por dólar
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="5,4321" required />
          </label>
          <label className="campo-form">Data da cotação
            <input type="date" value={dataCot} max={hojeIso()} onChange={(e) => setDataCot(e.target.value)} required />
          </label>
          <label className="campo-form">Fonte
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} minLength={3} maxLength={120} required />
          </label>
          {registrar.error && <p className="aviso aviso--erro">{registrar.error.message}</p>}
          <button className="btn btn--ghost" disabled={!(numero > 0) || registrar.isPending}>Registrar cotação</button>
        </form>
      </section>

      <section className="bloco">
        <div className="bloco__cab"><h2>Histórico</h2><span className="bloco__det">alterações ficam na auditoria com o valor anterior</span></div>
        {!lista.data?.historico.length ? (
          <Vazio titulo="Sem cotações ainda" />
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Data</th><th>Moeda</th><th className="dir">R$ por unidade</th><th>Fonte</th><th>Registrada em</th></tr></thead>
              <tbody>
                {lista.data.historico.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{dataBR(c.data)}</td>
                    <td>{c.moeda}</td>
                    <td className="dir num">{quatro(c.valor)}</td>
                    <td>{c.fonte}</td>
                    <td className="num">{new Date(c.criadoEm).toLocaleString("pt-BR")}</td>
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
