/**
 * Hero : remplissage depuis l'API, puis séquence d'apparition
 * (invite qui se tape → réponse de « whoami » → nom mot par mot → reste du hero).
 */
import { $, $$, h, picture, safeUrl } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { reducedMotion, wait } from "../utils/motion.js";
import { typeCommand } from "../components/terminal.js";

function slugify(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Découpe un titre en mots pour l'apparition progressive (le texte reste lisible pour les lecteurs d'écran). */
function splitWords(element) {
  for (const span of element.children) {
    const words = span.textContent.trim().split(/\s+/);
    span.replaceChildren(...words.flatMap((word, i) => (i < words.length - 1 ? [h("span", { class: "word", text: word }), " "] : [h("span", { class: "word", text: word })])));
  }
  $$(".word", element).forEach((word, i) => { word.style.transitionDelay = `${i * 110}ms`; });
}

export function fillHero(profile) {
  const values = {
    first_name: profile.first_name,
    last_name: profile.last_name,
    job_title: profile.job_title,
    short_bio: profile.short_bio,
    location: profile.location,
    slug: slugify(`${profile.first_name}-${profile.last_name}`) || "portfolio",
    whoami: [profile.job_title, profile.location].filter(Boolean).join(" · "),
  };
  $$("[data-bind]").forEach((el) => {
    const value = values[el.dataset.bind];
    if (typeof value === "string" && value) el.textContent = value;
  });

  $("[data-expertise]").replaceChildren(...(profile.expertise || []).map((item) => h("li", { class: "chip", text: item })));

  const frame = $("[data-portrait]");
  const photo = picture(profile.photo, { sizes: "(min-width: 900px) 420px, 300px", eager: true, alt: profile.photo?.alt || `${profile.first_name} ${profile.last_name}` });
  if (photo) {
    photo.querySelector("img").setAttribute("fetchpriority", "high");
    frame.replaceChildren(photo);
  }

  const cv = $("[data-cv-link]");
  const cvUrl = safeUrl(profile.cv?.url);
  if (cvUrl) {
    Object.assign(cv, { href: cvUrl });
    cv.setAttribute("download", "");
    cv.removeAttribute("aria-disabled");
  } else {
    cv.title = t.cvMissing;
  }
}

export async function playHeroIntro(dataReady) {
  const terminal = $("[data-terminal]");
  const elements = $$("[data-enter]");
  const name = $("[data-split]");

  if (reducedMotion()) {
    await dataReady;
    $("[data-typed]").textContent = "whoami";
    splitWords(name);
    terminal.classList.add("is-done");
    elements.forEach((el) => el.classList.add("is-on"));
    return;
  }

  // La frappe et le chargement des données se déroulent en parallèle.
  await Promise.all([typeCommand($("[data-typed]"), "whoami"), dataReady]);
  terminal.classList.add("is-done");
  splitWords(name);

  const [output, ...rest] = elements;
  output.classList.add("is-on");
  await wait(260);
  for (const [index, el] of rest.entries()) {
    el.style.transitionDelay = `${index * 90}ms`;
    el.classList.add("is-on");
  }
}
