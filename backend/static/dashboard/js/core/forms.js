/**
 * Générateur de formulaires à partir d'un schéma déclaratif.
 *
 * Types : text, email, url, date, number, textarea, checkbox, select, multiselect, list, repeater (et l'alias missions).
 * `bi(...)` produit la paire de champs bilingues `<nom>_fr` / `<nom>_en`.
 * La validation définitive est faite par l'API ; les erreurs renvoyées sont affichées sous chaque champ.
 */
import { $, $$, h } from "./dom.js";

let uid = 0;

export function bi(name, label, type = "text", extra = {}) {
  return [
    { name: `${name}_fr`, label, lang: "FR", type, ...extra },
    { name: `${name}_en`, label, lang: "EN", type, ...extra, required: false },
  ];
}

function control(field, value) {
  const id = `f-${field.name}-${++uid}`;
  const common = { id, name: field.name, class: "input", required: field.required || null, "aria-describedby": `${id}-err` };
  switch (field.type) {
    case "textarea":
      return [id, h("textarea", { ...common, maxlength: field.max, rows: field.rows || 5, value: value ?? "" })];
    case "checkbox":
      return [id, h("input", { id, name: field.name, type: "checkbox", checked: Boolean(value) })];
    case "select": {
      const select = h("select", common, field.allowEmpty ? h("option", { value: "", text: field.emptyLabel || "—" }) : null);
      for (const option of field.options || []) {
        select.append(h("option", { value: String(option.value), text: option.label, selected: String(option.value) === String(value ?? "") || null }));
      }
      return [id, select];
    }
    case "multiselect": {
      const selected = new Set((value || []).map(String));
      const select = h("select", { ...common, multiple: true, size: Math.min(8, Math.max(4, (field.options || []).length)) });
      for (const option of field.options || []) {
        select.append(h("option", { value: String(option.value), text: option.label, selected: selected.has(String(option.value)) || null }));
      }
      return [id, select];
    }
    case "list":
      return [id, h("textarea", { ...common, rows: 4, value: (value || []).join("\n") })];
    case "missions":
      return [id, repeaterControl(id, MISSIONS, value || [])];
    case "repeater":
      return [id, repeaterControl(id, field, value || [])];
    default:
      return [id, h("input", { ...common, type: field.type || "text", maxlength: field.max, min: field.min, step: field.step, value: value ?? "", placeholder: field.placeholder })];
  }
}

const MISSIONS = {
  addLabel: "+ Ajouter une mission",
  keys: [
    { key: "description_fr", label: "Mission (FR)", max: 400, required: true },
    { key: "description_en", label: "Mission (EN)", max: 400 },
  ],
};

/** Liste de lignes répétables ; chaque ligne porte les clés décrites par `config.keys`. */
function repeaterControl(id, config, items) {
  const rows = h("div", { class: `repeater${config.keys.some((k) => k.multiline) ? " repeater--stacked" : ""}`, id, dataset: { repeater: "" } });
  const addRow = (item = {}) => {
    const remove = h("button", { class: "btn btn--small btn--ghost", type: "button", text: "Retirer" });
    const inputs = config.keys.map((k) => k.multiline
      ? h("textarea", { class: "input", rows: 2, "aria-label": k.label, placeholder: k.label, maxlength: k.max, value: item[k.key] || "", dataset: { key: k.key } })
      : h("input", { class: "input", "aria-label": k.label, placeholder: k.label, maxlength: k.max, value: item[k.key] || "", dataset: { key: k.key } }));
    const row = h("div", { class: "repeater__row" }, inputs, remove);
    remove.addEventListener("click", () => row.remove());
    rows.insertBefore(row, addButton);
  };
  const addButton = h("button", { class: "btn btn--small", type: "button", text: config.addLabel || "+ Ajouter" });
  addButton.addEventListener("click", () => addRow());
  rows.append(addButton);
  items.forEach(addRow);
  return rows;
}

function readRepeater(config, form, field) {
  const root = $(`[data-field="${CSS.escape(field.name)}"] [data-repeater]`, form);
  if (!root) return undefined;
  const required = config.keys.filter((k) => k.required).map((k) => k.key);
  return $$(":scope > .repeater__row", root)
    .map((row, index) => {
      const item = { display_order: index };
      for (const k of config.keys) item[k.key] = $(`[data-key="${k.key}"]`, row).value.trim();
      return item;
    })
    .filter((item) => required.every((key) => item[key]));
}

function readValue(field, form) {
  if (field.type === "missions") return readRepeater(MISSIONS, form, field);
  if (field.type === "repeater") return readRepeater(field, form, field);
  const el = form.elements.namedItem(field.name);
  if (!el) return undefined;
  switch (field.type) {
    case "checkbox":
      return el.checked;
    case "number":
      return el.value === "" ? null : Number(el.value);
    case "date":
      return el.value || null;
    case "multiselect":
      return [...el.selectedOptions].map((option) => (field.numeric === false ? option.value : Number(option.value)));
    case "select":
      if (el.value === "") return field.allowEmpty ? (field.numeric ? null : "") : null;
      return field.numeric ? Number(el.value) : el.value;
    case "list":
      return el.value.split("\n").map((line) => line.trim()).filter(Boolean);
    case "password":
      return el.value; // jamais modifié (espaces significatifs)
    default:
      return el.value.trim();
  }
}

