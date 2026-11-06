import { api, ApiError } from "../core/api.js";
import { crud } from "../core/crud.js";
import { h } from "../core/dom.js";
import { bi, buildForm, uploadControl } from "../core/forms.js";
import { errorMessage, loading, pageHead, toast } from "../core/ui.js";

const PLATFORMS = [["github", "GitHub"], ["gitlab", "GitLab"], ["linkedin", "LinkedIn"], ["x", "X"], ["mastodon", "Mastodon"], ["stackoverflow", "Stack Overflow"], ["devto", "DEV"], ["medium", "Medium"], ["website", "Site web"]].map(([value, label]) => ({ value, label }));

const schema = [
  {
    title: "Identité",
    fields: [
      { name: "first_name", label: "Prénom", required: true, max: 80 },
      { name: "last_name", label: "Nom", required: true, max: 80 },
      bi("job_title", "Titre professionnel", "text", { required: true, max: 120 }),
      bi("tagline", "Accroche", "text", { max: 200 }),
      { name: "location", label: "Localisation", max: 120 },
      { name: "email_public", label: "E-mail affiché publiquement", type: "email", help: "Laissez vide pour ne pas afficher d'adresse." },
      { name: "phone_public", label: "Téléphone affiché publiquement", max: 30, help: "Format international, ex. +225 01 52 16 17 69. Laissez vide pour ne pas l'afficher." },
      { name: "is_available", label: "Disponible pour de nouvelles opportunités", type: "checkbox" },
      bi("cv_alt_label", "Intitulé du second CV (ex. CV Data Analyst)", "text", { max: 80 }),
    ],
  },
  {
    title: "Présentation",
    fields: [
      bi("short_bio", "Courte présentation (hero)", "textarea", { max: 600, rows: 3 }),
      bi("expertise", "Domaines d'expertise", "list", { help: "Un domaine par ligne (12 maximum)." }),
      bi("about", "À propos", "textarea", { max: 4000, rows: 6 }),
      bi("interests", "Centres d'intérêt techniques", "textarea", { max: 2000 }),
      bi("vision", "Vision du développement logiciel", "textarea", { max: 2000 }),
      bi("approach", "Approche des problèmes", "textarea", { max: 2000 }),
      bi("ambitions", "Ambitions professionnelles", "textarea", { max: 2000 }),
      bi("signature", "Signature (pied de page)", "text", { max: 160 }),
    ],
  },
  {
    title: "Référencement",
    help: "Titre et description utilisés par les moteurs de recherche et les réseaux sociaux. Mis à jour automatiquement à l'enregistrement.",
    fields: [bi("seo_title", "Titre SEO", "text", { max: 70 }), bi("seo_description", "Description SEO", "textarea", { max: 170, rows: 2 }), bi("photo_alt", "Texte alternatif de la photo", "text", { max: 200 })],
  },
];

function files(profile) {
  const fail = (error) => { throw new Error(errorMessage(error)); };
  const image = (field, path, label, extra = {}) =>
    uploadControl({
      label,
      accept: "image/jpeg,image/png,image/webp",
      current: profile[field],
      help: "JPEG, PNG ou WebP, 5 Mo maximum.",
      onUpload: (file) => api.upload(`/admin/profile/${path}/`, file).then((p) => { toast("Image enregistrée."); return p[field]; }, fail),
      onDelete: () => api.delete(`/admin/profile/${path}/`).then(() => toast("Image supprimée.")),
      ...extra,
    });
  const cv = (lang) =>
    uploadControl({
      label: `CV (${lang.toUpperCase()}) — PDF`,
      accept: "application/pdf",
      preview: "pdf",
      current: profile[`cv_${lang}`],
      help: "PDF de 10 Mo maximum, sans script ni pièce jointe.",
      onUpload: (file) => api.upload(`/admin/profile/cv/${lang}/`, file).then((p) => { toast("CV enregistré."); return p[`cv_${lang}`]; }, fail),
      onDelete: () => api.delete(`/admin/profile/cv/${lang}/`).then(() => toast("CV supprimé.")),
    });
  const cvAlt = () =>
    uploadControl({
      label: "Second CV (facultatif) — PDF",
      accept: "application/pdf",
      preview: "pdf",
      current: profile.cv_alt,
      help: "Proposé en plus du CV principal, avec l'intitulé saisi plus haut.",
      onUpload: (file) => api.upload("/admin/profile/cv-alt/", file).then((p) => { toast("Second CV enregistré."); return p.cv_alt; }, fail),
      onDelete: () => api.delete("/admin/profile/cv-alt/").then(() => toast("Second CV supprimé.")),
    });
  return h(
    "section",
    { class: "form-section" },
    h("h2", { text: "Photo, CV et image de partage" }),
    h("div", { class: "form-grid" }, image("photo", "photo", "Photo professionnelle", { portrait: true }), image("og_image", "og-image", "Image de partage (Open Graph, 1200×630)"), cv("fr"), cv("en"), cvAlt())
  );
}

const links = crud({
  title: "Réseaux professionnels",
  singular: "Réseau",
  addLabel: "Ajouter un réseau",
  endpoint: "/admin/social-links/",
  route: "#/profile/links",
  labelOf: (l) => l.label || PLATFORMS.find((p) => p.value === l.platform)?.label || l.platform,
  defaults: { platform: "github", is_published: true, display_order: 0 },
  schema: () => [
    {
      fields: [
        { name: "platform", label: "Plateforme", type: "select", options: PLATFORMS, required: true },
        { name: "url", label: "Adresse (https)", type: "url", required: true, max: 300 },
        { name: "label", label: "Libellé affiché (facultatif)", max: 60 },
        { name: "display_order", label: "Ordre", type: "number", min: 0 },
        { name: "is_published", label: "Affiché", type: "checkbox" },
      ],
    },
  ],
  columns: [
    { label: "Plateforme", render: (l) => PLATFORMS.find((p) => p.value === l.platform)?.label || l.platform },
    { label: "Adresse", render: (l) => h("span", { class: "mono", text: l.url }) },
    { label: "Statut", render: (l) => h("span", { class: `badge${l.is_published ? " badge--on" : ""}`, text: l.is_published ? "Affiché" : "Masqué" }) },
  ],
});

async function profileForm(view) {
  view.replaceChildren(loading());
  let profile;
  try {
    profile = await api.get("/admin/profile/");
  } catch (error) {
    view.replaceChildren(h("p", { class: "alert alert--error", text: errorMessage(error) }));
    return;
  }
  const form = buildForm(schema, profile, {
    onSubmit: async (data, formApi) => {
      try {
        await api.patch("/admin/profile/", data);
        toast("Informations enregistrées.");
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) formApi.setErrors(error.data);
        toast(errorMessage(error), "error");
      }
    },
  });
  view.replaceChildren(
    pageHead("Informations générales", "Contenu affiché dans le hero, la section À propos et le pied de page.", h("a", { class: "btn", href: "#/profile/links", text: "Réseaux professionnels" })),
    files(profile),
    form.element
  );
}

export function profilePage(view, section, id) {
  if (section === "links") return id ? links.edit(view, id) : links.list(view, { subtitle: "Liens affichés dans le hero, la section Contact et le pied de page." });
  return profileForm(view);
}
