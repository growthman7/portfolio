/** Catégories de projets, technologies, compétences et parcours : listes + formulaires génériques. */
import { useParams } from "react-router";
import { getAll } from "../api.js";
import { CrudEdit, CrudList } from "../crud.jsx";
import { bi } from "../forms.jsx";
import { Published, Tabs, fmtDate } from "../ui.jsx";

const opts = (pairs) => pairs.map(([value, label]) => ({ value, label }));

/** Page à onglets : chaque onglet est une ressource CRUD ; `/base/:section/:id` ouvre le formulaire. */
function SectionedPage({ base, resources, fallback }) {
  const { section, id } = useParams();
  const key = section in resources ? section : fallback;
  const config = resources[key];
  if (id) return <CrudEdit key={`${key}-${id}`} config={config} id={id} />;
  const tabs = Object.entries(resources).map(([name, r]) => [`${base}/${name}`, r.tab]);
  return <CrudList key={key} config={config} toolbar={<Tabs items={tabs} current={`${base}/${key}`} />} />;
}

/* ---------- Catégories & technologies ---------- */

const taxonomy = {
  categories: {
    tab: "Catégories de projets",
    title: "Catégories & technologies",
    subtitle: "Catégories utilisées pour filtrer les projets (Frontend, Backend, Full Stack…).",
    singular: "Catégorie de projet",
    addLabel: "Nouvelle catégorie",
    endpoint: "/admin/categories/",
    route: "/taxonomy/categories",
    labelOf: (c) => c.name_fr,
    schema: () => [{ fields: [bi("name", "Nom", "text", { required: true, max: 60 }), { name: "slug", label: "Identifiant", max: 60, help: "Généré automatiquement si vide." }, { name: "display_order", label: "Ordre", type: "number", min: 0 }] }],
    columns: [
      { label: "Nom", render: (c) => c.name_fr },
      { label: "Anglais", render: (c) => c.name_en || "—" },
      { label: "Projets", render: (c) => String(c.project_count) },
    ],
  },
  technologies: {
    tab: "Technologies",
    title: "Catégories & technologies",
    subtitle: "Technologies associées aux projets et aux expériences.",
    singular: "Technologie",
    addLabel: "Nouvelle technologie",
    endpoint: "/admin/technologies/",
    route: "/taxonomy/technologies",
    labelOf: (t) => t.name,
    schema: () => [{ fields: [{ name: "name", label: "Nom", required: true, max: 60 }, { name: "slug", label: "Identifiant", max: 60, help: "Généré automatiquement si vide." }] }],
    columns: [{ label: "Nom", render: (t) => t.name }, { label: "Identifiant", render: (t) => <code className="mono">{t.slug}</code> }],
  },
};

export const TaxonomyPage = () => <SectionedPage base="/taxonomy" resources={taxonomy} fallback="categories" />;

/* ---------- Compétences ---------- */

const SKILL_KINDS = opts([
  ["frontend", "Frontend"], ["backend", "Backend"], ["fullstack", "Full Stack"], ["databases", "Bases de données"],
  ["systems", "Systèmes et réseaux"], ["devops", "DevOps et automatisation"], ["data", "Data Analytics"],
  ["security", "Cybersécurité"], ["tools", "Outils"], ["other", "Autre"],
]);
const LEVELS = opts([["notions", "Notions"], ["intermediate", "Intermédiaire"], ["advanced", "Avancé"], ["expert", "Expert"]]);

