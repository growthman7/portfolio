/**
 * Formulaires générés à partir d'un schéma déclaratif (sections → champs).
 *
 * Types : text, email, url, date, number, password, textarea, checkbox, select, multiselect,
 * list (une entrée par ligne), repeater (lignes répétables) et missions (repeater prédéfini).
 * `bi(...)` produit la paire de champs bilingues `<nom>_fr` / `<nom>_en`.
 * La validation définitive est faite par l'API ; ses erreurs sont affichées sous chaque champ.
 */
import { useId, useRef, useState } from "react";
import { errorMessage } from "./api.js";
import { useToast } from "./ui.jsx";

export function bi(name, label, type = "text", extra = {}) {
  return [
    { name: `${name}_fr`, label, lang: "FR", type, ...extra },
    { name: `${name}_en`, label, lang: "EN", type, ...extra, required: false },
  ];
}

const MISSIONS = {
  addLabel: "+ Ajouter une mission",
  keys: [
    { key: "description_fr", label: "Mission (FR)", max: 400, required: true },
    { key: "description_en", label: "Mission (EN)", max: 400 },
  ],
};

const repeaterOf = (field) => (field.type === "missions" ? MISSIONS : field);
const isRepeater = (field) => field.type === "repeater" || field.type === "missions";
let rowKey = 0;

/** Valeur de l'API → valeur d'édition. */
function toDraft(field, value) {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "multiselect" || field.type === "tags") return (value || []).map(String);
  if (field.type === "list") return (value || []).join("\n");
  if (isRepeater(field)) return (value || []).map((item) => ({ ...item, _key: ++rowKey }));
  // Liste obligatoire sans valeur : première option présélectionnée, comme un <select> natif.
  if (field.type === "select" && (value ?? "") === "" && !field.allowEmpty && field.options?.length) return String(field.options[0].value);
  return value ?? "";
}

/** Valeur d'édition → valeur envoyée à l'API. */
function fromDraft(field, value) {
  switch (field.type) {
    case "checkbox":
      return Boolean(value);
    case "number":
      return value === "" ? null : Number(value);
    case "date":
      return value || null;
    case "multiselect":
      return value.map((v) => (field.numeric === false ? v : Number(v)));
    case "tags":
      return value.map(Number);
    case "select":
      if (value === "") return field.allowEmpty ? (field.numeric ? null : "") : null;
      return field.numeric ? Number(value) : value;
    case "list":
      return value.split("\n").map((line) => line.trim()).filter(Boolean);
    case "password":
      return value; // espaces significatifs
    case "repeater":
    case "missions": {
      const config = repeaterOf(field);
      const required = config.keys.filter((k) => k.required).map((k) => k.key);
      return value
        .map((row) => Object.fromEntries(config.keys.map((k) => [k.key, String(row[k.key] ?? "").trim()])))
        .filter((row) => required.every((key) => row[key]))
        .map((row, index) => ({ ...row, display_order: index }));
    }
    default:
      return String(value).trim();
  }
}

function Repeater({ id, field, value, onChange }) {
  const config = repeaterOf(field);
  const stacked = config.keys.some((k) => k.multiline);
  const update = (index, key, text) => onChange(value.map((row, i) => (i === index ? { ...row, [key]: text } : row)));
  return (
    <div className={`repeater${stacked ? " repeater--stacked" : ""}`} id={id}>
      {value.map((row, index) => (
        <div className="repeater__row" key={row._key}>
          {config.keys.map((k) => {
            const props = {
              className: "input", "aria-label": k.label, placeholder: k.label, maxLength: k.max,
              value: row[k.key] ?? "", onChange: (e) => update(index, k.key, e.target.value),
            };
            return k.multiline ? <textarea key={k.key} rows={2} {...props} /> : <input key={k.key} {...props} />;
          })}
          <button className="btn btn--small btn--ghost" type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>Retirer</button>
        </div>
      ))}
      <button className="btn btn--small" type="button" onClick={() => onChange([...value, { _key: ++rowKey }])}>{config.addLabel || "+ Ajouter"}</button>
    </div>
  );
}

/**
 * Sélection de plusieurs éléments : liste déroulante pour en ajouter, pastilles avec × pour en retirer.
 * field.options : [{ value, label, group? }] ; les options d'un même `group` sont regroupées (<optgroup>).
 */
function TagPicker({ id, field, value, onChange, errorId }) {
  const options = field.options || [];
  const selected = new Set(value);
  const labelOf = (v) => options.find((o) => String(o.value) === v)?.label || `#${v}`;
  const available = options.filter((o) => !selected.has(String(o.value)));
  const groups = [];
  for (const option of available) {
    const name = option.group || "";
    let group = groups.find((g) => g.name === name);
    if (!group) groups.push((group = { name, options: [] }));
    group.options.push(option);
  }
  const add = (v) => { if (v && !selected.has(v)) onChange([...value, v]); };
  const remove = (v) => onChange(value.filter((x) => x !== v));

  return (
    <div className="tags">
      <select id={id} className="input" value="" aria-describedby={errorId} disabled={!available.length}
        onChange={(e) => add(e.target.value)}>
        <option value="">{available.length ? field.addLabel || "Ajouter…" : field.noMoreText || "Tout est déjà sélectionné"}</option>
        {groups.map((g) => (g.name ? (
          <optgroup key={g.name} label={g.name}>
            {g.options.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
          </optgroup>
        ) : g.options.map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)))}
      </select>
      <div className="tags__selected" aria-live="polite">
        {value.length ? value.map((v) => (
          <span key={v} className="tag">
            {labelOf(v)}
            <button type="button" className="tag__remove" onClick={() => remove(v)} aria-label={`Retirer ${labelOf(v)}`} title="Retirer">×</button>
          </span>
        )) : <span className="field__help">{field.emptyText || "Aucun élément sélectionné."}</span>}
      </div>
    </div>
  );
}

