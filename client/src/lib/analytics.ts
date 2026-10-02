/**
 * Analytics só depois de consentimento (LGPD). GA4, Meta Pixel e Clarity,
 * os mesmos da Shadia e do MecProAI, carregados sob demanda.
 */
const CHAVE = "rrf_consentimento";
type Escolha = "aceito" | "recusado";

const ids = {
  ga4: import.meta.env.VITE_GA4_ID as string | undefined,
  pixel: import.meta.env.VITE_META_PIXEL_ID as string | undefined,
  clarity: import.meta.env.VITE_CLARITY_ID as string | undefined,
};

export function escolhaSalva(): Escolha | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "aceito" || v === "recusado" ? v : null;
  } catch {
    return null;
  }
}

export function salvarEscolha(e: Escolha) {
  try {
    localStorage.setItem(CHAVE, e);
  } catch {
    /* navegação privada: segue sem lembrar */
  }
  if (e === "aceito") carregarAnalytics();
}

function script(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let carregado = false;
export function carregarAnalytics() {
  if (carregado || escolhaSalva() !== "aceito") return;
  carregado = true;
  const w = window as unknown as Record<string, any>;

  if (ids.ga4) {
    script(`https://www.googletagmanager.com/gtag/js?id=${ids.ga4}`);
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", ids.ga4, { anonymize_ip: true });
  }
  if (ids.pixel) {
    const f = (w.fbq = function (...a: unknown[]) {
      (f as any).q.push(a);
    }) as any;
    f.q = [];
    script("https://connect.facebook.net/en_US/fbevents.js");
    w.fbq("init", ids.pixel);
    w.fbq("track", "PageView");
  }
  if (ids.clarity) {
    w.clarity = w.clarity || ((...a: unknown[]) => (w.clarity.q = w.clarity.q || []).push(a));
    script(`https://www.clarity.ms/tag/${ids.clarity}`);
  }
}

/** Evento de conversão (lead, simulação). Silencioso sem consentimento. */
export function rastrear(evento: "lead" | "simulacao" | "inicio_trilha" | "trilha_concluida", dados: Record<string, unknown> = {}) {
  if (escolhaSalva() !== "aceito") return;
  const w = window as unknown as Record<string, any>;
  w.gtag?.("event", evento, dados);
  if (evento === "lead") w.fbq?.("track", "Lead");
}
