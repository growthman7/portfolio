import { crud } from "../core/crud.js";
import { h } from "../core/dom.js";
import { bi } from "../core/forms.js";

const tabs = (current) =>
  h("div", { class: "tabs", role: "tablist" }, [["categories", "Catégories de projets"], ["technologies", "Technologies"]].map(([key, label]) => h("a", { class: "tab", role: "tab", href: `#/taxonomy/${key}`, "aria-selected": String(key === current), text: label })));

const categories = crud({
  title: "Catégories & technologies",
  subtitle: "Catégories utilisées pour filtrer les projets (Frontend, Backend, Full Stack…).",
  singular: "Catégorie de projet",
  addLabel: "Nouvelle catégorie",
  endpoint: "/admin/categories/",
  route: "#/taxonomy/categories",
  labelOf: (c) => c.name_fr,
  schema: () => [{ fields: [bi("name", "Nom", "text", { required: true, max: 60 }), { name: "slug", label: "Identifiant", max: 60, help: "Généré automatiquement si vide." }, { name: "display_order", label: "Ordre", type: "number", min: 0 }] }],
  columns: [
    { label: "Nom", render: (c) => c.name_fr },
    { label: "Anglais", render: (c) => c.name_en || "—" },
    { label: "Projets", render: (c) => String(c.project_count) },
  ],
});

const technologies = crud({
  title: "Catégories & technologies",
  subtitle: "Technologies associées aux projets et aux expériences.",
  singular: "Technologie",
  addLabel: "Nouvelle technologie",
  endpoint: "/admin/technologies/",
  route: "#/taxonomy/technologies",
  labelOf: (t) => t.name,
  schema: () => [{ fields: [{ name: "name", label: "Nom", required: true, max: 60 }, { name: "slug", label: "Identifiant", max: 60, help: "Généré automatiquement si vide." }] }],
  columns: [{ label: "Nom", render: (t) => t.name }, { label: "Identifiant", render: (t) => h("code", { class: "mono", text: t.slug }) }],
});

export function taxonomy(view, section = "categories", id) {
  const resource = section === "technologies" ? technologies : categories;
  if (id) return resource.edit(view, id);
  return resource.list(view, { toolbar: tabs(section) });
}
