/**
 * Point d'entrée de la page de détail d'un projet.
 * Le projet est désigné par <html data-slug> (pages générées en production) ou par le fragment de l'adresse.
 */
import { api } from "./core/api.js";
import { $, $$ } from "./core/dom.js";
import { initHeader, onSectionChange } from "./components/header.js";
import { initMobileMenu } from "./components/mobileMenu.js";
import { renderMissing, renderProject } from "./sections/projectDetail.js";
import { reveal } from "./utils/reveal.js";
import { renderFooter } from "./sections/footer.js";

const home = $("[data-case]").dataset.home;

function currentSlug() {
  const slug = document.documentElement.dataset.slug || decodeURIComponent(window.location.hash.slice(1));
  return /^[a-z0-9-]{1,120}$/.test(slug) ? slug : null;
}

let refreshHeader = () => {};

async function load() {
  const slug = currentSlug();
  // Le lien de changement de langue conserve le projet affiché (les pages générées pointent déjà au bon endroit).
  if (!document.documentElement.dataset.slug) {
    $$("[data-lang-other]").forEach((a) => { a.href = a.getAttribute("href").split("#")[0] + (slug ? `#${slug}` : ""); });
  }
  if (!slug) return renderMissing(home);
  try {
    const project = await api.project(slug);
    renderProject(project, home);
    reveal();
    window.scrollTo({ top: 0 });
    refreshHeader();
  } catch (error) {
    if (error.status === 404) renderMissing(home);
    else {
      renderMissing(home);
      console.warn("Projet indisponible :", error.message);
    }
  }
}

refreshHeader = initHeader();
renderFooter(null);
api.site().then((site) => renderFooter(site.profile)).catch(() => {});
initMobileMenu();
onSectionChange((id) => $$("[data-toc]").forEach((a) => a.setAttribute("aria-current", String(a.dataset.toc === id))));
// Les chapitres ont leur propre fragment (#contexte…) : seul un fragment qui désigne un projet recharge la page.
window.addEventListener("hashchange", () => { if (currentSlug() && !document.getElementById(window.location.hash.slice(1))) load(); });
load();