const skills = {
  skills: {
    tab: "Compétences",
    title: "Compétences",
    subtitle: "Le niveau est facultatif : il n'est affiché que si vous le renseignez.",
    singular: "Compétence",
    addLabel: "Nouvelle compétence",
    endpoint: "/admin/skills/",
    route: "/skills/skills",
    labelOf: (s) => s.name,
    defaults: { is_published: true, display_order: 0 },
    loadOptions: async () => ({ categories: (await getAll("/admin/skill-categories/")).map((c) => ({ value: c.id, label: c.name_fr })) }),
    schema: (options) => [
      {
        fields: [
          { name: "name", label: "Nom", required: true, max: 60 },
          { name: "category", label: "Catégorie", type: "select", options: options.categories, numeric: true, required: true },
          { name: "level", label: "Niveau (facultatif)", type: "select", options: LEVELS, allowEmpty: true, emptyLabel: "Non affiché" },
          { name: "years", label: "Années de pratique (facultatif)", type: "number", min: 0, maxValue: 60 },
          { name: "display_order", label: "Ordre", type: "number", min: 0 },
          { name: "is_published", label: "Publiée", type: "checkbox" },
        ],
      },
    ],
    columns: [
      { label: "Compétence", render: (s) => s.name },
      { label: "Niveau", render: (s) => LEVELS.find((l) => l.value === s.level)?.label || "—" },
      { label: "Statut", render: (s) => <Published item={s} on="Publiée" off="Masquée" /> },
    ],
  },
  categories: {
    tab: "Catégories",
    title: "Compétences",
    subtitle: "Catégories affichées sur le site public.",
    singular: "Catégorie de compétences",
    addLabel: "Nouvelle catégorie",
    endpoint: "/admin/skill-categories/",
    route: "/skills/categories",
    labelOf: (c) => c.name_fr,
    schema: () => [{ fields: [{ name: "kind", label: "Type (icône)", type: "select", options: SKILL_KINDS, required: true }, bi("name", "Nom", "text", { required: true, max: 80 }), { name: "display_order", label: "Ordre", type: "number", min: 0 }] }],
    columns: [
      { label: "Catégorie", render: (c) => c.name_fr },
      { label: "Type", render: (c) => SKILL_KINDS.find((k) => k.value === c.kind)?.label || c.kind },
      { label: "Compétences", render: (c) => String(c.skill_count) },
    ],
  },
};

export const SkillsPage = () => <SectionedPage base="/skills" resources={skills} fallback="skills" />;

/* ---------- Parcours ---------- */

const JOB_KINDS = opts([["job", "Emploi"], ["internship", "Stage"], ["apprenticeship", "Alternance"], ["freelance", "Freelance"], ["volunteer", "Bénévolat"]]);
const period = (start, end) => `${fmtDate(start)} → ${end ? fmtDate(end) : "en cours"}`;
const publication = [{ name: "is_published", label: "Publié", type: "checkbox" }, { name: "display_order", label: "Ordre", type: "number", min: 0 }];
const published = (item) => <Published item={item} />;

