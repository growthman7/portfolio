/**
 * Client de l'API d'administration. Chaque appel s'appuie sur la session (cookie HttpOnly)
 * et envoie le jeton CSRF pour toute écriture. Une réponse 401/403 sur une route protégée
 * renvoie vers la page de connexion : c'est le serveur qui décide de l'accès, jamais le navigateur.
 */
import { csrfToken } from "./csrf.js";

const BASE = "/api/v1";
export const prefix = document.body.dataset.prefix || "/gestion/";

export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.detail) || `Erreur ${status}`);
    this.status = status;
    this.data = data || {};
  }
}

export async function request(path, { method = "GET", body, form, redirectOnAuth = true } = {}) {
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
    throw new ApiError(0, { detail: "Connexion au serveur impossible. Vérifiez votre réseau." });
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if ((response.status === 401 || response.status === 403) && redirectOnAuth && path.startsWith("/admin/")) {
    window.location.assign(`${prefix}connexion/`);
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, file, extra = {}) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
    return request(path, { method: "POST", form });
  },
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
