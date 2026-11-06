/** Section Compétences : domaines et compétences publiés, niveau facultatif sur quatre paliers. */
import { $, h } from "../core/dom.js";
import { t } from "../core/i18n.js";

const LEVELS = ["notions", "intermediate", "advanced", "expert"];
const CODES = {
  frontend: "fe/", backend: "be/", fullstack: "fs/", databases: "db/", systems: "sys/",
  devops: "ops/", data: "data/", security: "sec/", tools: "tools/", other: "misc/",
};

function levelMeter(level) {
  const rank = LEVELS.indexOf(level);
  if (rank < 0) return null; // aucun niveau renseigné : rien n'est affiché
  return h(
    "span",
    { class: "level" },
    h("span", { class: "level__bars", "aria-hidden": "true" }, LEVELS.map((_, i) => h("i", { class: i <= rank ? "on" : null }))),
    h("span", { class: "level__label mono", text: t.levels[level] })
  );
}

export function renderSkills(categories) {
  const grid = $("[data-skills]");
  const visible = categories.filter((category) => category.skills?.length);
  if (!visible.length) {
    grid.replaceWith(h("p", { class: "pending mono", text: t.noSkills }));
    return;
  }
  grid.replaceChildren(
    ...visible.map((category, index) => {
      // L'animation porte sur le contenu, pas sur le panneau : le fond de la grille ne transparaît jamais.
      const inner = h(
        "div",
        { class: "skill-panel__inner", "data-reveal": "" },
        h("header", { class: "skill-panel__head" },
          h("h3", { class: "skill-panel__name", text: category.name }),
          h("span", { class: "skill-panel__code mono", text: CODES[category.kind] || CODES.other })
        ),
        h("ul", { class: "skill-list", role: "list" },
          category.skills.map((skill) => h("li", { class: "skill" }, h("span", { class: "skill__name", text: skill.name }), levelMeter(skill.level)))
        )
      );
      inner.style.transitionDelay = `${(index % 3) * 80}ms`;
      return h("article", { class: "skill-panel" }, inner);
    })
  );
  // La légende n'apparaît que si au moins un niveau est renseigné.
  $("[data-skills-legend]").hidden = !visible.some((category) => category.skills.some((skill) => LEVELS.includes(skill.level)));
}
