import { api, getAll } from "../core/api.js";
import { crud } from "../core/crud.js";
import { fmtDate, h } from "../core/dom.js";
import { bi, buildForm, uploadControl } from "../core/forms.js";
import { confirmAction, errorMessage, imageOf, toast } from "../core/ui.js";

async function loadOptions() {
  const [categories, technologies] = await Promise.all([getAll("/admin/categories/"), getAll("/admin/technologies/")]);
  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name_fr })),
    technologies: technologies.map((t) => ({ value: t.id, label: t.name })),
  };
}

const schema = (options) => [
  {
    title: "Présentation",
    fields: [
      bi("title", "Titre", "text", { required: true, max: 120 }),
      { name: "slug", label: "Identifiant d'URL", help: "Généré automatiquement si vide (lettres, chiffres, tirets).", max: 120 },
      { name: "category", label: "Catégorie", type: "select", options: options.categories, numeric: true, required: true },
      bi("summary", "Résumé (carte)", "textarea", { required: true, max: 280, rows: 3 }),
    ],
  },
  {
    title: "Étude de cas",
    help: "Les chapitres de la page projet, dans l'ordre d'affichage. Un chapitre vide n'est pas affiché. Listes : une entrée par ligne.",
    fields: [
      bi("context", "01 · Contexte", "textarea", { max: 4000, rows: 4 }),
      bi("problem", "02 · Problématique", "textarea", { max: 3000, rows: 4 }),
      bi("objectives", "03 · Objectifs (un par ligne)", "textarea", { max: 3000, rows: 4 }),
      bi("features", "04 · Fonctionnalités (une par ligne)", "textarea", { max: 4000, rows: 5 }),
      bi("architecture", "05 · Architecture", "textarea", { max: 4000, rows: 5 }),
      bi("architecture_alt", "05 · Texte alternatif du schéma", "text", { max: 200 }),
      {
        name: "challenges", label: "08 · Difficultés et solutions", type: "repeater", addLabel: "+ Ajouter une difficulté",
        help: "Une ligne par paire. Les technologies (06) et les captures (07) se gèrent plus bas ; les liens (10) viennent des champs démo et dépôt.",
        keys: [
          { key: "challenge_fr", label: "Difficulté (FR)", max: 500, required: true, multiline: true },
          { key: "solution_fr", label: "Solution (FR)", max: 800, required: true, multiline: true },
          { key: "challenge_en", label: "Difficulty (EN)", max: 500, multiline: true },
          { key: "solution_en", label: "Solution (EN)", max: 800, multiline: true },
        ],
      },
      bi("results", "09 · Résultats", "textarea", { max: 3000, rows: 4 }),
    ],
  },
  {
    title: "Technique & liens",
    fields: [
      { name: "technologies", label: "Technologies", type: "multiselect", options: options.technologies, help: "Ctrl/Cmd + clic pour une sélection multiple." },
      { name: "demo_url", label: "Démonstration en ligne", type: "url", placeholder: "https://…", max: 300 },
      { name: "repo_url", label: "Dépôt GitHub", type: "url", placeholder: "https://github.com/…", max: 300 },
      { name: "started_on", label: "Début", type: "date" },
      { name: "ended_on", label: "Fin", type: "date" },
      bi("cover_alt", "Texte alternatif de l'image de couverture", "text", { max: 200 }),
    ],
  },
  {
    title: "Publication",
    fields: [
      { name: "is_published", label: "Publié sur le site", type: "checkbox" },
      { name: "is_featured", label: "Mis en avant", type: "checkbox" },
      { name: "is_sample", label: "Projet d'exemple (affiché avec la mention « Exemple »)", type: "checkbox" },
      { name: "display_order", label: "Ordre d'affichage", type: "number", min: 0 },
    ],
  },
];

function uploadError(error) {
  throw new Error(errorMessage(error));
}

