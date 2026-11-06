import { $, h } from "./dom.js";

export function toast(message, type = "success") {
  const el = h("p", { class: `toast toast--${type}`, role: type === "error" ? "alert" : "status", text: message });
  $("[data-toasts]").append(el);
  setTimeout(() => el.remove(), type === "error" ? 7000 : 3500);
}

export function errorMessage(error) {
  if (!error) return "Erreur inconnue.";
  if (error.status === 429) return "Trop de requêtes : patientez un instant avant de réessayer.";
  if (error.status === 413) return "Fichier trop volumineux.";
  if (error.data && typeof error.data === "object") {
    const parts = [];
    for (const [key, value] of Object.entries(error.data)) {
      const text = [].concat(value).join(" ");
      parts.push(key === "detail" || key === "non_field_errors" ? text : `${key} : ${text}`);
    }
    if (parts.length) return parts.join(" — ");
  }
  return error.message || "Erreur inconnue.";
}

export function confirmAction(message) {
  return window.confirm(message);
}

export function pageHead(title, subtitle, ...actions) {
  return h("header", { class: "page-head" }, h("div", {}, h("h1", { text: title }), subtitle ? h("p", { text: subtitle }) : null), h("div", { class: "page-actions" }, actions));
}

export function loading() {
  return h("p", { class: "loading", text: "Chargement…" });
}

export function imageOf(asset, className = "thumb", alt = "") {
  return asset?.src ? h("img", { class: className, src: asset.src, alt, loading: "lazy" }) : h("div", { class: className, "aria-hidden": "true" });
}
