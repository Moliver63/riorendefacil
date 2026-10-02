import { Link } from "wouter";
import { Marca } from "@/components/landing/SiteLayout";
import { Seo } from "@/components/SEO";
import { trpc } from "@/lib/trpc";
import { formatarBRL, formatarPct, taxaAnualEquivalente } from "~shared/finance";
import { AVISO_RISCO } from "~shared/complianceGuard";

type Qualificacao = {
  nomeCompleto: string;
  cpfMascarado: string;
  dataNascimento: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  endereco: string;
  ppe: boolean;
  contaResgate: string;
  capturadaEm: string;
};

const data = (iso: string | Date | null | undefined) =>
  iso ? new Date(typeof iso === "string" && iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "a definir";

/**
 * Resumo do contrato com a qualificação congelada do investidor. Serve para
 * leitura antes da assinatura e para impressão. O instrumento jurídico oficial
 * é a minuta do emissor; este documento não a substitui.
 */
export default function ContratoDocumento({ id }: { id: number }) {
  const { data: c, error, isLoading } = trpc.investidor.contrato.useQuery({ id });

  if (isLoading) return <div className="carregando-tela">Carregando…</div>;
  if (error || !c) {
    return (
      <div className="erro-tela">
        <strong>Contrato não encontrado</strong>
        <Link href="/painel" className="btn btn--primario">Voltar à carteira</Link>
      </div>
    );
  }
  const q = c.qualificacao as Qualificacao | null;
  const emissor = c.emissor.nome ?? "Emissor parceiro (a ser identificado)";

  return (
    <div className="doc">
      <Seo titulo={`Contrato #${c.id}`} indexar={false} />
      <div className="doc__barra no-print">
        <Link href="/painel" className="btn btn--ghost btn--peq">← Carteira</Link>
        <span className={`status ${c.status === "ativo" ? "status--adimplente" : "status--alerta"}`}>{c.statusRotulo}</span>
        <button className="btn btn--primario btn--peq" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
      </div>

      <article className="doc__folha">
        <header className="doc__cab">
          <Marca />
          <div>
            <span className="doc__num">Contrato nº {String(c.id).padStart(6, "0")}</span>
            <span className="doc__data">Gerado em {data(c.criadoEm)}</span>
          </div>
        </header>

        <p className="doc__aviso">
          Resumo das condições para leitura. O instrumento oficial é a minuta do emissor, apresentada para assinatura junto com
          os documentos da oferta e das garantias. Em caso de divergência, prevalece o instrumento assinado.
        </p>

        <h1>Termo de adesão à oferta {c.ofertaCodigo ?? c.oferta}</h1>

        <section>
          <h2>1. Partes</h2>
          <p>
            <strong>Investidor:</strong>{" "}
            {q ? (
              <>
                {q.nomeCompleto}, {q.nacionalidade}, {q.estadoCivil}, {q.profissao}, inscrito(a) no CPF sob o nº {q.cpfMascarado},
                nascido(a) em {data(q.dataNascimento)}, residente em {q.endereco}.{q.ppe ? " Declara ser pessoa politicamente exposta." : ""}
              </>
            ) : (
              "qualificação indisponível"
            )}
          </p>
          <p>
            <strong>Emissor:</strong> {emissor}
            {c.emissor.cnpj ? `, CNPJ ${c.emissor.cnpj}` : ""}, responsável pela estruturação da oferta, pelas garantias e pela conta vinculada
            {c.emissor.custodiante ? ` administrada por ${c.emissor.custodiante}` : ""}.
          </p>
          <p>
            <strong>Plataforma:</strong> RioRendeFácil, fornecedora de tecnologia. Não recebe, não guarda e não movimenta recursos do investidor.
          </p>
        </section>

        <section>
          <h2>2. Condições</h2>
          <table className="doc__tabela">
            <tbody>
              <tr><th>Oferta</th><td>{c.oferta}</td></tr>
              <tr><th>Valor aportado</th><td className="num">{formatarBRL(c.principalCentavos)}</td></tr>
              <tr><th>Remuneração</th><td className="num">{formatarPct(c.taxaMensal)} ao mês ({formatarPct(taxaAnualEquivalente(c.taxaMensal))} ao ano equivalente), rendimento pro rata dia sobre o valor aportado</td></tr>
              <tr><th>Prazo</th><td>{c.prazoMeses} meses{c.inicio ? `, de ${data(c.inicio)} a ${data(c.vencimento)}` : ", contados da confirmação do aporte"}</td></tr>
              <tr><th>Principal</th><td>devolvido no vencimento, com a recompra dos títulos pela Rio</td></tr>
              <tr><th>Resgate do rendimento</th><td>a pedido do investidor, pago em até {c.prazoResgateDias} dias corridos, limitado ao rendimento disponível</td></tr>
              <tr><th>Conta para pagamentos</th><td>{q?.contaResgate ?? "a informar"}</td></tr>
              <tr><th>Tributação</th><td>IR retido na fonte sobre o rendimento, pela tabela regressiva (22,5% a 15% conforme o prazo)</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>3. Destinação, lastro e garantias</h2>
          <p>
            Os recursos são depositados na conta vinculada da oferta e destinados exclusivamente à compra à vista de soja,
            milho e sorgo de produtores rurais, para revenda a cerealistas, cooperativas, indústrias e tradings previamente
            analisados. Cada operação é registrada com nota fiscal, transporte, comprador e recebimento.
          </p>
          <p>
            Os pagamentos dos compradores entram na conta vinculada e seguem esta ordem: impostos e custos autorizados,
            principal dos investidores, remuneração dos investidores e, por último, a margem operacional da Rio.
          </p>
          <p>
            A Rio garante as obrigações perante o investidor por meio de CCBs lastreadas em imóveis, mantém seguro das
            cargas durante o transporte e se compromete a recomprar os títulos do investidor no vencimento. Não há cobertura
            do FGC. A oferta conta com garantias em CCBs com imóvel. Se a cobertura (garantias elegíveis divididas pelo principal
            captado) ficar abaixo de {Math.round(c.coberturaMinima * 100)}%, novas captações e novas operações ficam
            suspensas até a recomposição.
          </p>
        </section>

        <section>
          <h2>4. Riscos</h2>
          <p>{AVISO_RISCO}</p>
          <p>
            O investidor declara ter concluído a trilha educativa da plataforma, ter respondido o questionário de perfil e
            compreender que o principal permanece indisponível até o vencimento.
          </p>
        </section>

        <section>
          <h2>5. Assinaturas</h2>
          <div className="doc__assinaturas">
            <div><span className="doc__linha" />{q?.nomeCompleto ?? "Investidor"}<small>Investidor</small></div>
            <div><span className="doc__linha" />{emissor}<small>Emissor</small></div>
          </div>
          {c.assinadoEm && <p className="doc__registro">Assinatura registrada em {data(c.assinadoEm)}.</p>}
        </section>

        <footer className="doc__rodape">
          Qualificação capturada do cadastro em {q ? data(q.capturadaEm) : "-"}. CPF e conta exibidos parcialmente por segurança.
        </footer>
      </article>
    </div>
  );
}
