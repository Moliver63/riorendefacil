import { AreaLogada } from "@/components/layout/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/SEO";
import { PAPEIS, type Papel } from "~shared/const";

const ROTULO: Record<Papel, string> = { investidor: "Investidor", assessor: "Assessor", admin: "Admin" };

export default function AdminUsuarios() {
  const utils = trpc.useUtils();
  const { user: eu } = useAuth();
  const { data } = trpc.admin.usuarios.listar.useQuery();
  const mudar = trpc.admin.usuarios.mudarPapel.useMutation({ onSuccess: () => utils.admin.usuarios.listar.invalidate() });

  return (
    <AreaLogada titulo="Usuários" subtitulo="Mudar o papel de alguém encerra as sessões abertas dessa pessoa.">
      <Seo titulo="Usuários" indexar={false} />
      <section className="bloco">
        {mudar.error && <p className="aviso aviso--erro">{mudar.error.message}</p>}
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Usuário</th><th>Último acesso</th><th>Papel</th></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome ?? "Sem nome"}</strong><span className="sub">{u.email}</span></td>
                  <td>{u.ultimoLoginEm ? new Date(u.ultimoLoginEm).toLocaleString("pt-BR") : "–"}</td>
                  <td>
                    <select value={u.papel} disabled={u.id === eu?.id} onChange={(e) => mudar.mutate({ id: u.id, papel: e.target.value as Papel })} aria-label={`Papel de ${u.email}`}>
                      {PAPEIS.map((p) => <option key={p} value={p}>{ROTULO[p]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AreaLogada>
  );
}
