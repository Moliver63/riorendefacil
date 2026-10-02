/**
 * Testes de integração: tRPC + Postgres real em memória (PGlite) + HTTP.
 * Rodam com NODE_ENV=test (e-mails vão para caixaDeSaidaTeste).
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { db, aplicarMigracoes } from "../db";
import { appRouter } from "../_core/router";
import { createCallerFactory } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { assinarSessao, lerSessao } from "../_core/sessao";
import { criarApp } from "../_core/index";
import { caixaDeSaidaTeste } from "../_core/email";
import { consumirLinkAcesso, criarLinkAcesso } from "../_core/linkAcesso";
import { encontrarOuCriarUsuario } from "../contas";
import { executarLembretes } from "../_core/cronRouter";
import { htmlComMeta } from "../_core/seo";
import { investidores, leads, linksAcesso, usuarios, type Usuario } from "../schema";
import { TRILHA } from "../../shared/trilha";
import { ARTIGOS } from "../../shared/conteudo";
import { avaliarTexto } from "../../shared/complianceGuard";

const criarCaller = createCallerFactory(appRouter);

function caller(usuario: Usuario | null) {
  const cookies: Record<string, string> = {};
  const req = { cookies: {}, ip: "127.0.0.1", protocol: "http" } as unknown as TrpcContext["req"];
  const res = {
    cookie: (n: string, v: string) => (cookies[n] = v),
    clearCookie: (n: string) => delete cookies[n],
  } as unknown as TrpcContext["res"];
  return criarCaller({ req, res, usuario, ip: "127.0.0.1" });
}

async function recarregar(id: number) {
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  return u!;
}

before(async () => {
  await aplicarMigracoes();
});

// ─── Sessão e login ──────────────────────────────────────────────────────────

test("sessão: JWT assinado é lido; adulterado é rejeitado", async () => {
  const t = await assinarSessao({ sub: 7, papel: "investidor", v: 1 });
  assert.deepEqual(await lerSessao(t), { sub: 7, papel: "investidor", v: 1 });
  const [h, p, s] = t.split(".");
  const payloadAdmin = Buffer.from(JSON.stringify({ sub: "7", papel: "admin", v: 1, exp: 9999999999 })).toString("base64url");
  assert.equal(await lerSessao(`${h}.${payloadAdmin}.${s}`), null);
  assert.equal(await lerSessao(`${h}.${p}.`), null);
  assert.equal(await lerSessao(undefined), null);
});

test("link mágico: uso único e hash no banco", async () => {
  caixaDeSaidaTeste.length = 0;
  const link = await criarLinkAcesso("Pessoa@Exemplo.com ", "1.2.3.4");
  const token = new URL(link).searchParams.get("t")!;
  assert.equal(caixaDeSaidaTeste.at(-1)?.para, "pessoa@exemplo.com");
  assert.ok(caixaDeSaidaTeste.at(-1)?.html.includes(link.replace(/&/g, "&amp;")) || caixaDeSaidaTeste.at(-1)?.html.includes("api/auth/link"));

  const salvos = await db.select().from(linksAcesso).where(eq(linksAcesso.email, "pessoa@exemplo.com"));
  assert.ok(salvos.every((l) => l.tokenHash !== token && l.tokenHash.length === 64), "token nunca é salvo em claro");

  assert.equal(await consumirLinkAcesso(token), "pessoa@exemplo.com");
  assert.equal(await consumirLinkAcesso(token), null, "segundo uso falha");
});

test("link mágico expirado não funciona", async () => {
  const link = await criarLinkAcesso("expira@exemplo.com", "");
  const token = new URL(link).searchParams.get("t")!;
  await db.update(linksAcesso).set({ expiraEm: new Date(Date.now() - 1000) }).where(eq(linksAcesso.email, "expira@exemplo.com"));
  assert.equal(await consumirLinkAcesso(token), null);
});

test("pedirLink responde igual para e-mail novo e existente", async () => {
  await encontrarOuCriarUsuario({ email: "existe@exemplo.com" });
  const a = await caller(null).auth.pedirLink({ email: "existe@exemplo.com" });
  const b = await caller(null).auth.pedirLink({ email: "naoexiste@exemplo.com" });
  assert.equal(a.ok, b.ok);
});

test("ADMIN_EMAILS promove no login; usuário comum vira investidor com cadastro", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("chefe@exemplo.com");
  const admin = await encontrarOuCriarUsuario({ email: "Chefe@Exemplo.com" });
  assert.equal(admin.papel, "admin");
  const inv = await encontrarOuCriarUsuario({ email: "novo@exemplo.com" });
  assert.equal(inv.papel, "investidor");
  const [cad] = await db.select().from(investidores).where(eq(investidores.usuarioId, inv.id));
  assert.ok(cad);
});

// ─── Permissões ──────────────────────────────────────────────────────────────

test("permissões: anônimo não entra, investidor não vê admin", async () => {
  await assert.rejects(caller(null).investidor.perfil(), { code: "UNAUTHORIZED" });
  const inv = await encontrarOuCriarUsuario({ email: "perm@exemplo.com" });
  await assert.rejects(caller(inv).admin.resumo(), { code: "FORBIDDEN" });
  await assert.rejects(caller(inv).admin.leads.listar(), { code: "FORBIDDEN" });
  await assert.rejects(caller(inv).admin.usuarios.listar(), { code: "FORBIDDEN" });
});

test("mudar papel derruba sessões antigas (versaoSessao)", async () => {
  const { ENV } = await import("../_core/env");
  ENV.adminEmails.push("admin2@exemplo.com");
  const admin = await encontrarOuCriarUsuario({ email: "admin2@exemplo.com" });
  const alvo = await encontrarOuCriarUsuario({ email: "alvo@exemplo.com" });
  await caller(admin).admin.usuarios.mudarPapel({ id: alvo.id, papel: "assessor" });
  const depois = await recarregar(alvo.id);
  assert.equal(depois.papel, "assessor");
  assert.equal(depois.versaoSessao, alvo.versaoSessao + 1);
  await assert.rejects(caller(admin).admin.usuarios.mudarPapel({ id: admin.id, papel: "investidor" }), { code: "BAD_REQUEST" });
});

// ─── Trilha, suitability e interesse ─────────────────────────────────────────

const certas = (slug: string) => Object.fromEntries(TRILHA.find((m) => m.slug === slug)!.perguntas.map((p) => [p.id, p.correta]));
const erradas = (slug: string) =>
  Object.fromEntries(TRILHA.find((m) => m.slug === slug)!.perguntas.map((p) => [p.id, (p.correta + 1) % p.opcoes.length]));

test("trilha: módulos abrem em ordem, reprovação não conta, conclusão grava data", async () => {
  const u = await encontrarOuCriarUsuario({ email: "trilha@exemplo.com" });
  const c = caller(u);
  const [m1, m2] = TRILHA;

  await assert.rejects(c.trilha.modulo({ slug: m2!.slug }), { code: "FORBIDDEN" });
  const mod = await c.trilha.modulo({ slug: m1!.slug });
  assert.ok(!("correta" in mod.perguntas[0]!), "gabarito não vaza para o cliente");

  const reprov = await c.trilha.responder({ slug: m1!.slug, respostas: erradas(m1!.slug) });
  assert.equal(reprov.aprovado, false);
  assert.equal((await c.trilha.estado()).modulos[0]!.concluido, false);

  for (const m of TRILHA) {
    const r = await c.trilha.responder({ slug: m.slug, respostas: certas(m.slug) });
    assert.equal(r.aprovado, true);
  }
  assert.equal((await c.trilha.estado()).completa, true);
  assert.ok((await c.investidor.perfil()).trilhaConcluidaEm);
});

test("interesse em aporte exige trilha e perfil adequado", async () => {
  const u = await encontrarOuCriarUsuario({ email: "interesse@exemplo.com" });
  const c = caller(u);
  await assert.rejects(c.investidor.manifestarInteresse(), /trilha/);

  for (const m of TRILHA) await c.trilha.responder({ slug: m.slug, respostas: certas(m.slug) });
  await assert.rejects(c.investidor.manifestarInteresse(), /questionário/);

  const semReserva = await c.investidor.salvarSuitability({ respostas: { objetivo: 1, prazo: 2, reserva: 0, experiencia: 1, perda: 1 } });
  assert.equal(semReserva.adequado, false);
  await assert.rejects(c.investidor.manifestarInteresse(), /reserva/);

  const ok = await c.investidor.salvarSuitability({ respostas: { objetivo: 1, prazo: 2, reserva: 2, experiencia: 1, perda: 1 } });
  assert.equal(ok.adequado, true);
  assert.deepEqual(await c.investidor.manifestarInteresse(), { ok: true });
});

test("resgate fica travado enquanto o emissor não está habilitado", async () => {
  const u = await encontrarOuCriarUsuario({ email: "resgate@exemplo.com" });
  await assert.rejects(
    caller(u).investidor.solicitarResgate({ contratoId: 1, valorCentavos: 100, idempotencyKey: crypto.randomUUID() }),
    { code: "PRECONDITION_FAILED" },
  );
});

// ─── Captação, vitrine e cron ────────────────────────────────────────────────

test("lead é gravado com consentimento e cron avisa a equipe uma vez", async () => {
  const { ENV } = await import("../_core/env");
  ENV.emailsAssessores.push("assessor@exemplo.com");
  const r = await caller(null).leads.criar({
    nome: "Maria Teste",
    email: "Maria@Exemplo.com",
    telefone: "47999998888",
    consentimento: true,
    origem: "site",
  });
  const [l] = await db.select().from(leads).where(eq(leads.id, r.id));
  assert.equal(l!.email, "maria@exemplo.com");
  assert.equal(l!.consentimentoLGPD, true);

  await db.update(leads).set({ criadoEm: new Date(Date.now() - 30 * 3_600_000) }).where(eq(leads.id, r.id));
  caixaDeSaidaTeste.length = 0;
  const p1 = await executarLembretes();
  assert.ok(p1.leadsParados >= 1);
  assert.ok(caixaDeSaidaTeste.some((e) => e.para === "assessor@exemplo.com"));
  const p2 = await executarLembretes();
  assert.equal(p2.leadsParados, 0, "não repete o lembrete");
});

test("lead recusa telefone inválido e consentimento ausente", async () => {
  await assert.rejects(
    caller(null).leads.criar({ nome: "X Y Z", email: "a@b.com", telefone: "123", consentimento: true, origem: "site" }),
  );
  await assert.rejects(
    // @ts-expect-error consentimento é obrigatório
    caller(null).leads.criar({ nome: "X Y Z", email: "a@b.com", telefone: "47999998888", origem: "site" }),
  );
});

test("vitrine usa lastro de exemplo sem oferta ativa e simulador responde", async () => {
  const l = await caller(null).plataforma.lastro();
  assert.equal(l.exemplo, true);
  assert.ok(l.itens.length > 0);
  const s = await caller(null).simulador.calcular({ aporteCentavos: 100_000_00, prazoMeses: 12 });
  assert.equal(s.elegivel, true);
  if (s.elegivel) assert.equal(s.exemplo, true);
});

// ─── SEO e conteúdo ──────────────────────────────────────────────────────────

test("meta tags por rota e noindex na área logada", () => {
  const tpl = "<head><!--meta--><title>x</title><!--/meta--></head>";
  const art = htmlComMeta(tpl, `/conteudo/${ARTIGOS[0]!.slug}`);
  assert.ok(art.includes(ARTIGOS[0]!.titulo));
  assert.ok(art.includes('content="index, follow"'));
  assert.ok(htmlComMeta(tpl, "/painel").includes("noindex"));
  assert.ok(htmlComMeta(tpl, '/"><script>').includes("&quot;&gt;&lt;script&gt;"));
});

test("todo artigo público passa no revisor de comunicação", () => {
  for (const a of ARTIGOS) {
    const texto = [a.titulo, a.resumo, ...a.secoes.flatMap((s) => [s.titulo ?? "", ...s.paragrafos])].join(" ");
    const r = avaliarTexto(texto);
    assert.equal(r.aprovado, true, `${a.slug}: ${JSON.stringify(r.achados)}`);
  }
});

// ─── HTTP de ponta a ponta ───────────────────────────────────────────────────

test("HTTP: link mágico grava cookie e o cookie forjado da Shadia é ignorado", async () => {
  const app = criarApp();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);

    const link = await criarLinkAcesso("http@exemplo.com", "");
    const token = new URL(link).searchParams.get("t")!;
    const r = await fetch(`${base}/api/auth/link?t=${encodeURIComponent(token)}`, { redirect: "manual" });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/painel");
    const cookie = r.headers.get("set-cookie")!;
    assert.match(cookie, /rrf_sessao=.+HttpOnly/i);

    const eu = async (c: string) => {
      const resp = await fetch(`${base}/api/trpc/auth.eu`, { headers: { cookie: c } });
      return ((await resp.json()) as { result: { data: { json: { email: string } | null } } }).result.data.json;
    };
    assert.equal((await eu(cookie.split(";")[0]!))?.email, "http@exemplo.com");
    const me = (await (await fetch(`${base}/api/auth/me`, { headers: { cookie: cookie.split(";")[0]! } })).json()) as { email: string } | null;
    assert.equal(me?.email, "http@exemplo.com", "REST /api/auth/me lê a mesma sessão");
    assert.equal(await (await fetch(`${base}/api/auth/me`)).json(), null);
    assert.equal((await fetch(`${base}/assets/x.js.map`)).status, 404);

    // ataque que funciona na Shadia: cookie JSON sem assinatura
    const [alvo] = await db.select().from(usuarios).where(eq(usuarios.email, "http@exemplo.com"));
    const forjado = encodeURIComponent(JSON.stringify({ id: alvo!.id, email: alvo!.email, role: "admin" }));
    assert.equal(await eu(`rrf_sessao=${forjado}`), null);

    const reuso = await fetch(`${base}/api/auth/link?t=${encodeURIComponent(token)}`, { redirect: "manual" });
    assert.equal(reuso.headers.get("location"), "/entrar?erro=link_expirado");

    const robots = await (await fetch(`${base}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.equal((await fetch(`${base}/api/cron/lembretes`, { method: "POST" })).status, 503);
  } finally {
    server.close();
  }
});

test("raiz do projeto é a mesma no fonte e no pacote dist/", async () => {
  const path = await import("node:path");
  const { raizDoProjeto } = await import("../_core/raiz");
  const r = raizDoProjeto();
  assert.equal(raizDoProjeto(path.join(r, "server/_core")), r);
  assert.equal(raizDoProjeto(path.join(r, "dist")), r);
});

// ─── Login com Google (respostas do Google simuladas) ────────────────────────

test("Google: destinoSeguro só aceita caminho interno", async () => {
  const { destinoSeguro } = await import("../_core/oauthGoogle");
  assert.equal(destinoSeguro("/trilha/riscos"), "/trilha/riscos");
  assert.equal(destinoSeguro("https://malicioso.com"), null);
  assert.equal(destinoSeguro("//malicioso.com"), null);
  assert.equal(destinoSeguro("/\\malicioso.com"), null);
  assert.equal(destinoSeguro("/api/auth/logout"), null);
  assert.equal(destinoSeguro(undefined), null);
});

test("Google: fluxo completo cria conta, grava sessão e volta para a página de origem", async () => {
  const { ENV } = await import("../_core/env");
  ENV.googleClientId = "cliente-teste.apps.googleusercontent.com";
  ENV.googleClientSecret = "segredo-teste";

  const fetchReal = globalThis.fetch;
  let codigoUsado = "";
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") {
      const corpo = new URLSearchParams(String(init?.body));
      codigoUsado = corpo.get("code") ?? "";
      if (codigoUsado === "codigo-velho") return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      assert.equal(corpo.get("redirect_uri"), `${ENV.appUrl}/api/auth/google/callback`);
      return new Response(JSON.stringify({ access_token: "tk" }), { status: 200 });
    }
    if (u === "https://openidconnect.googleapis.com/v1/userinfo") {
      return new Response(JSON.stringify({ sub: "g-123", email: "Google.User@Gmail.com", email_verified: true, name: "Google User" }));
    }
    return fetchReal(url as string, init);
  }) as typeof fetch;

  const server = criarApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    // 1. início: redireciona para o Google com state e grava cookie
    const ini = await fetchReal(`${base}/api/auth/google?voltar=${encodeURIComponent("/trilha/riscos")}`, { redirect: "manual" });
    assert.equal(ini.status, 302);
    const destinoGoogle = new URL(ini.headers.get("location")!);
    assert.equal(destinoGoogle.origin + destinoGoogle.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    const state = destinoGoogle.searchParams.get("state")!;
    assert.ok(state.length > 20);
    assert.equal(destinoGoogle.searchParams.get("redirect_uri"), `${ENV.appUrl}/api/auth/google/callback`);
    const cookieEstado = ini.headers.get("set-cookie")!.split(";")[0]!;

    // 2. retorno com state errado é recusado
    const forjado = await fetchReal(`${base}/api/auth/google/callback?code=x&state=outro`, { headers: { cookie: cookieEstado }, redirect: "manual" });
    assert.equal(forjado.headers.get("location"), "/entrar?erro=estado_invalido");

    // 3. código expirado vira mensagem específica
    const velho = await fetchReal(`${base}/api/auth/google/callback?code=codigo-velho&state=${state}`, { headers: { cookie: cookieEstado }, redirect: "manual" });
    assert.equal(velho.headers.get("location"), "/entrar?erro=google_expirado");

    // 4. retorno certo: cria conta, grava sessão e volta para /trilha/riscos
    const ok = await fetchReal(`${base}/api/auth/google/callback?code=codigo-bom&state=${state}`, { headers: { cookie: cookieEstado }, redirect: "manual" });
    assert.equal(ok.headers.get("location"), "/trilha/riscos");
    const sessao = ok.headers.get("set-cookie")!.split(",").map((c) => c.trim()).find((c) => c.startsWith("rrf_sessao="))!;
    assert.ok(sessao, "cookie de sessão gravado");
    const me = (await (await fetchReal(`${base}/api/auth/me`, { headers: { cookie: sessao.split(";")[0]! } })).json()) as { email: string; papel: string };
    assert.equal(me.email, "google.user@gmail.com");
    assert.equal(me.papel, "investidor");
    const [u] = await db.select().from(usuarios).where(eq(usuarios.email, "google.user@gmail.com"));
    assert.equal(u!.googleSub, "g-123");

    // 5. cancelar na tela do Google
    const cancel = await fetchReal(`${base}/api/auth/google/callback?error=access_denied`, { redirect: "manual" });
    assert.equal(cancel.headers.get("location"), "/entrar?erro=google_cancelado");

    // 6. tRPC informa que o Google está ligado (mostra o botão)
    const metodos = (await (await fetchReal(`${base}/api/trpc/auth.metodos`)).json()) as { result: { data: { json: { google: boolean } } } };
    assert.equal(metodos.result.data.json.google, true);
  } finally {
    server.close();
    globalThis.fetch = fetchReal;
    ENV.googleClientId = "";
    ENV.googleClientSecret = "";
  }
});