function media(project, view) {
  const base = `/admin/projects/${project.id}/`;
  const cover = uploadControl({
    label: "Image de prévisualisation",
    accept: "image/jpeg,image/png,image/webp",
    current: project.cover,
    help: "JPEG, PNG ou WebP, 5 Mo maximum. L'image est ré-encodée (WebP/AVIF) et ses métadonnées supprimées.",
    onUpload: (file) => api.upload(`${base}cover/`, file).then((p) => { toast("Image enregistrée."); return p.cover; }, uploadError),
    onDelete: () => api.delete(`${base}cover/`).then(() => toast("Image supprimée.")),
  });

  const architecture = uploadControl({
    label: "Schéma d'architecture (chapitre 05)",
    accept: "image/jpeg,image/png,image/webp",
    current: project.architecture_image,
    help: "Facultatif. Mêmes règles que l'image de couverture.",
    onUpload: (file) => api.upload(`${base}architecture-image/`, file).then((p) => { toast("Schéma enregistré."); return p.architecture_image; }, uploadError),
    onDelete: () => api.delete(`${base}architecture-image/`).then(() => toast("Schéma supprimé.")),
  });

  const gallery = h("div", { class: "gallery-admin" });
  const drawGallery = (images) => {
    gallery.replaceChildren(
      ...images.map((image) => {
        const form = buildForm([{ fields: [bi("alt", "Texte alternatif", "text", { max: 200 }), bi("caption", "Légende", "text", { max: 200 })] }], image, {
          submitLabel: "OK",
          onSubmit: async (data) => {
            try {
              await api.patch(`${base}images/${image.id}/`, data);
              toast("Image mise à jour.");
            } catch (error) {
              toast(errorMessage(error), "error");
            }
          },
        });
        const remove = h("button", { class: "btn btn--small btn--danger", type: "button", text: "Supprimer" });
        remove.addEventListener("click", async () => {
          if (!confirmAction("Supprimer cette image ?")) return;
          await api.delete(`${base}images/${image.id}/`);
          images.splice(images.indexOf(image), 1);
          drawGallery(images);
        });
        return h("div", { class: "gallery-admin__item" }, imageOf(image.image, "", image.alt_fr || ""), form.element, remove);
      })
    );
  };
  drawGallery([...(project.images || [])]);
  const add = uploadControl({
    label: "Ajouter une capture à la galerie",
    accept: "image/jpeg,image/png,image/webp",
    help: "12 images maximum par projet.",
    onUpload: (file) =>
      api.upload(`${base}images/`, file).then((image) => {
        project.images = [...(project.images || []), image];
        drawGallery(project.images);
        return null;
      }, uploadError),
  });

  view.append(h("section", { class: "form-section" }, h("h2", { text: "Visuels" }), cover, architecture, h("h3", { class: "card__title", text: "Captures (chapitre 07)" }), gallery, add));
}

const resource = crud({
  title: "Projets",
  subtitle: "Ajoutez, modifiez et publiez vos réalisations.",
  singular: "Projet",
  addLabel: "Nouveau projet",
  endpoint: "/admin/projects/",
  route: "#/projects",
  emptyText: "Aucun projet. Créez votre premier projet.",
  labelOf: (p) => p.title_fr,
  defaults: { is_published: false, display_order: 0 },
  loadOptions,
  schema,
  afterForm: media,
  columns: [
    { label: "Aperçu", render: (p) => imageOf(p.cover, "thumb", "") },
    { label: "Titre", render: (p) => h("span", {}, p.title_fr, p.is_sample ? [" ", h("span", { class: "badge badge--sample", text: "Exemple" })] : null) },
    { label: "Statut", render: (p) => h("span", { class: `badge${p.is_published ? " badge--on" : ""}`, text: p.is_published ? "Publié" : "Brouillon" }) },
    { label: "Ordre", render: (p) => String(p.display_order) },
    { label: "Modifié", render: (p) => fmtDate(p.updated_at) },
  ],
});

export function projects(view, id) {
  if (id) return resource.edit(view, id);
  const statusFilter = new URLSearchParams(window.location.hash.split("?")[1] || "").get("status") || "";
  const tabs = h(
    "div",
    { class: "tabs", role: "tablist" },
    [["", "Tous"], ["published", "Publiés"], ["draft", "Brouillons"]].map(([value, label]) =>
      h("a", { class: "tab", role: "tab", href: `#/projects${value ? `?status=${value}` : ""}`, "aria-selected": String(value === statusFilter), text: label })
    )
  );
  return resource.list(view, { query: statusFilter ? `?status=${statusFilter}` : "", toolbar: tabs });
}
