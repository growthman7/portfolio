/**
 * Parcours : expériences, stages, formations, certifications et réalisations sur une même timeline,
 * triées de la plus récente à la plus ancienne, filtrables, avec missions dépliables.
 */
import { $, $$, h, safeUrl } from "../core/dom.js";
import { formatDate, formatRange, t } from "../core/i18n.js";
import { reveal } from "../utils/reveal.js";
import { reducedMotion } from "../utils/motion.js";

const GROUPS = ["work", "internship", "education", "certification", "achievement"];
let uid = 0;

function chips(names) {
  return names?.length ? h("ul", { class: "chips", role: "list", "aria-label": t.career.tech }, names.map((name) => h("li", { class: "chip", text: name }))) : null;
}

function collapsible(content) {
  const id = `tl-details-${++uid}`;
  const panel = h("div", { class: "tl-details", id }, h("div", { class: "tl-details__inner" }, content));
  const button = h("button", { class: "tl-toggle", type: "button", "aria-expanded": "false", "aria-controls": id },
    h("span", { class: "tl-toggle__sign", "aria-hidden": "true", text: "+" }), h("span", { text: t.career.showMissions }));
  panel.inert = true;
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    button.lastChild.textContent = open ? t.career.hideMissions : t.career.showMissions;
    panel.classList.toggle("is-open", open);
    panel.inert = !open;
  });
  return [button, panel];
}

function item(group, date, sortKey, children) {
  const el = h("li", { class: "tl-item", "data-reveal": "" }, h("p", { class: "tl-item__date", text: date }), children);
  return { el, group, sortKey: sortKey || "0000", year: (sortKey || "").slice(0, 4) };
}

function experience(exp) {
  const group = exp.kind === "internship" ? "internship" : "work";
  const extra = [exp.missions?.length ? h("ul", { class: "missions" }, exp.missions.map((m) => h("li", { text: m }))) : null, chips(exp.technologies)].filter(Boolean);
  return item(group, formatRange(exp.start_date, exp.end_date), exp.end_date || "9999", [
    h("p", { class: "tl-item__kind", text: t.career.kinds[exp.kind] || t.career.kinds.job }),
    h("h3", { class: "tl-item__title", text: exp.title }),
    h("p", { class: "tl-item__org" }, exp.organization, exp.location ? h("span", { text: ` · ${exp.location}` }) : null),
    exp.summary ? h("p", { class: "tl-item__text", text: exp.summary }) : null,
    extra.length ? collapsible(extra) : null,
  ]);
}

function education(edu) {
  return item("education", formatRange(edu.start_date, edu.end_date, { year: true }), edu.end_date || edu.start_date || "9999", [
    h("p", { class: "tl-item__kind", text: t.career.groups.education }),
    h("h3", { class: "tl-item__title", text: edu.degree }),
    h("p", { class: "tl-item__org" }, edu.institution, edu.field ? h("span", { text: ` · ${edu.field}` }) : null),
    edu.description ? h("p", { class: "tl-item__text", text: edu.description }) : null,
    edu.is_degree ? h("span", { class: "chip tl-item__badge", text: t.career.degree }) : null,
  ]);
}

function certification(cert) {
  const link = safeUrl(cert.credential_url);
  return item("certification", formatDate(cert.issued_on), cert.issued_on, [
    h("p", { class: "tl-item__kind", text: t.career.groups.certification }),
    h("h3", { class: "tl-item__title", text: cert.name }),
    h("p", { class: "tl-item__org" }, cert.issuer, cert.expires_on ? h("span", { text: ` · ${t.career.expires} ${formatDate(cert.expires_on)}` }) : null),
    link ? h("a", { class: "tl-item__link", href: link, target: "_blank", rel: "noopener noreferrer", text: `${t.career.verify} ↗` }) : null,
  ]);
}

function achievement(ach) {
  const link = safeUrl(ach.url);
  return item("achievement", formatDate(ach.date, { year: true }), ach.date, [
    h("p", { class: "tl-item__kind", text: t.career.groups.achievement }),
    h("h3", { class: "tl-item__title", text: ach.title }),
    ach.description ? h("p", { class: "tl-item__text", text: ach.description }) : null,
    link ? h("a", { class: "tl-item__link", href: link, target: "_blank", rel: "noopener noreferrer", text: `${t.career.more} ↗` }) : null,
  ]);
}

/** Remplit le filet de la timeline au fil du défilement et marque les étapes déjà passées. */
function trackProgress(list) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const fill = $(".timeline__fill", list);
    if (!fill) return;
    const rect = list.getBoundingClientRect();
    const anchor = window.innerHeight * 0.6;
    const ratio = Math.min(1, Math.max(0, (anchor - rect.top) / Math.max(1, rect.height)));
    fill.style.transform = `scaleY(${ratio})`;
    $$(".tl-item", list).forEach((el) => el.classList.toggle("is-passed", el.getBoundingClientRect().top + 30 < anchor));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
  return update;
}

export function renderCareer(career, profile) {
  const list = $("[data-timeline]");
  const filters = $("[data-career-filters]");
  const items = [
    ...(career.experiences || []).map(experience),
    ...(career.educations || []).map(education),
    ...(career.certifications || []).map(certification),
    ...(career.achievements || []).map(achievement),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const cv = $("[data-cv-download]");
  const cvUrl = safeUrl(profile?.cv?.url);
  if (cvUrl) {
    cv.href = cvUrl;
    cv.setAttribute("download", "");
    cv.removeAttribute("aria-disabled");
  }

  if (!items.length) {
    list.replaceWith(h("p", { class: "pending mono career__empty", text: t.career.empty }));
    filters.hidden = true;
    return;
  }

  let refresh = () => {};
  const draw = (group) => {
    const rail = h("div", { class: "timeline__rail", "aria-hidden": "true" }, h("div", { class: "timeline__fill" }));
    const nodes = [rail];
    let lastYear = null;
    for (const entry of items) {
      if (group !== "all" && entry.group !== group) continue;
      const year = entry.sortKey === "9999" ? t.career.today : entry.year;
      if (year && year !== lastYear) {
        nodes.push(h("li", { class: "tl-year", "aria-hidden": "true", text: year }));
        lastYear = year;
      }
      nodes.push(entry.el);
    }
    list.replaceChildren(...nodes);
    reveal(list);
    refresh();
  };

  const counts = Object.fromEntries(GROUPS.map((g) => [g, items.filter((i) => i.group === g).length]));
  const options = [["all", t.career.all, items.length], ...GROUPS.filter((g) => counts[g]).map((g) => [g, t.career.groups[g], counts[g]])];
  filters.replaceChildren(
    ...options.map(([value, label, count], index) => {
      const button = h("button", { class: "filter", type: "button", "aria-pressed": String(index === 0) }, label, h("span", { class: "filter__count", text: count }));
      button.addEventListener("click", () => {
        $$(".filter", filters).forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        draw(value);
      });
      return button;
    })
  );

  refresh = reducedMotion()
    ? () => { $(".timeline__fill", list).style.transform = "scaleY(1)"; $$(".tl-item", list).forEach((el) => el.classList.add("is-passed")); }
    : trackProgress(list);
  draw("all");
}
