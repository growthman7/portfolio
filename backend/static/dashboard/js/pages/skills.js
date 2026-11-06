import { getAll } from "../core/api.js";
import { crud } from "../core/crud.js";
import { h } from "../core/dom.js";
import { bi } from "../core/forms.js";

const KINDS = [
  ["frontend", "Frontend"], ["backend", "Backend"], ["fullstack", "Full Stack"], ["databases", "Bases de données"],
  ["systems", "Systèmes et réseaux"], ["devops", "DevOps et automatisation"], ["data", "Data Analytics"],
  ["security", "Cybersécurité"], ["tools", "Outils"], ["other", "Autre"],
].map(([value, label]) => ({ value, label }));
const LEVELS = [["notions", "Notions"], ["intermediate", "Intermédiaire"], ["advanced", "Avancé"], ["expert", "Expert"]].map(([value, label]) => ({ value, label }));

const tabs = (current) =>
  h("div", { class: "tabs", role: "tablist" }, [["skills", "Compétences"], ["categories", "Catégories"]].map(([key, label]) => h("a", { class: "tab", role: "tab", href: `#/skills/${key}`, "aria-selected": String(key === current), text: label })));

const skills = crud({
  title: "Compétences",
  subtitle: "Le niveau est facultatif : il n'est affiché que si vous le renseignez.",
  singular: "Compétence",
  addLabel: "Nouvelle compétence",
  endpoint: "/admin/skills/",
  route: "#/skills/skills",
  labelOf: (s) => s.name,
  defaults: { is_published: true, display_order: 0 },
  loadOptions: async () => ({ categories: (await getAll("/admin/skill-categories/")).map((c) => ({ value: c.id, label: c.name_fr })) }),
  schema: (options) => [
    {
      fields: [
        { name: "name", label: "Nom", required: true, max: 60 },
        { name: "category", label: "Catégorie", type: "select", options: options.categories, numeric: true, required: true },
        { name: "level", label: "Niveau (facultatif)", type: "select", options: LEVELS, allowEmpty: true, emptyLabel: "Non affiché" },
        { name: "years", label: "Années de pratique (facultatif)", type: "number", min: 0, max: 60 },
        { name: "display_order", label: "Ordre", type: "number", min: 0 },
        { name: "is_published", label: "Publiée", type: "checkbox" },
      ],
    },
  ],
  columns: [
    { label: "Compétence", render: (s) => s.name },
    { label: "Niveau", render: (s) => LEVELS.find((l) => l.value === s.level)?.label || "—" },
    { label: "Statut", render: (s) => h("span", { class: `badge${s.is_published ? " badge--on" : ""}`, text: s.is_published ? "Publiée" : "Masquée" }) },
  ],
});

const categories = crud({
  title: "Compétences",
  subtitle: "Catégories affichées sur le site public.",
  singular: "Catégorie de compétences",
  addLabel: "Nouvelle catégorie",
  endpoint: "/admin/skill-categories/",
  route: "#/skills/categories",
  labelOf: (c) => c.name_fr,
  schema: () => [{ fields: [{ name: "kind", label: "Type (icône)", type: "select", options: KINDS, required: true }, bi("name", "Nom", "text", { required: true, max: 80 }), { name: "display_order", label: "Ordre", type: "number", min: 0 }] }],
  columns: [{ label: "Catégorie", render: (c) => c.name_fr }, { label: "Type", render: (c) => KINDS.find((k) => k.value === c.kind)?.label || c.kind }, { label: "Compétences", render: (c) => String(c.skill_count) }],
});

export function skillsPage(view, section = "skills", id) {
  const resource = section === "categories" ? categories : skills;
  if (id) return resource.edit(view, id);
  return resource.list(view, { toolbar: tabs(section) });
}
