import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { api, errorMessage, getAll } from "../api.js";
import { CrudEdit, CrudList } from "../crud.jsx";
import { SchemaForm, UploadControl, bi } from "../forms.jsx";
import { Badge, Tabs, Thumb, fmtDate, useToast } from "../ui.jsx";

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
      {
        name: "technologies", label: "Technologies", type: "tags", options: options.technologies,
        help: "Cochez les technologies du projet ou ajoutez-en une nouvelle. Pensez à enregistrer le projet.",
        emptyText: "Aucune technologie sélectionnée.",
        createPlaceholder: "Nouvelle technologie (ex. Django)", createLabel: "+ Ajouter", createMax: 60,
        onCreate: async (name) => {
          const technology = await api.post("/admin/technologies/", { name });
          return { value: technology.id, label: technology.name };
        },
      },
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

const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

function GalleryItem({ base, image, onRemove }) {
  const save = async (data) => {
    await api.patch(`${base}images/${image.id}/`, data);
  };
  return (
    <div className="gallery-admin__item">
      <Thumb asset={image.image} className="" alt={image.alt_fr || ""} />
      <SchemaForm sections={[{ fields: [bi("alt", "Texte alternatif", "text", { max: 200 }), bi("caption", "Légende", "text", { max: 200 })] }]}
        initial={image} submitLabel="OK" onSubmit={save} successMessage="Image mise à jour." />
      <button className="btn btn--small btn--danger" type="button" onClick={onRemove}>Supprimer</button>
    </div>
  );
}

/** Visuels d'un projet existant : couverture, schéma d'architecture et galerie. */
function ProjectMedia({ item }) {
  const toast = useToast();
  const base = `/admin/projects/${item.id}/`;
  const [images, setImages] = useState(item.images || []);

  const removeImage = async (image) => {
    if (!window.confirm("Supprimer cette image ?")) return;
    try {
      await api.delete(`${base}images/${image.id}/`);
      setImages((list) => list.filter((i) => i.id !== image.id));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <section className="form-section">
      <h2>Visuels</h2>
      <UploadControl
        label="Image de prévisualisation" accept={IMAGE_TYPES} current={item.cover}
        help="JPEG, PNG ou WebP, 5 Mo maximum. L'image est ré-encodée (WebP/AVIF) et ses métadonnées supprimées."
        onUpload={async (file) => { const p = await api.upload(`${base}cover/`, file); toast("Image enregistrée."); return p.cover; }}
        onDelete={async () => { await api.delete(`${base}cover/`); toast("Image supprimée."); }}
      />
      <UploadControl
        label="Schéma d'architecture (chapitre 05)" accept={IMAGE_TYPES} current={item.architecture_image}
        help="Facultatif. Mêmes règles que l'image de couverture."
        onUpload={async (file) => { const p = await api.upload(`${base}architecture-image/`, file); toast("Schéma enregistré."); return p.architecture_image; }}
        onDelete={async () => { await api.delete(`${base}architecture-image/`); toast("Schéma supprimé."); }}
      />
      <h3 className="card__title">Captures (chapitre 07)</h3>
      <div className="gallery-admin">
        {images.map((image) => <GalleryItem key={image.id} base={base} image={image} onRemove={() => removeImage(image)} />)}
      </div>
      <UploadControl
        label="Ajouter une capture à la galerie" accept={IMAGE_TYPES} help="12 images maximum par projet."
        onUpload={async (file) => { const image = await api.upload(`${base}images/`, file); setImages((list) => [...list, image]); return null; }}
      />
    </section>
  );
}

const resource = {
  title: "Projets",
  subtitle: "Ajoutez, modifiez et publiez vos réalisations.",
  singular: "Projet",
  addLabel: "Nouveau projet",
  endpoint: "/admin/projects/",
  route: "/projects",
  emptyText: "Aucun projet. Créez votre premier projet.",
  labelOf: (p) => p.title_fr,
  defaults: { is_published: false, display_order: 0 },
  loadOptions,
  schema,
  After: ProjectMedia,
  columns: [
    { label: "Aperçu", render: (p) => <Thumb asset={p.cover} /> },
    { label: "Titre", render: (p) => <span>{p.title_fr}{p.is_sample ? <> <Badge kind="sample">Exemple</Badge></> : null}</span> },
    { label: "Statut", render: (p) => <Badge on={p.is_published}>{p.is_published ? "Publié" : "Brouillon"}</Badge> },
    { label: "Ordre", render: (p) => String(p.display_order) },
    { label: "Modifié", render: (p) => fmtDate(p.updated_at) },
  ],
};

export function ProjectsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (id) return <CrudEdit key={id} config={resource} id={id} />;
  const status = params.get("status") || "";
  const tabs = [["/projects", "Tous"], ["/projects?status=published", "Publiés"], ["/projects?status=draft", "Brouillons"]];
  return (
    <CrudList config={resource} query={status ? `?status=${encodeURIComponent(status)}` : ""}
      toolbar={<Tabs items={tabs} current={status ? `/projects?status=${status}` : "/projects"} />} />
  );
}