const career = {
  experiences: {
    tab: "Expériences & stages",
    title: "Parcours",
    subtitle: "Expériences professionnelles, stages et missions réalisées.",
    singular: "Expérience",
    addLabel: "Nouvelle expérience",
    endpoint: "/admin/experiences/",
    route: "/career/experiences",
    labelOf: (e) => `${e.title_fr} — ${e.organization}`,
    defaults: { kind: "job", is_published: false, display_order: 0, missions: [] },
    loadOptions: async () => ({ technologies: (await getAll("/admin/technologies/")).map((t) => ({ value: t.id, label: t.name })) }),
    schema: (options) => [
      {
        fields: [
          { name: "kind", label: "Type", type: "select", options: JOB_KINDS, required: true },
          { name: "organization", label: "Entreprise / organisation", required: true, max: 120 },
          bi("title", "Intitulé du poste", "text", { required: true, max: 120 }),
          { name: "location", label: "Lieu", max: 120 },
          { name: "start_date", label: "Début", type: "date", required: true },
          { name: "end_date", label: "Fin (vide = en cours)", type: "date" },
          bi("summary", "Résumé", "textarea", { max: 2000, rows: 4 }),
        ],
      },
      { title: "Missions principales", fields: [{ name: "missions", label: "Missions", type: "missions" }] },
      { title: "Technologies & publication", fields: [{ name: "technologies", label: "Technologies utilisées", type: "multiselect", options: options.technologies }, ...publication] },
    ],
    columns: [
      { label: "Poste", render: (e) => e.title_fr },
      { label: "Organisation", render: (e) => e.organization },
      { label: "Période", render: (e) => period(e.start_date, e.end_date) },
      { label: "Statut", render: published },
    ],
  },
  educations: {
    tab: "Formations & diplômes",
    title: "Parcours",
    subtitle: "Formations suivies et diplômes obtenus.",
    singular: "Formation",
    addLabel: "Nouvelle formation",
    endpoint: "/admin/educations/",
    route: "/career/educations",
    labelOf: (e) => `${e.degree_fr} — ${e.institution}`,
    defaults: { is_published: false, display_order: 0 },
    schema: () => [
      {
        fields: [
          bi("degree", "Diplôme / formation", "text", { required: true, max: 160 }),
          bi("field", "Spécialité", "text", { max: 160 }),
          { name: "institution", label: "Établissement", required: true, max: 160 },
          { name: "location", label: "Lieu", max: 120 },
          { name: "start_date", label: "Début", type: "date" },
          { name: "end_date", label: "Fin", type: "date" },
          { name: "is_degree", label: "Diplôme obtenu", type: "checkbox" },
          bi("description", "Description", "textarea", { max: 2000, rows: 4 }),
          ...publication,
        ],
      },
    ],
    columns: [
      { label: "Formation", render: (e) => e.degree_fr },
      { label: "Établissement", render: (e) => e.institution },
      { label: "Diplôme", render: (e) => (e.is_degree ? "Oui" : "—") },
      { label: "Statut", render: published },
    ],
  },
  certifications: {
    tab: "Certifications",
    title: "Parcours",
    subtitle: "Certifications professionnelles.",
    singular: "Certification",
    addLabel: "Nouvelle certification",
    endpoint: "/admin/certifications/",
    route: "/career/certifications",
    labelOf: (c) => c.name,
    defaults: { is_published: false, display_order: 0 },
    schema: () => [
      {
        fields: [
          { name: "name", label: "Intitulé", required: true, max: 160 },
          { name: "issuer", label: "Organisme", required: true, max: 120 },
          { name: "issued_on", label: "Obtenue le", type: "date", required: true },
          { name: "expires_on", label: "Expire le", type: "date" },
          { name: "credential_id", label: "Identifiant", max: 120 },
          { name: "credential_url", label: "Lien de vérification", type: "url", max: 300, placeholder: "https://…" },
          ...publication,
        ],
      },
    ],
    columns: [
      { label: "Certification", render: (c) => c.name },
      { label: "Organisme", render: (c) => c.issuer },
      { label: "Obtenue", render: (c) => fmtDate(c.issued_on) },
      { label: "Statut", render: published },
    ],
  },
  achievements: {
    tab: "Réalisations",
    title: "Parcours",
    subtitle: "Réalisations marquantes : prix, publications, contributions, hackathons…",
    singular: "Réalisation",
    addLabel: "Nouvelle réalisation",
    endpoint: "/admin/achievements/",
    route: "/career/achievements",
    labelOf: (a) => a.title_fr,
    defaults: { is_published: false, display_order: 0 },
    schema: () => [
      {
        fields: [
          bi("title", "Intitulé", "text", { required: true, max: 160 }),
          { name: "date", label: "Date", type: "date" },
          { name: "url", label: "Lien (facultatif)", type: "url", max: 300, placeholder: "https://…" },
          bi("description", "Description", "textarea", { max: 1500, rows: 4 }),
          ...publication,
        ],
      },
    ],
    columns: [
      { label: "Réalisation", render: (a) => a.title_fr },
      { label: "Date", render: (a) => (a.date ? fmtDate(a.date) : "—") },
      { label: "Statut", render: published },
    ],
  },
};

export const CareerPage = () => <SectionedPage base="/career" resources={career} fallback="experiences" />;

