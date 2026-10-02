import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AreaLogada } from "@/components/layout/Layout";
import { Seo } from "@/components/SEO";
import { trpc } from "@/lib/trpc";
import {
  BANCOS,
  ESTADOS_CIVIS,
  FAIXAS_PATRIMONIO,
  FAIXAS_RENDA,
  TIPOS_CONTA,
  UFS,
  esquemaCadastro,
  formatarCpf,
  soDigitos,
  type EntradaCadastro,
} from "~shared/cadastro";

type Form = Omit<EntradaCadastro, "declaracao" | "ppe"> & { ppe: "" | "sim" | "nao"; declaracao: boolean };

const VAZIO: Form = {
  nomeCompleto: "",
  cpf: "",
  dataNascimento: "",
  rg: "",
  rgOrgao: "",
  nacionalidade: "brasileira",
  estadoCivil: "" as Form["estadoCivil"],
  profissao: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "" as Form["uf"],
  faixaRenda: "" as Form["faixaRenda"],
  faixaPatrimonio: "" as Form["faixaPatrimonio"],
  origemRecursos: "",
  ppe: "",
  bancoCodigo: "",
  bancoNome: "",
  agencia: "",
  conta: "",
  contaTipo: "corrente",
  pix: "",
  declaracao: false,
};

const ETAPAS = [
  { titulo: "Dados pessoais", campos: ["nomeCompleto", "cpf", "dataNascimento", "rg", "rgOrgao", "nacionalidade", "estadoCivil", "profissao", "telefone"] },
  { titulo: "Endereço", campos: ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"] },
  { titulo: "Perfil financeiro", campos: ["faixaRenda", "faixaPatrimonio", "origemRecursos", "ppe"] },
  { titulo: "Conta para resgate", campos: ["bancoCodigo", "bancoNome", "agencia", "conta", "contaTipo", "pix"] },
  { titulo: "Revisar e confirmar", campos: ["declaracao"] },
] as const;

function paraEntrada(f: Form): unknown {
  return { ...f, ppe: f.ppe === "sim" ? true : f.ppe === "nao" ? false : undefined };
}

/** Erros por campo, usando o mesmo esquema do servidor. */
function validar(f: Form): Record<string, string> {
  const r = esquemaCadastro.safeParse(paraEntrada(f));
  if (r.success) return {};
  const erros: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = String(i.path[0]);
    const valor = (f as unknown as Record<string, unknown>)[k];
    if (typeof valor === "string" && !valor.trim() && k !== "estadoCivil" && k !== "uf" && !k.startsWith("faixa")) {
      erros[k] ??= "Preencha este campo";
      continue;
    }
    erros[k] ??= i.message.startsWith("Invalid enum") || i.message.startsWith("Required") || i.message.includes("expected") ? "Escolha uma opção" : i.message.startsWith("String must contain at least") ? "Preencha este campo" : i.message;
  }
  if (f.ppe === "") erros.ppe = "Escolha uma opção";
  return erros;
}

