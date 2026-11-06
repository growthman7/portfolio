/** N'accepte que des liens http(s) : bloque javascript:, data:, etc. (contenu saisi dans l'administration). */
export function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Liens d'appel et WhatsApp construits à partir des seuls chiffres du numéro
 * (aucun autre caractère venant de la base n'entre dans l'adresse).
 */
export function phoneLinks(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return null;
  const international = (phone || "").trim().startsWith("+");
  return { tel: `tel:${international ? "+" : ""}${digits}`, whatsapp: `https://wa.me/${digits}` };
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function slugify(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Un texte saisi dans l'administration : un paragraphe (ou un élément de liste) par ligne. */
export function lines(text) {
  return (text || "").split(/\n+/).map((part) => part.trim()).filter(Boolean);
}

export const pad2 = (n) => String(n).padStart(2, "0");
