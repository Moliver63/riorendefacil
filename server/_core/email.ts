/**
 * E-mail via Resend. Padrão Caro: "melhor esforço". Se a chave não estiver
 * configurada, loga e segue, nunca derruba o fluxo principal.
 * Em desenvolvimento, o conteúdo vai para o console (útil para o link mágico).
 */
import { Resend } from "resend";
import { ENV } from "./env";
import { AVISO_RISCO } from "../../shared/complianceGuard";

let cliente: Resend | null = null;
function resend(): Resend | null {
  if (!ENV.resendApiKey) return null;
  cliente ??= new Resend(ENV.resendApiKey);
  return cliente;
}

export type EmailEnviado = { para: string; assunto: string; html: string };
/** Caixa de saída em memória, usada pelos testes. */
export const caixaDeSaidaTeste: EmailEnviado[] = [];

export async function enviarEmail(p: EmailEnviado & { responderPara?: string }): Promise<boolean> {
  if (ENV.isTest) {
    caixaDeSaidaTeste.push(p);
    return true;
  }
  const r = resend();
  if (!r) {
    console.warn(`[email] RESEND_API_KEY ausente. Para: ${p.para} | ${p.assunto}`);
    if (!ENV.isProduction) console.info(`[email] conteúdo (dev):\n${p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}`);
    return false;
  }
  try {
    await r.emails.send({
      from: ENV.emailRemetente,
      to: p.para,
      subject: p.assunto,
      html: p.html,
      ...(p.responderPara && { replyTo: p.responderPara }),
    });
    return true;
  } catch (e) {
    console.error(`[email] falha ao enviar para ${p.para}:`, e);
    return false;
  }
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function envelope(conteudo: string, comAvisoRisco = false) {
  return `
  <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#142322;padding:8px">
    <p style="font-size:20px;color:#0d2a2b;margin:0 0 24px">RioRende<em style="color:#c0673a">Fácil</em></p>
    ${conteudo}
    ${comAvisoRisco ? `<p style="margin-top:28px;font-size:12px;color:#5a6b68;font-family:Arial,sans-serif">${AVISO_RISCO}</p>` : ""}
    <p style="margin-top:28px;font-size:12px;color:#5a6b68;font-family:Arial,sans-serif">
      Plataforma de tecnologia. Não somos banco nem emissor.
    </p>
  </div>`;
}

const botao = (href: string, texto: string) =>
  `<p style="margin:28px 0"><a href="${href}" style="background:#c0673a;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">${escapar(texto)}</a></p>`;

export function emailLinkAcesso(link: string, minutos: number) {
  return envelope(`
    <h1 style="font-size:22px;font-weight:normal">Seu link de acesso</h1>
    <p>Clique no botão para entrar. O link vale por ${minutos} minutos e só funciona uma vez.</p>
    ${botao(link, "Entrar no RioRendeFácil")}
    <p style="font-size:13px;color:#5a6b68">Se não foi você que pediu, ignore este e-mail. Ninguém entra sem acesso à sua caixa de entrada.</p>
  `);
}

export function emailLeadRecebido(nome: string) {
  return envelope(
    `
    <h1 style="font-size:22px;font-weight:normal">Recebemos seu contato, ${escapar(nome.split(" ")[0] ?? nome)}</h1>
    <p>Um especialista vai falar com você para entender seu momento e explicar a estrutura com calma.</p>
    <p>Enquanto isso, a trilha "Antes de investir" explica em poucos minutos o que é CCB, de onde vem o rendimento e quais são os riscos.</p>
    ${botao(`${ENV.appUrl}/entrar`, "Começar a trilha")}
  `,
    true,
  );
}

export function emailAvisoLeadEquipe(p: { nome: string; email: string; telefone: string; faixa?: string | null }) {
  return envelope(`
    <h1 style="font-size:20px;font-weight:normal">Novo lead</h1>
    <p><strong>${escapar(p.nome)}</strong><br>${escapar(p.email)}<br>${escapar(p.telefone)}<br>Faixa: ${escapar(p.faixa ?? "não informada")}</p>
    ${botao(`${ENV.appUrl}/admin/leads`, "Abrir no painel")}
  `);
}

export function emailLembreteLeadParado(qtd: number) {
  return envelope(`
    <h1 style="font-size:20px;font-weight:normal">${qtd} lead${qtd > 1 ? "s" : ""} sem contato há mais de 24h</h1>
    <p>Quem pede contato e não é atendido no primeiro dia esfria rápido.</p>
    ${botao(`${ENV.appUrl}/admin/leads`, "Ver leads")}
  `);
}

export function emailLembreteTrilha(nome: string | null) {
  return envelope(
    `
    <h1 style="font-size:22px;font-weight:normal">${nome ? `${escapar(nome.split(" ")[0]!)}, ` : ""}falta pouco</h1>
    <p>Você começou a trilha "Antes de investir" e parou no meio. São poucos minutos para entender a estrutura e os riscos antes de qualquer decisão.</p>
    ${botao(`${ENV.appUrl}/trilha`, "Continuar a trilha")}
  `,
    true,
  );
}

export function emailContratoGerado(p: { nome: string; contratoId: number; valor: string; taxa: string; prazo: number }) {
  return envelope(
    `
    <h1 style="font-size:22px;font-weight:normal">${escapar(p.nome.split(" ")[0] ?? p.nome)}, seu contrato está pronto</h1>
    <p>Geramos o contrato #${p.contratoId}: ${escapar(p.valor)}, ${escapar(p.taxa)} ao mês, prazo de ${p.prazo} meses.</p>
    <p>Leia com calma. A assinatura e o aporte acontecem só depois, com o especialista.</p>
    ${botao(`${ENV.appUrl}/contrato/${p.contratoId}`, "Ler o contrato")}
  `,
    true,
  );
}

export function emailAporteConfirmado(p: { nome: string | null; valor: string; inicio: string; vencimento: string }) {
  const d = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
  return envelope(
    `
    <h1 style="font-size:22px;font-weight:normal">Seu investimento está ativo</h1>
    <p>${p.nome ? `${escapar(p.nome.split(" ")[0]!)}, c` : "C"}onfirmamos o aporte de ${escapar(p.valor)} na conta vinculada do emissor.</p>
    <p>O rendimento conta desde ${d(p.inicio)}. O principal fica disponível no vencimento, em ${d(p.vencimento)}.</p>
    ${botao(`${ENV.appUrl}/painel`, "Ver minha carteira")}
  `,
    true,
  );
}

export function emailResgatePago(p: { nome: string | null; bruto: string; ir: string; liquido: string }) {
  return envelope(`
    <h1 style="font-size:22px;font-weight:normal">Resgate pago</h1>
    <p>${p.nome ? `${escapar(p.nome.split(" ")[0]!)}, o` : "O"} resgate de rendimento foi transferido para sua conta cadastrada.</p>
    <p>Bruto: ${escapar(p.bruto)}<br>IR retido: ${escapar(p.ir)}<br><strong>Líquido: ${escapar(p.liquido)}</strong></p>
    ${botao(`${ENV.appUrl}/painel`, "Ver extrato")}
  `);
}

export function emailResgateRecusado(p: { nome: string | null; motivo: string }) {
  return envelope(`
    <h1 style="font-size:22px;font-weight:normal">Pedido de resgate não aprovado</h1>
    <p>${p.nome ? `${escapar(p.nome.split(" ")[0]!)}, s` : "S"}eu pedido de resgate não foi aprovado. Motivo: ${escapar(p.motivo)}</p>
    <p>O valor continua disponível na sua carteira. Se tiver dúvida, responda este e-mail.</p>
  `);
}
