import { useState } from "react";
import { escolhaSalva, salvarEscolha } from "../lib/analytics";

export function Consentimento() {
  const [visivel, setVisivel] = useState(() => escolhaSalva() === null);
  if (!visivel) return null;
  const escolher = (e: "aceito" | "recusado") => {
    salvarEscolha(e);
    setVisivel(false);
  };
  return (
    <div className="consent" role="dialog" aria-label="Cookies e privacidade">
      <p>
        Usamos cookies essenciais para o site funcionar. Com sua permissão, também usamos cookies de medição para entender
        como o site é usado. Nenhum dado financeiro é compartilhado.
      </p>
      <div className="consent__acoes">
        <button className="btn btn--ghost btn--peq" onClick={() => escolher("recusado")}>
          Só essenciais
        </button>
        <button className="btn btn--primario btn--peq" onClick={() => escolher("aceito")}>
          Aceitar
        </button>
      </div>
    </div>
  );
}
