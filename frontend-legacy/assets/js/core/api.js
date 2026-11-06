/**
 * Client REST : JSON uniquement, même origine, délai maximal, nouvelle tentative pour les lectures.
 *
 * Mode aperçu : si la page déclare <meta name="pf-fixture" content="…">, les données sont lues
 * dans ce fichier JSON (même structure que l'API Django). Utilisé pour les aperçus d'étape,
 * avant que le backend ne soit branché.
 */
import { csrfToken } from "./csrf.js";
import { lang } from "./i18n.js";

const BASE = "/api/v1";
const TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(status, data, kind = "http") {
    super(data?.detail || `HTTP ${status}`);
    Object.assign(this, { status, data: data || {}, kind });
  }
}

async function getJson(url, retries = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin", signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (retries > 0) return getJson(url, retries - 1);
    throw new ApiError(0, null, error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, null, error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

const fixture = document.querySelector('meta[name="pf-fixture"]')?.content;
export const isPreview = Boolean(fixture);

export const api = {
  site: () => (fixture ? getJson(new URL(fixture, document.baseURI).href) : getJson(`${BASE}/site/?lang=${lang}`)),
  /** Détail d'un projet publié (10 chapitres + projets précédent/suivant). 404 si inconnu ou non publié. */
  project: async (slug) => {
    if (!fixture) return getJson(`${BASE}/projects/${encodeURIComponent(slug)}/?lang=${lang}`);
    const all = await getJson(new URL(fixture.replace("site.", "projects."), document.baseURI).href);
    if (!all[slug]) throw new ApiError(404, { detail: "not found" });
    return all[slug];
  },
  /** Jeton horodaté et signé que le formulaire de contact doit renvoyer (protection anti-robots). */
  contactToken: () => (fixture ? Promise.resolve({ form_token: "apercu" }) : getJson(`${BASE}/contact/token/`)),
  /** En aperçu, l'envoi est simulé : aucune donnée ne quitte le navigateur. */
  sendContact: (payload) => (fixture ? new Promise((resolve) => setTimeout(() => resolve({ detail: "ok" }), 900)) : postJson(`${BASE}/contact/`, payload)),
};