function Campo({ id, rotulo, erro, children, dica }: { id: string; rotulo: string; erro?: string; children: React.ReactNode; dica?: string }) {
  return (
    <div className={`cad-campo ${erro ? "cad-campo--erro" : ""}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? <span className="cad-campo__erro" role="alert">{erro}</span> : dica ? <span className="cad-campo__dica">{dica}</span> : null}
    </div>
  );
}

export default function Cadastro() {
  const utils = trpc.useUtils();
  const [, navegar] = useLocation();
  const atual = trpc.investidor.cadastro.useQuery();
  const salvar = trpc.investidor.salvarCadastro.useMutation({
    onSuccess: () => {
      void utils.investidor.perfil.invalidate();
      void utils.investidor.cadastro.invalidate();
    },
  });
  const [f, setF] = useState<Form>(VAZIO);
  const [etapa, setEtapa] = useState(0);
  const [tentou, setTentou] = useState<Set<number>>(new Set());
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (atual.data) {
      const d = atual.data;
      setF({ ...VAZIO, ...d, cpf: formatarCpf(d.cpf), ppe: d.ppe ? "sim" : "nao", declaracao: false } as Form);
    }
  }, [atual.data]);

  const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const erros = useMemo(() => validar(f), [f]);
  const errosDaEtapa = (i: number) => ETAPAS[i]!.campos.filter((c) => erros[c]);
  const mostrar = (campo: string) => (tentou.has(etapa) ? erros[campo] : undefined);

  async function buscarCep(cep: string) {
    const d = soDigitos(cep);
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!j.erro) {
        setF((s) => ({
          ...s,
          logradouro: j.logradouro || s.logradouro,
          bairro: j.bairro || s.bairro,
          cidade: j.localidade || s.cidade,
          uf: ((j.uf as Form["uf"]) || s.uf) as Form["uf"],
        }));
      }
    } catch {
      /* sem internet ou ViaCEP fora: a pessoa preenche à mão */
    } finally {
      setBuscandoCep(false);
    }
  }

  function avancar() {
    setTentou((t) => new Set(t).add(etapa));
    if (errosDaEtapa(etapa).length === 0) setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
  }

  function enviar() {
    setTentou(new Set(ETAPAS.map((_, i) => i)));
    const primeira = ETAPAS.findIndex((_, i) => errosDaEtapa(i).length > 0);
    if (primeira >= 0) return setEtapa(primeira);
    salvar.mutate(paraEntrada(f) as Parameters<typeof salvar.mutate>[0]);
  }

  if (salvar.isSuccess) {
    return (
      <AreaLogada titulo="Cadastro concluído">
        <Seo titulo="Cadastro" indexar={false} />
        <section className="bloco">
          <p className="aviso aviso--ok">Seus dados foram salvos e vão compor a qualificação do contrato.</p>
          <p className="bloco__nota" style={{ margin: "12px 0 18px" }}>
            CPF, documento e dados bancários ficam criptografados. No contrato aparecem só os últimos dígitos.
          </p>
          <div className="linha-form">
            <button className="btn btn--primario" onClick={() => navegar("/perfil")}>Ir para o próximo passo</button>
            <button className="btn btn--ghost" onClick={() => salvar.reset()}>Revisar dados</button>
          </div>
        </section>
      </AreaLogada>
    );
  }

  return (
    <AreaLogada titulo="Cadastro do investidor" subtitulo="Esses dados formam a qualificação do seu contrato. Leva uns 4 minutos.">
      <Seo titulo="Cadastro" indexar={false} />

      <ol className="cad-etapas" aria-label="Etapas do cadastro">
        {ETAPAS.map((e, i) => (
          <li key={e.titulo} className={i === etapa ? "atual" : i < etapa ? "feita" : ""}>
            <button type="button" onClick={() => i <= etapa && setEtapa(i)} disabled={i > etapa} aria-current={i === etapa ? "step" : undefined}>
              <span className="num">{i < etapa ? "✓" : i + 1}</span>
              <span className="cad-etapas__rot">{e.titulo}</span>
            </button>
          </li>
        ))}
      </ol>

      <section className="bloco cad">
        <h2>{ETAPAS[etapa]!.titulo}</h2>

        {etapa === 0 && (
          <div className="cad-grade">
            <Campo id="nome" rotulo="Nome completo" erro={mostrar("nomeCompleto")}>
              <input id="nome" value={f.nomeCompleto} onChange={set("nomeCompleto")} autoComplete="name" />
            </Campo>
            <Campo id="cpf" rotulo="CPF" erro={mostrar("cpf")}>
              <input id="cpf" value={f.cpf} inputMode="numeric" maxLength={14} placeholder="000.000.000-00"
                onChange={(e) => setF((s) => ({ ...s, cpf: soDigitos(e.target.value).length === 11 ? formatarCpf(e.target.value) : e.target.value }))} />
            </Campo>
            <Campo id="nasc" rotulo="Data de nascimento" erro={mostrar("dataNascimento")}>
              <input id="nasc" type="date" value={f.dataNascimento} onChange={set("dataNascimento")} autoComplete="bday" />
            </Campo>
            <Campo id="tel" rotulo="Celular com DDD" erro={mostrar("telefone")}>
              <input id="tel" value={f.telefone} inputMode="tel" onChange={set("telefone")} autoComplete="tel" placeholder="(47) 99999-9999" />
            </Campo>
            <Campo id="rg" rotulo="RG (opcional)" erro={mostrar("rg")}>
              <input id="rg" value={f.rg} onChange={set("rg")} />
            </Campo>
            <Campo id="rgo" rotulo="Órgão emissor (opcional)" erro={mostrar("rgOrgao")}>
              <input id="rgo" value={f.rgOrgao} onChange={set("rgOrgao")} placeholder="SSP/SC" />
            </Campo>
            <Campo id="ec" rotulo="Estado civil" erro={mostrar("estadoCivil")}>
              <select id="ec" value={f.estadoCivil} onChange={set("estadoCivil")}>
                <option value="">Selecione</option>
                {ESTADOS_CIVIS.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Campo>
            <Campo id="prof" rotulo="Profissão" erro={mostrar("profissao")}>
              <input id="prof" value={f.profissao} onChange={set("profissao")} autoComplete="organization-title" />
            </Campo>
            <Campo id="nac" rotulo="Nacionalidade" erro={mostrar("nacionalidade")}>
              <input id="nac" value={f.nacionalidade} onChange={set("nacionalidade")} />
            </Campo>
          </div>
        )}

        {etapa === 1 && (
          <div className="cad-grade">
            <Campo id="cep" rotulo="CEP" erro={mostrar("cep")} dica={buscandoCep ? "Buscando endereço…" : "Preenchemos o resto pelo CEP"}>
              <input id="cep" value={f.cep} inputMode="numeric" maxLength={9} placeholder="00000-000" autoComplete="postal-code"
                onChange={(e) => { set("cep")(e); void buscarCep(e.target.value); }} />
            </Campo>
            <Campo id="log" rotulo="Rua ou avenida" erro={mostrar("logradouro")}>
              <input id="log" value={f.logradouro} onChange={set("logradouro")} autoComplete="address-line1" />
            </Campo>
            <Campo id="num" rotulo="Número" erro={mostrar("numero")}>
              <input id="num" value={f.numero} onChange={set("numero")} />
            </Campo>
            <Campo id="comp" rotulo="Complemento (opcional)" erro={mostrar("complemento")}>
              <input id="comp" value={f.complemento} onChange={set("complemento")} placeholder="Apto 101" autoComplete="address-line2" />
            </Campo>
            <Campo id="bai" rotulo="Bairro" erro={mostrar("bairro")}>
              <input id="bai" value={f.bairro} onChange={set("bairro")} />
            </Campo>
            <Campo id="cid" rotulo="Cidade" erro={mostrar("cidade")}>
              <input id="cid" value={f.cidade} onChange={set("cidade")} autoComplete="address-level2" />
            </Campo>
            <Campo id="uf" rotulo="Estado" erro={mostrar("uf")}>
              <select id="uf" value={f.uf} onChange={set("uf")}>
                <option value="">UF</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Campo>
          </div>
        )}

        {etapa === 2 && (
          <div className="cad-grade">
            <Campo id="renda" rotulo="Renda mensal" erro={mostrar("faixaRenda")}>
              <select id="renda" value={f.faixaRenda} onChange={set("faixaRenda")}>
                <option value="">Selecione</option>
                {FAIXAS_RENDA.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Campo>
            <Campo id="pat" rotulo="Patrimônio financeiro" erro={mostrar("faixaPatrimonio")}>
              <select id="pat" value={f.faixaPatrimonio} onChange={set("faixaPatrimonio")}>
                <option value="">Selecione</option>
                {FAIXAS_PATRIMONIO.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Campo>
            <Campo id="orig" rotulo="Origem do dinheiro que vai investir" erro={mostrar("origemRecursos")} dica="Ex.: salário, venda de imóvel, herança, lucro da empresa">
              <input id="orig" value={f.origemRecursos} onChange={set("origemRecursos")} />
            </Campo>
            <fieldset className={`cad-ppe ${mostrar("ppe") ? "cad-campo--erro" : ""}`}>
              <legend>Você é pessoa politicamente exposta (PEP)?</legend>
              <p className="cad-campo__dica">
                Quem exerce ou exerceu nos últimos 5 anos cargo público relevante (mandato eletivo, ministro, juiz de tribunal, dirigente de
                estatal, por exemplo), ou é familiar próximo dessas pessoas.
              </p>
              <label><input type="radio" name="ppe" checked={f.ppe === "nao"} onChange={() => setF((s) => ({ ...s, ppe: "nao" }))} /> Não</label>
              <label><input type="radio" name="ppe" checked={f.ppe === "sim"} onChange={() => setF((s) => ({ ...s, ppe: "sim" }))} /> Sim</label>
              {mostrar("ppe") && <span className="cad-campo__erro" role="alert">{mostrar("ppe")}</span>}
            </fieldset>
          </div>
        )}

        {etapa === 3 && (
          <>
            <p className="bloco__nota" style={{ margin: "0 0 16px" }}>
              Conta em seu nome, no mesmo CPF. É para onde vão os resgates. O dinheiro nunca passa pela plataforma.
            </p>
            <div className="cad-grade">
              <Campo id="banco" rotulo="Banco" erro={mostrar("bancoCodigo") || mostrar("bancoNome")}>
                <select id="banco" value={BANCOS.some(([c]) => c === f.bancoCodigo) ? f.bancoCodigo : f.bancoCodigo ? "outro" : ""}
                  onChange={(e) => {
                    const b = BANCOS.find(([c]) => c === e.target.value);
                    setF((s) => ({ ...s, bancoCodigo: b ? b[0] : e.target.value === "outro" ? "" : "", bancoNome: b ? b[1] : "" }));
                  }}>
                  <option value="">Selecione</option>
                  {BANCOS.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
                  <option value="outro">Outro banco</option>
                </select>
              </Campo>
              {!BANCOS.some(([c]) => c === f.bancoCodigo) && (
                <>
                  <Campo id="bcod" rotulo="Código do banco" erro={mostrar("bancoCodigo")}>
                    <input id="bcod" value={f.bancoCodigo} inputMode="numeric" maxLength={4} onChange={set("bancoCodigo")} />
                  </Campo>
                  <Campo id="bnome" rotulo="Nome do banco" erro={mostrar("bancoNome")}>
                    <input id="bnome" value={f.bancoNome} onChange={set("bancoNome")} />
                  </Campo>
                </>
              )}
              <Campo id="ag" rotulo="Agência (sem dígito)" erro={mostrar("agencia")}>
                <input id="ag" value={f.agencia} inputMode="numeric" maxLength={6} onChange={set("agencia")} />
              </Campo>
              <Campo id="conta" rotulo="Conta com dígito" erro={mostrar("conta")}>
                <input id="conta" value={f.conta} onChange={set("conta")} placeholder="12345-6" />
              </Campo>
              <Campo id="tipo" rotulo="Tipo de conta" erro={mostrar("contaTipo")}>
                <select id="tipo" value={f.contaTipo} onChange={set("contaTipo")}>
                  {TIPOS_CONTA.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo id="pix" rotulo="Chave Pix (opcional)" erro={mostrar("pix")}>
                <input id="pix" value={f.pix} onChange={set("pix")} />
              </Campo>
            </div>
          </>
        )}

        {etapa === 4 && (
          <>
            <dl className="cad-revisao">
              <div><dt>Nome</dt><dd>{f.nomeCompleto}</dd></div>
              <div><dt>CPF</dt><dd>{f.cpf}</dd></div>
              <div><dt>Nascimento</dt><dd>{f.dataNascimento && new Date(f.dataNascimento + "T12:00:00").toLocaleDateString("pt-BR")}</dd></div>
              <div><dt>Estado civil e profissão</dt><dd>{f.estadoCivil}, {f.profissao}</dd></div>
              <div><dt>Endereço</dt><dd>{f.logradouro}, {f.numero}{f.complemento ? `, ${f.complemento}` : ""}, {f.bairro}, {f.cidade}/{f.uf}</dd></div>
              <div><dt>Renda e patrimônio</dt><dd>{f.faixaRenda} · {f.faixaPatrimonio}</dd></div>
              <div><dt>PEP</dt><dd>{f.ppe === "sim" ? "Sim" : "Não"}</dd></div>
              <div><dt>Conta para resgate</dt><dd>{f.bancoNome} ({f.bancoCodigo}), ag. {f.agencia}, {f.contaTipo} {f.conta}</dd></div>
            </dl>
            <label className={`cad-declaracao ${mostrar("declaracao") ? "cad-campo--erro" : ""}`}>
              <input type="checkbox" checked={f.declaracao} onChange={(e) => setF((s) => ({ ...s, declaracao: e.target.checked }))} />
              <span>
                Declaro que as informações são verdadeiras, que a conta informada é de minha titularidade e que os recursos têm origem
                lícita. Comprometo-me a atualizar estes dados se mudarem.
              </span>
            </label>
            {mostrar("declaracao") && <span className="cad-campo__erro" role="alert">{mostrar("declaracao")}</span>}
          </>
        )}

        {salvar.error && <p className="aviso aviso--erro">{salvar.error.message}</p>}

        <div className="cad-acoes">
          {etapa > 0 ? <button type="button" className="btn btn--ghost" onClick={() => setEtapa((e) => e - 1)}>Voltar</button> : <Link href="/perfil" className="btn btn--ghost">Cancelar</Link>}
          {etapa < ETAPAS.length - 1 ? (
            <button type="button" className="btn btn--primario" onClick={avancar}>Continuar</button>
          ) : (
            <button type="button" className="btn btn--primario" onClick={enviar} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar cadastro"}
            </button>
          )}
        </div>
      </section>
      <p className="bloco__nota">Seus dados são protegidos por criptografia e usados só para o contrato e para cumprir obrigações legais.</p>
    </AreaLogada>
  );
}