function Control({ id, field, value, onChange, invalid, errorId }) {
  const common = {
    id, name: field.name, className: "input", required: field.required || undefined,
    "aria-invalid": invalid || undefined, "aria-describedby": errorId,
  };
  switch (field.type) {
    case "textarea":
      return <textarea {...common} maxLength={field.max} rows={field.rows || 5} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "list":
      return <textarea {...common} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return <input id={id} name={field.name} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />;
    case "select":
      return (
        <select {...common} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.allowEmpty || value === "" ? <option value="">{field.emptyLabel || "—"}</option> : null}
          {(field.options || []).map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
    case "multiselect":
      return (
        <select {...common} multiple size={Math.min(8, Math.max(4, (field.options || []).length))} value={value}
          onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}>
          {(field.options || []).map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
    case "repeater":
    case "missions":
      return <Repeater id={id} field={field} value={value} onChange={onChange} />;
    case "tags":
      return <TagPicker id={id} field={field} value={value} onChange={onChange} errorId={errorId} />;
    default:
      return (
        <input {...common} type={field.type || "text"} maxLength={field.max} min={field.min} max={field.type === "number" ? field.maxValue : undefined}
          step={field.step} placeholder={field.placeholder} autoComplete={field.autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

const WIDE_TYPES = ["textarea", "list", "missions", "repeater", "multiselect", "tags"];

/**
 * @param sections   [{ title?, help?, fields: [...] }]
 * @param initial    valeurs de l'API
 * @param onSubmit   async (data, { setErrors, reset }) ; une ApiError 400 renseigne les erreurs des champs
 */
export function SchemaForm({ sections, initial = {}, submitLabel = "Enregistrer", onSubmit, extraActions = null, successMessage }) {
  const toast = useToast();
  const baseId = useId();
  const fields = sections.flatMap((s) => s.fields.flat());
  const initialDraft = () => Object.fromEntries(fields.map((f) => [f.name, toDraft(f, initial[f.name])]));
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  const submit = async (event) => {
    event.preventDefault();
    setErrors({});
    setBusy(true);
    const data = {};
    for (const field of fields) if (!field.readonly) data[field.name] = fromDraft(field, draft[field.name]);
    try {
      await onSubmit(data, { reset: () => setDraft(initialDraft()) });
      if (successMessage) toast(successMessage);
    } catch (error) {
      if (error?.status === 400 && error.data) {
        setErrors(error.data);
        requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid=true]")?.focus());
      }
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" noValidate onSubmit={submit} ref={formRef}>
      {sections.map((section, index) => (
        <section className="form-section" key={section.title || index}>
          {section.title ? <h2>{section.title}</h2> : null}
          {section.help ? <p className="muted">{section.help}</p> : null}
          <div className="form-grid">
            {section.fields.flat().map((field) => {
              const id = `${baseId}-${field.name}`;
              const errorId = `${id}-err`;
              const error = errors[field.name];
              const wide = field.wide || (WIDE_TYPES.includes(field.type) && !(field.type === "textarea" && field.lang));
              const control = (
                <Control id={id} field={field} value={draft[field.name]} invalid={Boolean(error)} errorId={errorId}
                  onChange={(value) => setDraft((d) => ({ ...d, [field.name]: value }))} />
              );
              return (
                <div key={field.name} className={`field${wide ? " field--wide" : ""}`}>
                  {field.type === "checkbox" ? (
                    <label className="check">{control}<span>{field.label}</span></label>
                  ) : (
                    <>
                      <label htmlFor={id}>
                        {field.label}{field.required ? " *" : ""}
                        {field.lang ? <span className="field__lang">{field.lang}</span> : null}
                      </label>
                      {control}
                    </>
                  )}
                  {field.help ? <p className="field__help">{field.help}</p> : null}
                  <p className="field__error" id={errorId}>
                    {error ? [].concat(error).map((m) => (typeof m === "object" ? JSON.stringify(m) : m)).join(" ") : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="form-actions">
        {extraActions}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : submitLabel}</button>
      </div>
    </form>
  );
}

/** Téléversement d'un fichier : aperçu, envoi, remplacement, suppression. */
export function UploadControl({ label, accept, current, preview = "image", portrait = false, onUpload, onDelete, help }) {
  const id = useId();
  const [asset, setAsset] = useState(current || null);
  const [status, setStatus] = useState(help || "");

  const change = async (event) => {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    setStatus("Envoi en cours…");
    try {
      const saved = await onUpload(file);
      setStatus("Fichier enregistré.");
      if (saved) setAsset(saved);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      input.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer ce fichier ?")) return;
    try {
      await onDelete();
      setAsset(null);
      setStatus("Fichier supprimé.");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  return (
    <div className="field upload">
      <span className="field__label">{label}</span>
      {preview === "image" && asset?.src ? <img className={`upload__preview${portrait ? " upload__preview--portrait" : ""}`} src={asset.src} alt="" /> : null}
      {preview === "pdf" && asset?.url ? <a href={asset.url} target="_blank" rel="noopener noreferrer">Ouvrir le fichier actuel ↗</a> : null}
      <div className="upload__row">
        <input id={id} type="file" accept={accept} className="visually-hidden" onChange={change} />
        <label className="btn btn--small" htmlFor={id}>{asset ? "Remplacer…" : "Choisir un fichier…"}</label>
        {onDelete && asset ? <button className="btn btn--small btn--danger" type="button" onClick={remove}>Supprimer</button> : null}
      </div>
      <p className="field__help" role="status">{status}</p>
    </div>
  );
}
