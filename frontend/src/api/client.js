/**
 * Client de l'API REST Django (/api/v1/) : JSON uniquement, même origine, délai maximal,
 * une nouvelle tentative pour les lectures, jeton CSRF pour les écritures.
 *
 * En développement, Vite relaie /api vers Django (voir vite.config.js) : l'origine reste la même.
 */
const BASE = "/api/v1";
const TIMEOUT_MS = 10000;
const CSRF_COOKIE = "pf_csrftoken";

export class ApiError extends Error {
  /** kind : "http" (réponse d'erreur), "network" (pas de réponse) ou "timeout". */
  constructor(status, data, kind = "http") {
    super(data?.detail || `HTTP ${status}`);
    Object.assign(this, { status, data: data || {}, kind });
  }
}

async function request(url, { method = "GET", body, retries = 0, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const headers = { Accept: "application/json" };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      headers["X-CSRFToken"] = await csrfToken();
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error; // annulation volontaire (composant démonté) : pas de nouvelle tentative
    if (retries > 0) return request(url, { method, body, retries: retries - 1, signal });
    throw new ApiError(0, null, error.name === "AbortError" ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

/** Jeton CSRF de Django : lu dans le cookie, sinon demandé à l'API (qui pose le cookie). */
export async function csrfToken() {
  const entry = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  if (entry) return decodeURIComponent(entry.slice(CSRF_COOKIE.length + 1));
  const response = await fetch(`${BASE}/auth/csrf/`, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new ApiError(response.status, null);
  return (await response.json()).csrf_token;
}

export const api = {
  /** Profil, compétences, parcours, catégories et projets publiés, dans la langue demandée. */
  site: (lang, signal) => request(`${BASE}/site/?lang=${lang}`, { retries: 1, signal }),
  /** Détail d'un projet publié (10 chapitres + projets précédent/suivant). 404 si inconnu ou non publié. */
  project: (slug, lang, signal) =>
    request(`${BASE}/projects/${encodeURIComponent(slug)}/?lang=${lang}`, { retries: 1, signal }),
  /** Jeton horodaté et signé que le formulaire de contact doit renvoyer (protection anti-robots). */
  contactToken: () => request(`${BASE}/contact/token/`),
  sendContact: (payload) => request(`${BASE}/contact/`, { method: "POST", body: payload }),
};
