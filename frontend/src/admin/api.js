/**
 * Client de l'API d'administration et d'authentification (/api/v1/).
 *
 * La session repose sur un cookie HttpOnly posé par Django ; chaque écriture envoie le jeton CSRF.
 * C'est toujours le serveur qui décide de l'accès : une réponse 401/403 sur une route /admin/
 * déclenche une nouvelle vérification de la session (retour à l'écran de connexion si elle a expiré).
 */
import { csrfToken } from "../api/client.js";

const BASE = "/api/v1";

/**
 * Préfixe de la page d'administration (DASHBOARD_PREFIX côté Django), déduit de l'adresse :
 * admin.html n'est servi que sous ce préfixe, il n'a donc pas à être connu à la construction.
 */
export const ADMIN_BASE = `/${window.location.pathname.split("/")[1] || "gestion"}`;

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || (status ? `Erreur ${status}` : "Connexion au serveur impossible. Vérifiez votre réseau."));
    this.status = status;
    this.data = data && typeof data === "object" ? data : {};
  }
}

let unauthorizedHandler = null;
/** Appelé quand l'API refuse l'accès à une route d'administration (session expirée ou révoquée). */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function request(path, { method = "GET", body, form } = {}) {
  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["X-CSRFToken"] = await csrfToken();
  let payload;
  if (form) payload = form; // multipart : le navigateur fixe lui-même le Content-Type
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, null);
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if ((response.status === 401 || response.status === 403) && path.startsWith("/admin/")) unauthorizedHandler?.();
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, file, extra = {}) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
    return request(path, { method: "POST", form });
  },
};

/** Authentification de l'administrateur (apps/accounts). */
export const auth = {
  me: () => request("/auth/me/"),
  login: (username, password) => request("/auth/login/", { method: "POST", body: { username, password } }),
  logout: () => request("/auth/logout/", { method: "POST" }),
  changePassword: (current_password, new_password) =>
    request("/auth/password/change/", { method: "POST", body: { current_password, new_password } }),
  requestReset: (email) => request("/auth/password/reset/", { method: "POST", body: { email } }),
  confirmReset: (uid, token, new_password) =>
    request("/auth/password/reset/confirm/", { method: "POST", body: { uid, token, new_password } }),
};

/** Récupère toutes les pages d'une liste paginée (petits volumes uniquement). */
export async function getAll(path) {
  const first = await api.get(path);
  if (Array.isArray(first)) return first;
  const results = [...first.results];
  let next = first.next;
  while (next) {
    const url = new URL(next, window.location.origin);
    const page = await api.get(url.pathname.replace(BASE, "") + url.search);
    results.push(...page.results);
    next = page.next;
  }
  return results;
}

/** Message lisible pour une erreur d'API (validation, limitation, réseau…). */
export function errorMessage(error) {
  if (!error) return "Erreur inconnue.";
  if (error.status === 429) return error.data?.detail || "Trop de requêtes : patientez un instant avant de réessayer.";
  if (error.status === 413) return "Fichier trop volumineux.";
  if (error.data && typeof error.data === "object") {
    const parts = [];
    for (const [key, value] of Object.entries(error.data)) {
      const text = [].concat(value).map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join(" ");
      parts.push(key === "detail" || key === "non_field_errors" ? text : `${key} : ${text}`);
    }
    if (parts.length) return parts.join(" — ");
  }
  return error.message || "Erreur inconnue.";
}
