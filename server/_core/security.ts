import type { RequestHandler } from "express";
import { ENV } from "./env";

/**
 * Cabeçalhos de segurança. CSP liberando só o que o site usa: Google Fonts,
 * GA4, Meta Pixel e Clarity (carregados apenas após consentimento).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.facebook.com https://*.clarity.ms https://*.r2.cloudflarestorage.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

export const cabecalhosSeguranca: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (ENV.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Content-Security-Policy", CSP);
  }
  next();
};
