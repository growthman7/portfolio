/**
 * Page de détail d'un projet : en-tête, couverture, sommaire collant et 10 chapitres
 * (contexte, problématique, objectifs, fonctionnalités, architecture, technologies,
 * captures, difficultés et solutions, résultats, liens). Un chapitre vide n'est pas affiché.
 */
import { $, $$, h, icon, picture, safeUrl } from "../core/dom.js";
import { formatDate, formatRange, t } from "../core/i18n.js";
import { createLightbox } from "../components/lightbox.js";
import { projectUrl } from "./projects.js";

function paragraphs(text) {
  return (text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function textBlock(text) {
  const parts = paragraphs(text);
  return parts.length ? h("div", { class: "chapter__text" }, parts.map((p) => h("p", { text: p }))) : null;
}

function listBlock(text) {
  const items = paragraphs(text);
  return items.length ? h("ul", { class: "bullets" }, items.map((item) => h("li", { text: item }))) : null;
}

function placeholderShot() {
  return h("div", { class: "shot", "aria-hidden": "true" }, h("div", { class: "shot__lines" }, h("i"), h("i"), h("i")), h("div", { class: "shot__panel" }), h("span", { class: "shot__note mono", text: t.projects.shotMissing }));
}

function linkCard(url, label) {
  if (!url) return null;
  const { host, pathname } = new URL(url);
  return h("a", { class: "link-card", href: url, target: "_blank", rel: "noopener noreferrer" },
    h("span", { class: "link-card__label mono", text: label }),
    h("span", { class: "link-card__value" }, host + pathname.replace(/\/$/, ""), icon("arrow")));
}

function chapters(p) {
  const c = t.case.chapters;
  const features = paragraphs(p.features);
  const images = (p.images || []).filter((item) => item.image?.src);
  const demo = safeUrl(p.demo_url);
  const repo = safeUrl(p.repo_url);
  const openLightbox = images.length ? createLightbox(images) : null;

  return [
    ["contexte", c.context, textBlock(p.context)],
    ["problematique", c.problem, textBlock(p.problem)],
    ["objectifs", c.objectives, listBlock(p.objectives)],
    ["fonctionnalites", c.features, features.length
      ? h("ol", { class: "features", role: "list" }, features.map((f, i) => h("li", { class: "feature" }, h("span", { class: "feature__index mono", text: String(i + 1).padStart(2, "0") }), h("span", { class: "feature__text", text: f }))))
      : null],
    ["architecture", c.architecture, (p.architecture || p.architecture_image) ? [
      textBlock(p.architecture),
      p.architecture_image ? h("figure", { class: "arch-figure" }, h("div", { class: "arch-figure__frame" }, picture(p.architecture_image, { sizes: "(min-width: 1024px) 900px, 100vw" })), p.architecture_image.alt ? h("figcaption", { class: "mono", text: p.architecture_image.alt }) : null) : null,
    ] : null],
    ["technologies", c.technologies, p.technologies?.length ? h("ul", { class: "chips", role: "list" }, p.technologies.map((tech) => h("li", { class: "chip", text: tech.name }))) : null],
    ["captures", c.screenshots, images.length
      ? h("ul", { class: "gallery", role: "list" }, images.map((item, i) => {
          const button = h("button", { class: "gallery__button", type: "button", "aria-label": `${t.case.enlarge} ${i + 1}${item.caption ? ` : ${item.caption}` : ""}` }, picture(item.image, { sizes: i === 0 ? "(min-width: 1024px) 900px, 100vw" : "(min-width: 700px) 45vw, 100vw", alt: "" }));
          button.addEventListener("click", () => openLightbox(i, button));
          return h("li", { class: "gallery__item" }, button, item.caption ? h("p", { class: "gallery__caption mono", text: item.caption }) : null);
        }))
      : null],
    ["difficultes", c.challenges, p.challenges?.length
      ? h("div", { class: "challenges" }, p.challenges.map((pair) => h("article", { class: "challenge" },
          h("div", { class: "challenge__part" }, h("p", { class: "challenge__label challenge__label--problem mono", text: t.case.difficulty }), h("p", { text: pair.challenge })),
          h("div", { class: "challenge__part" }, h("p", { class: "challenge__label challenge__label--solution mono", text: t.case.solution }), h("p", { text: pair.solution })))))
      : null],
    ["resultats", c.results, textBlock(p.results)],
    ["liens", c.links, (demo || repo) ? h("div", { class: "links" }, linkCard(demo, t.case.liveDemo), linkCard(repo, t.case.repo)) : null],
  ].filter(([, , content]) => content && (!Array.isArray(content) || content.some(Boolean)));
}

export function renderProject(p, home) {
  document.title = `${p.title} — Portfolio`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", p.summary || "");
  const demo = safeUrl(p.demo_url);
  const repo = safeUrl(p.repo_url);
  const year = formatDate(p.started_on, { year: true });
  const period = p.started_on ? formatRange(p.started_on, p.ended_on) : "";
  const list = chapters(p);

  const hero = h("header", { class: "case-hero container", id: "intro", "data-track": "" },
    h("nav", { class: "case-crumb mono", "aria-label": t.case.breadcrumb },
      h("a", { href: `${home}#${t.case.projectsAnchor}` }, h("span", { class: "accent", text: "←" }), t.case.back),
      h("span", { "aria-hidden": "true", text: `~/${t.case.projectsAnchor}/${p.slug}` })),
    p.is_sample ? h("p", { class: "case-flag" }, h("span", { class: "flag flag--sample", text: t.projects.sampleNotice })) : null,
    h("p", { class: "case-meta mono" }, h("span", { text: p.category?.name || "" }), year ? h("span", { text: year }) : null, period ? h("span", { text: period }) : null),
    h("h1", { class: "case-title", text: p.title }),
    h("p", { class: "case-summary", text: p.summary }),
    (demo || repo) ? h("div", { class: "case-actions" },
      demo ? h("a", { class: "btn btn--primary", href: demo, target: "_blank", rel: "noopener noreferrer" }, t.case.viewDemo, icon("arrow", "icon")) : null,
      repo ? h("a", { class: "btn", href: repo, target: "_blank", rel: "noopener noreferrer" }, icon("code", "icon"), t.case.viewCode) : null) : null,
    h("div", { class: "case-cover project-card__frame" },
      h("div", { class: "project-card__bar" }, h("i"), h("i"), h("i"), h("span", { class: "project-card__url mono", text: demo ? new URL(demo).host : `${p.slug}/` })),
      h("div", { class: "project-card__media" }, picture(p.cover, { sizes: "(min-width: 1240px) 1200px, 100vw", eager: true, alt: p.cover?.alt || "" }) || placeholderShot())));

  const toc = h("nav", { class: "case-toc", "aria-label": t.case.toc },
    h("p", { class: "case-toc__title mono", text: t.case.toc }),
    h("ol", { class: "case-toc__list", role: "list" }, list.map(([id, title], i) => h("li", {}, h("a", { class: "case-toc__link", href: `#${id}`, "data-toc": id }, h("span", { text: String(i + 1).padStart(2, "0") }), title)))));

  const content = h("div", { class: "case-content" }, list.map(([id, title, body], i) =>
    h("section", { class: "chapter", id, "data-track": "", "data-reveal": "", "aria-labelledby": `${id}-t` },
      h("p", { class: "chapter__num mono", text: `${String(i + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}` }),
      h("h2", { class: "chapter__title", id: `${id}-t`, text: title }),
      body)));

  const nav = (p.previous || p.next) ? h("nav", { class: "case-nav", "aria-label": t.case.otherProjects },
    p.previous ? h("a", { class: "case-nav__link", href: projectUrl(p.previous.slug) }, h("span", { class: "case-nav__dir mono", text: `← ${t.case.previous}` }), h("span", { class: "case-nav__title", text: p.previous.title })) : h("span", { class: "case-nav__link", "aria-hidden": "true" }),
    p.next ? h("a", { class: "case-nav__link case-nav__link--next", href: projectUrl(p.next.slug) }, h("span", { class: "case-nav__dir mono", text: `${t.case.next} →` }), h("span", { class: "case-nav__title", text: p.next.title })) : null) : null;

  $("[data-case]").replaceChildren(hero, h("div", { class: "container case-body" }, toc, content), nav);
  $$("[data-bind=slug]").forEach((el) => { el.textContent = `${t.case.projectsAnchor}/${p.slug}`; });
}

export function renderMissing(home) {
  document.title = `${t.case.notFound} — Portfolio`;
  $("[data-case]").replaceChildren(h("div", { class: "container case-missing" },
    h("p", { class: "mono faint", text: "404" }),
    h("h1", { class: "case-title", text: t.case.notFound }),
    h("p", { class: "case-summary", text: t.case.notFoundText }),
    h("a", { class: "btn", href: `${home}#${t.case.projectsAnchor}` }, `← ${t.case.back}`)));
}
