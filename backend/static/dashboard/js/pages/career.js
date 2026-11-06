import { getAll } from "../core/api.js";
import { crud } from "../core/crud.js";
import { fmtDate, h } from "../core/dom.js";
import { bi } from "../core/forms.js";

const KINDS = [["job", "Emploi"], ["internship", "Stage"], ["apprenticeship", "Alternance"], ["freelance", "Freelance"], ["volunteer", "Bénévolat"]].map(([value, label]) => ({ value, label }));
const published = (item) => h("span", { class: `badge${item.is_published ? " badge--on" : ""}`, text: item.is_published ? "Publié" : "Masqué" });
const period = (start, end) => `${fmtDate(start)} → ${end ? fmtDate(end) : "en cours"}`;
const publication = [{ name: "is_published", label: "Publié", type: "checkbox" }, { name: "display_order", label: "Ordre", type: "number", min: 0 }];

const tabs = (current) =>
  h("div", { class: "tabs", role: "tablist" }, [["experiences", "Expériences & stages"], ["educations", "Formations & diplômes"], ["certifications", "Certifications"], ["achievements", "Réalisations"]].map(([key, label]) => h("a", { class: "tab", role: "tab", href: `#/career/${key}`, "aria-selected": String(key === current), text: label })));

const resources = {
  experiences: crud({
    title: "Parcours",
    subtitle: "Expériences professionnelles, stages et missions réalisées.",
    singular: "Expérience",
    addLabel: "Nouvelle expérience",
    endpoint: "/admin/experiences/",
    route: "#/career/experiences",
    labelOf: (e) => `${e.title_fr} — ${e.organization}`,
    defaults: { kind: "job", is_published: false, display_order: 0, missions: [] },
    loadOptions: async () => ({ technologies: (await getAll("/admin/technologies/")).map((t) => ({ value: t.id, label: t.name })) }),
    schema: (options) => [
      {
        fields: [
          { name: "kind", label: "Type", type: "select", options: KINDS, required: true },
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
  }),
  educations: crud({
    title: "Parcours",
    subtitle: "Formations suivies et diplômes obtenus.",
    singular: "Formation",
    addLabel: "Nouvelle formation",
    endpoint: "/admin/educations/",
    route: "#/career/educations",
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
  }),
  certifications: crud({
    title: "Parcours",
    subtitle: "Certifications professionnelles.",
    singular: "Certification",
    addLabel: "Nouvelle certification",
    endpoint: "/admin/certifications/",
    route: "#/career/certifications",
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
  }),
  achievements: crud({
    title: "Parcours",
    subtitle: "Réalisations marquantes : prix, publications, contributions, hackathons…",
    singular: "Réalisation",
    addLabel: "Nouvelle réalisation",
    endpoint: "/admin/achievements/",
    route: "#/career/achievements",
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
  }),
};

export function careerPage(view, section = "experiences", id) {
  const resource = resources[section] || resources.experiences;
  if (id) return resource.edit(view, id);
  return resource.list(view, { toolbar: tabs(section in resources ? section : "experiences") });
}
