/**
 * Contact : coordonnées (e-mail copiable, GitHub, LinkedIn, autres réseaux) et formulaire
 * validé dans le navigateur puis par le serveur, protégé par un champ piège, un jeton
 * horodaté et la limitation de débit côté API.
 */
import { $, $$, h, icon, safeUrl } from "../core/dom.js";
import { api, ApiError, isPreview } from "../core/api.js";
import { lang, t } from "../core/i18n.js";
import { validateField } from "../utils/validators.js";

const ORDER = ["github", "linkedin"];

function copyButton(text) {
  const label = h("span", { text: t.form.copy });
  const button = h("button", { class: "channel__action", type: "button", "aria-label": `${t.form.copy} ${text}` }, icon("copy"), label);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = t.form.copied;
    } catch {
      // Copie refusée : on sélectionne l'adresse pour une copie manuelle.
      const range = document.createRange();
      range.selectNodeContents(button.previousElementSibling);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      label.textContent = t.form.selected;
    }
    setTimeout(() => { label.textContent = t.form.copy; }, 2200);
  });
  return button;
}

export function renderChannels(profile) {
  const list = $("[data-channels]");
  const rows = [];
  if (profile.email) {
    rows.push(h("div", { class: "channel" },
      h("span", { class: "channel__key", text: "email" }),
      h("a", { class: "channel__value", href: `mailto:${profile.email}`, text: profile.email }),
      copyButton(profile.email)));
  }
  const links = [...(profile.social_links || [])].sort((a, b) => {
    const ia = ORDER.indexOf(a.platform); const ib = ORDER.indexOf(b.platform);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
  for (const link of links) {
    const url = safeUrl(link.url);
    if (!url) continue;
    const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    rows.push(h("div", { class: "channel" },
      h("span", { class: "channel__key", text: link.platform }),
      h("a", { class: "channel__value", href: url, target: "_blank", rel: "noopener noreferrer", text: display }),
      h("a", { class: "channel__action", href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": `${link.label} (${t.openNewTab})` }, t.form.open, icon("arrow"))));
  }
  list.replaceChildren(...rows);
  list.hidden = rows.length === 0;
}

export function initContactForm() {
  const form = $("[data-contact-form]");
  const panel = $("[data-contact-panel]");
  if (!form) return;
  const status = $("[data-form-status]", form);
  const submit = $("[data-submit]", form);
  const fields = $$("input:not([name=website]), textarea", form);
  const counter = $("[data-count]", form);
  let token = api.contactToken().catch(() => null);

  const setError = (field, message) => {
    $(`[data-error-for="${field.name}"]`, form).textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  };
  const showError = (message) => {
    status.textContent = message;
    status.hidden = false;
  };

  fields.forEach((field) => {
    field.addEventListener("blur", () => { if (field.value || field.type === "checkbox") setError(field, validateField(field)); });
    field.addEventListener("input", () => { if (field.getAttribute("aria-invalid") === "true") setError(field, validateField(field)); });
  });
  form.message.addEventListener("input", () => { counter.textContent = `${form.message.value.length} / 5000`; });
  if (isPreview) $("[data-preview-note]", form).hidden = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.hidden = true;
    let first = null;
    for (const field of fields) {
      const message = validateField(field);
      setError(field, message);
      if (message && !first) first = field;
    }
    if (first) {
      showError(t.form.invalid);
      first.focus();
      return;
    }

    submit.classList.add("is-loading");
    submit.setAttribute("aria-busy", "true");
    try {
      const signed = await token;
      await api.sendContact({
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim(),
        language: lang,
        consent: form.consent.checked,
        website: form.website.value,
        form_token: signed?.form_token || "",
      });
      showSuccess(form.name.value.trim().split(/\s+/)[0]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        for (const field of fields) if (error.data[field.name]) setError(field, [].concat(error.data[field.name])[0]);
        showError(t.form.invalid);
      } else if (error instanceof ApiError && error.status === 429) showError(t.form.throttled);
      else if (error instanceof ApiError && error.status === 0) showError(t.form.network);
      else showError(t.form.server);
    } finally {
      submit.classList.remove("is-loading");
      submit.removeAttribute("aria-busy");
      token = api.contactToken().catch(() => null);
    }
  });

  function showSuccess(firstName) {
    const again = h("button", { class: "btn", type: "button", text: t.form.again });
    const box = h("div", { class: "form-success", role: "status", tabindex: "-1" },
      h("p", { class: "form-success__prompt" }, h("span", { text: "$ " }), t.form.command, h("span", { text: " ✓" })),
      h("h3", { class: "form-success__title", text: t.form.successTitle(firstName) }),
      h("p", { class: "form-success__text", text: isPreview ? t.form.successPreview : t.form.successText }),
      again);
    again.addEventListener("click", () => {
      form.reset();
      counter.textContent = "0 / 5000";
      fields.forEach((f) => f.setAttribute("aria-invalid", "false"));
      box.remove();
      form.hidden = false;
      form.name.focus();
    });
    form.hidden = true;
    panel.append(box);
    box.focus();
  }
}
