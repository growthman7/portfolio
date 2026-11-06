/**
 * Galerie de projets : cartes, filtre par catégorie et par technologie (combinés),
 * lien vers la page de détail de chaque projet.
 */
import { $, $$, h, icon, picture, safeUrl } from "../core/dom.js";
import { formatDate, t } from "../core/i18n.js";
import { reveal } from "../utils/reveal.js";

/** Adresse de la page de détail. En production, chaque projet a sa page /projets/<slug>/. */
// En production, les pages projet sont générées par le backend (/projets/<slug>/) et annoncées
// par <meta name="pf-project-url">. Sans cette balise (aperçu, développement), on utilise projet.html#slug.
const PROJECT_URL = document.querySelector('meta[name="pf-project-url"]')?.content || "";

export function projectUrl(slug) {
  const safe = encodeURIComponent(slug);
  return PROJECT_URL.includes("{slug}") ? PROJECT_URL.replace("{slug}", safe) : `projet.html#${safe}`;
}

function placeholderShot() {
  return h("div", { class: "shot", "aria-hidden": "true" },
    h("div", { class: "shot__lines" }, h("i"), h("i"), h("i")), h("div", { class: "shot__panel" }), h("span", { class: "shot__note mono", text: t.projects.shotMissing }));
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return ""; }
}

function card(project, featured) {
  const href = projectUrl(project.slug);
  const media = h("div", { class: "project-card__media" },
    picture(project.cover, { sizes: featured ? "(min-width: 1024px) 1200px, 100vw" : "(min-width: 760px) 50vw, 100vw", alt: project.cover?.alt || "" }) || placeholderShot());
  media.addEventListener("pointermove", (event) => {
    const rect = media.getBoundingClientRect();
    media.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    media.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });
  const demo = safeUrl(project.demo_url);
  const repo = safeUrl(project.repo_url);
  const year = formatDate(project.started_on, { year: true });

  return h("article", { class: `project-card${featured ? " project-card--featured" : ""}`, "data-reveal": "" },
    h("div", { class: "project-card__frame" },
      h("div", { class: "project-card__bar" }, h("i"), h("i"), h("i"),
        h("span", { class: "project-card__url mono", text: hostOf(demo) || `${project.slug}/` }),
        h("span", { class: "project-card__flags" },
          project.is_sample ? h("span", { class: "flag flag--sample", title: t.projects.sampleNotice, text: t.projects.sample }) : null,
          featured ? h("span", { class: "flag flag--featured", text: t.projects.featured }) : null)),
      media),
    h("div", { class: "project-card__body" },
      h("p", { class: "project-card__meta mono" }, h("span", { text: project.category?.name || "" }), year ? h("span", { text: year }) : null),
      h("h3", { class: "project-card__title" }, h("a", { href, text: project.title })),
      h("p", { class: "project-card__summary", text: project.summary }),
      project.technologies?.length ? h("ul", { class: "chips", role: "list", "aria-label": t.projects.stack }, project.technologies.map((tech) => h("li", { class: "chip", text: tech.name }))) : null,
      h("div", { class: "project-card__actions" },
        h("a", { class: "project-card__details", href, "aria-label": `${t.projects.details} : ${project.title}` }, t.projects.details, h("span", { "aria-hidden": "true", text: "→" })),
        demo ? h("a", { class: "ext-link", href: demo, target: "_blank", rel: "noopener noreferrer", "aria-label": `${t.projects.demo} : ${project.title} (${t.openNewTab})` }, t.projects.demo, icon("arrow")) : null,
        repo ? h("a", { class: "ext-link", href: repo, target: "_blank", rel: "noopener noreferrer", "aria-label": `GitHub : ${project.title} (${t.openNewTab})` }, "GitHub", icon("arrow")) : null)));
}

export function renderProjects(projects, categories) {
  const grid = $("[data-projects]");
  const cats = $("[data-project-cats]");
  const select = $("[data-project-tech]");
  const count = $("[data-project-count]");
  const reset = $("[data-project-reset]");
  const state = { category: "all", tech: "all" };

  if (!projects.length) {
    $("[data-project-toolbar]").hidden = true;
    grid.replaceChildren(h("p", { class: "projects__empty", text: t.projects.none }));
    return;
  }

  // Technologies réellement utilisées, triées par nombre de projets puis par nom.
  const techUse = new Map();
  projects.forEach((p) => (p.technologies || []).forEach((tech) => {
    const entry = techUse.get(tech.slug) || { ...tech, n: 0 };
    entry.n += 1;
    techUse.set(tech.slug, entry);
  }));
  const techs = [...techUse.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  select.replaceChildren(h("option", { value: "all", text: t.projects.allTech }), ...techs.map((tech) => h("option", { value: tech.slug, text: `${tech.name} (${tech.n})` })));

  const draw = (animate) => {
    const visible = projects.filter((p) =>
      (state.category === "all" || p.category?.slug === state.category) &&
      (state.tech === "all" || (p.technologies || []).some((tech) => tech.slug === state.tech)));
    count.textContent = t.projects.count(visible.length);
    reset.hidden = state.category === "all" && state.tech === "all";
    grid.classList.toggle("is-switching", Boolean(animate));
    if (!visible.length) {
      const again = h("button", { class: "projects__reset", type: "button", text: t.projects.reset, onclick: () => resetAll() });
      grid.replaceChildren(h("div", { class: "projects__empty", role: "status" }, h("p", { text: t.projects.noMatch }), again));
      return;
    }
    const showFeatured = state.category === "all" && state.tech === "all";
    grid.replaceChildren(...visible.map((p, i) => card(p, showFeatured && i === 0 && p.is_featured)));
    if (animate) $$(".project-card", grid).forEach((el) => el.classList.add("is-visible"));
    else reveal(grid);
  };

  const options = [["all", t.projects.all], ...categories.filter((c) => projects.some((p) => p.category?.slug === c.slug)).map((c) => [c.slug, c.name])];
  cats.replaceChildren(...options.map(([value, label]) => {
    const n = value === "all" ? projects.length : projects.filter((p) => p.category?.slug === value).length;
    const button = h("button", { class: "filter", type: "button", "aria-pressed": String(value === "all")}, label, h("span", { class: "filter__count", text: n }));
    button.dataset.value = value;
    button.addEventListener("click", () => {
      state.category = value;
      $$(".filter", cats).forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      draw(true);
    });
    return button;
  }));
  select.addEventListener("change", () => { state.tech = select.value; draw(true); });

  const resetAll = () => {
    state.category = "all";
    state.tech = "all";
    select.value = "all";
    $$(".filter", cats).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === "all")));
    draw(true);
  };
  reset.addEventListener("click", resetAll);
  draw(false);
}
