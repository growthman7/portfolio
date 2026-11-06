/** Section À propos : textes du profil, découpés en paragraphes, apparition progressive au défilement. */
import { $, h } from "../core/dom.js";
import { t } from "../core/i18n.js";

const FACTS = ["vision", "interests", "approach", "ambitions"];

/** Un texte saisi dans l'administration peut contenir des retours à la ligne : un paragraphe par bloc. */
function paragraphs(text) {
  return (text || "").split(/\n\s*\n|\n/).map((part) => part.trim()).filter(Boolean).map((part) => h("p", { text: part }));
}

export function renderAbout(profile) {
  const lead = $("[data-about-lead]");
  const story = paragraphs(profile.about);
  if (story.length) lead.replaceChildren(...story);

  const list = $("[data-about-facts]");
  const items = FACTS.filter((key) => profile[key]).map((key, index) =>
    h(
      "div",
      { class: "about__fact", "data-reveal": "" },
      h("dt", { class: "about__key" }, h("span", { text: "› " }), t.about[key]),
      h("dd", { class: "about__value" }, paragraphs(profile[key]))
    )
  );
  items.forEach((item, index) => { item.style.transitionDelay = `${index * 80}ms`; });
  list.replaceChildren(...items);
  list.hidden = items.length === 0;

  const status = $("[data-about-status]");
  status.classList.toggle("about__status--on", Boolean(profile.is_available));
  $("[data-about-status-text]").textContent = profile.is_available ? t.about.available : t.about.unavailable;
}
