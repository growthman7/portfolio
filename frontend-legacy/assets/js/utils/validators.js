/** Validation côté navigateur : confort de saisie uniquement, le serveur revalide tout. */
import { t } from "../core/i18n.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateField(field) {
  if (field.type === "checkbox") return field.required && !field.checked ? t.form.consent : "";
  const value = field.value.trim();
  if (field.required && !value) return t.form.required;
  if (field.type === "email" && value && !EMAIL.test(value)) return t.form.email;
  const min = Number(field.getAttribute("minlength"));
  const max = Number(field.getAttribute("maxlength"));
  if (min && value.length < min) return t.form.min(min);
  if (max && value.length > max) return t.form.max(max);
  return "";
}