/**
 * @param {{title?: string, help?: string, fields: object[]}[]} sections
 * @param {object} values
 */
export function buildForm(sections, values = {}, { submitLabel = "Enregistrer", onSubmit, extraActions = [] } = {}) {
  const form = h("form", { class: "form", novalidate: true });
  const fields = [];
  for (const section of sections) {
    const grid = h("div", { class: "form-grid" });
    for (const field of section.fields.flat()) {
      fields.push(field);
      const [id, input] = control(field, values[field.name]);
      // Les paires FR / EN de textes longs restent côte à côte sur grand écran, pour faciliter la traduction.
      const wide = field.wide || (["textarea", "list", "missions", "repeater", "multiselect"].includes(field.type) && !(field.type === "textarea" && field.lang));
      const label =
        field.type === "checkbox"
          ? h("label", { class: "check" }, input, h("span", { text: field.label }))
          : h("label", { for: id }, field.label, field.required ? " *" : "", field.lang ? h("span", { class: "field__lang", text: field.lang }) : null);
      grid.append(
        h(
          "div",
          { class: `field${wide ? " field--wide" : ""}`, dataset: { field: field.name } },
          label,
          field.type === "checkbox" ? null : input,
          field.help ? h("p", { class: "field__help", text: field.help }) : null,
          h("p", { class: "field__error", id: `${id}-err`, dataset: { errorFor: field.name } })
        )
      );
    }
    form.append(h("section", { class: "form-section" }, section.title ? h("h2", { text: section.title }) : null, section.help ? h("p", { class: "muted", text: section.help }) : null, grid));
  }

  const submit = h("button", { class: "btn btn--primary", type: "submit", text: submitLabel });
  form.append(h("div", { class: "form-actions" }, extraActions, submit));

  const api = {
    element: form,
    data() {
      const data = {};
      for (const field of fields) {
        if (field.readonly) continue;
        const value = readValue(field, form);
        if (value !== undefined) data[field.name] = value;
      }
      return data;
    },
    setErrors(errors = {}) {
      $$("[data-error-for]", form).forEach((el) => { el.textContent = ""; });
      $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
      let first = null;
      for (const [name, messages] of Object.entries(errors)) {
        const target = $(`[data-error-for="${CSS.escape(name)}"]`, form);
        if (!target) continue;
        target.textContent = [].concat(messages).map((m) => (typeof m === "object" ? JSON.stringify(m) : m)).join(" ");
        const input = form.elements.namedItem(name);
        if (input && input.setAttribute) input.setAttribute("aria-invalid", "true");
        first ??= input;
      }
      first?.focus?.();
    },
    busy(state) {
      submit.disabled = state;
      submit.textContent = state ? "Enregistrement…" : submitLabel;
    },
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    api.setErrors({});
    api.busy(true);
    try {
      await onSubmit(api.data(), api);
    } finally {
      api.busy(false);
    }
  });
  return api;
}

/** Contrôle de téléversement : aperçu, envoi, suppression. */
export function uploadControl({ label, accept, current, preview = "image", portrait = false, onUpload, onDelete, help }) {
  const id = `u-${++uid}`;
  const input = h("input", { id, type: "file", accept, class: "visually-hidden" });
  const status = h("p", { class: "field__help", text: help || "" });
  const img = preview === "image" ? h("img", { class: `upload__preview${portrait ? " upload__preview--portrait" : ""}`, alt: "", hidden: !current?.src || null, src: current?.src || null }) : null;
  const link = preview === "pdf" ? h("a", { href: current?.url || "#", target: "_blank", rel: "noopener", text: "Ouvrir le fichier actuel ↗", hidden: !current?.url || null }) : null;
  const choose = h("label", { class: "btn btn--small", for: id, text: current ? "Remplacer…" : "Choisir un fichier…" });
  const remove = onDelete ? h("button", { class: "btn btn--small btn--danger", type: "button", text: "Supprimer", hidden: !current || null }) : null;

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    status.textContent = "Envoi en cours…";
    try {
      const asset = await onUpload(file);
      status.textContent = "Fichier enregistré.";
      if (img && asset?.src) { img.src = asset.src; img.hidden = false; }
      if (link && asset?.url) { link.href = asset.url; link.hidden = false; }
      choose.textContent = "Remplacer…";
      if (remove) remove.hidden = false;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      input.value = "";
    }
  });
  remove?.addEventListener("click", async () => {
    if (!window.confirm("Supprimer ce fichier ?")) return;
    await onDelete();
    if (img) img.hidden = true;
    if (link) link.hidden = true;
    remove.hidden = true;
    choose.textContent = "Choisir un fichier…";
    status.textContent = "Fichier supprimé.";
  });
  return h("div", { class: "field upload" }, h("span", { class: "field__label", text: label }), img, link, h("div", { class: "upload__row" }, input, choose, remove), status);
}
