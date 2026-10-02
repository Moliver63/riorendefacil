import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { Seo } from "@/components/SEO";


export default function Perfil() {
  const utils = trpc.useUtils();
  const perfil = trpc.investidor.perfil.useQuery();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  useEffect(() => {
    if (perfil.data) {
      setNome(perfil.data.nome ?? "");
      setTelefone(perfil.data.telefone ?? "");
    }
  }, [perfil.data]);

  const salvarDados = trpc.investidor.atualizarPerfil.useMutation({ onSuccess: () => utils.auth.eu.invalidate() });
  const interesse = trpc.investidor.manifestarInteresse.useMutation({ onSuccess: () => utils.investidor.perfil.invalidate() });

  const p = perfil.data;

  return (
    <AreaLogada titulo="Perfil" subtitulo="Seus dados de contato e o cadastro do investidor.">
      <Seo titulo="Perfil" indexar={false} />

      <section className="bloco">
        <h2>Dados de contato</h2>
        <form
          className="form-grade"
          onSubmit={(e) => {
            e.preventDefault();
            salvarDados.mutate({ nome, telefone: telefone.replace(/\D/g, "") });
          }}
        >
          <label className="campo-form">
            Nome completo
            <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} autoComplete="name" />
          </label>
          <label className="campo-form">
            WhatsApp
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="(47) 99999-9999" />
          </label>
          <label className="campo-form">
            E-mail
            <input value={p?.email ?? ""} disabled />
          </label>
          <div className="form-grade__acoes">
            {salvarDados.isSuccess && <span className="ok-inline">Salvo</span>}
            {salvarDados.error && <span className="erro-inline">{salvarDados.error.message}</span>}
            <button className="btn btn--primario btn--peq" disabled={salvarDados.isPending}>Salvar</button>
          </div>
        </form>
      </section>

      <section className="bloco">
        <div className="bloco__cab">
          <h2>Cadastro do investidor</h2>
          {p?.cadastroCompletoEm && <span className="status status--adimplente">Completo</span>}
        </div>
        <p className="bloco__nota" style={{ margin: "0 0 16px" }}>
          {p?.cadastroCompletoEm
            ? `Atualizado em ${new Date(p.cadastroCompletoEm).toLocaleDateString("pt-BR")}. É a base da qualificação no seu contrato.`
            : "CPF, endereço, perfil financeiro e conta para resgate. É a base da qualificação no seu contrato."}
        </p>
        <Link href="/cadastro" className={`btn btn--peq ${p?.cadastroCompletoEm ? "btn--ghost" : "btn--primario"}`}>
          {p?.cadastroCompletoEm ? "Revisar cadastro" : "Preencher cadastro"}
        </Link>
      </section>

      <section className="bloco">
        <h2>Conversar sobre aporte</h2>
        {p?.interesseAporteEm ? (
          <p className="aviso aviso--ok">
            Interesse registrado em {new Date(p.interesseAporteEm).toLocaleDateString("pt-BR")}. Um especialista vai entrar em contato.
          </p>
        ) : (
          <>
            <p className="bloco__nota" style={{ margin: "8px 0 16px" }}>
              Manifestar interesse não é aporte. Um especialista apresenta a estrutura, os documentos e o contrato, e você decide com calma.
            </p>
            {interesse.error && <p className="aviso aviso--erro">{interesse.error.message}</p>}
            <button className="btn btn--primario" onClick={() => interesse.mutate()} disabled={interesse.isPending}>
              Quero conversar com um especialista
            </button>
          </>
        )}
      </section>
    </AreaLogada>
  );
}
