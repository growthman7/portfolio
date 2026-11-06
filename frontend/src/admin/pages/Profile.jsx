import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { api, errorMessage } from "../api.js";
import { CrudEdit, CrudList } from "../crud.jsx";
import { SchemaForm, UploadControl, bi } from "../forms.jsx";
import { Badge, ErrorAlert, Loading, PageHead, useToast } from "../ui.jsx";

const PLATFORMS = [["github", "GitHub"], ["gitlab", "GitLab"], ["linkedin", "LinkedIn"], ["x", "X"], ["mastodon", "Mastodon"], ["stackoverflow", "Stack Overflow"], ["devto", "DEV"], ["medium", "Medium"], ["website", "Site web"]]
  .map(([value, label]) => ({ value, label }));
const platformLabel = (value) => PLATFORMS.find((p) => p.value === value)?.label || value;

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

function ProfileFiles({ profile }) {
  const toast = useToast();
  const image = (field, path, label, extra = {}) => (
    <UploadControl
      label={label} accept="image/jpeg,image/png,image/webp" current={profile[field]} help="JPEG, PNG ou WebP, 5 Mo maximum." {...extra}
      onUpload={async (file) => { const p = await api.upload(`/admin/profile/${path}/`, file); toast("Image enregistrée."); return p[field]; }}
      onDelete={async () => { await api.delete(`/admin/profile/${path}/`); toast("Image supprimée."); }}
    />
  );
  const pdf = (field, path, label, help) => (
    <UploadControl
      label={label} accept="application/pdf" preview="pdf" current={profile[field]} help={help}
      onUpload={async (file) => { const p = await api.upload(`/admin/profile/${path}/`, file); toast("CV enregistré."); return p[field]; }}
      onDelete={async () => { await api.delete(`/admin/profile/${path}/`); toast("CV supprimé."); }}
    />
  );
  const cvHelp = "PDF de 10 Mo maximum, sans script ni pièce jointe.";
  return (
    <section className="form-section">
      <h2>Photo, CV et image de partage</h2>
      <div className="form-grid">
        {image("photo", "photo", "Photo professionnelle", { portrait: true })}
        {image("og_image", "og-image", "Image de partage (Open Graph, 1200×630)")}
        {pdf("cv_fr", "cv/fr", "CV (FR) — PDF", cvHelp)}
        {pdf("cv_en", "cv/en", "CV (EN) — PDF", cvHelp)}
        {pdf("cv_alt", "cv-alt", "Second CV (facultatif) — PDF", "Proposé en plus du CV principal, avec l'intitulé saisi plus haut.")}
      </div>
    </section>
  );
}

function ProfileForm() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    api.get("/admin/profile/").then((profile) => setState({ status: "ready", profile }), (error) => setState({ status: "error", error }));
  }, []);

  const head = (
    <PageHead title="Informations générales" subtitle="Contenu affiché dans le hero, la section À propos et le pied de page.">
      <Link className="btn" to="/profile/links">Réseaux professionnels</Link>
    </PageHead>
  );
  if (state.status === "loading") return <>{head}<Loading /></>;
  if (state.status === "error") return <>{head}<ErrorAlert>{errorMessage(state.error)}</ErrorAlert></>;
  return (
    <>
      {head}
      <ProfileFiles profile={state.profile} />
      <SchemaForm sections={schema} initial={state.profile} onSubmit={(data) => api.patch("/admin/profile/", data)} successMessage="Informations enregistrées." />
    </>
  );
}

const links = {
  title: "Réseaux professionnels",
  subtitle: "Liens affichés dans le hero, la section Contact et le pied de page.",
  singular: "Réseau",
  addLabel: "Ajouter un réseau",
  endpoint: "/admin/social-links/",
  route: "/profile/links",
  labelOf: (l) => l.label || platformLabel(l.platform),
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
    { label: "Plateforme", render: (l) => platformLabel(l.platform) },
    { label: "Adresse", render: (l) => <span className="mono">{l.url}</span> },
    { label: "Statut", render: (l) => <Badge on={l.is_published}>{l.is_published ? "Affiché" : "Masqué"}</Badge> },
  ],
};

export function ProfilePage() {
  const { section, id } = useParams();
  if (section === "links") return id ? <CrudEdit key={id} config={links} id={id} /> : <CrudList config={links} />;
  return <ProfileForm />;
}
