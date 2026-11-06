/**
 * Point d'entrée du site public.
 * Toutes les sections de l'accueil : hero, À propos, Compétences, Parcours, Projets, Contact et pied de page. Les autres sections arrivent ensuite.
 */
import { api } from "./core/api.js";
import { initHeader } from "./components/header.js";
import { initMobileMenu } from "./components/mobileMenu.js";
import { fillHero, playHeroIntro } from "./sections/hero.js";
import { renderAbout } from "./sections/about.js";
import { renderSkills } from "./sections/skills.js";
import { renderCareer } from "./sections/career.js";
import { renderProjects } from "./sections/projects.js";
import { initContactForm, renderChannels } from "./sections/contact.js";
import { renderFooter } from "./sections/footer.js";
import { reveal } from "./utils/reveal.js";

async function loadSite() {
  try {
    const site = await api.site();
    fillHero(site.profile);
    renderAbout(site.profile);
    renderSkills(site.skills || []);
    renderCareer(site.career || {}, site.profile);
    renderProjects(site.projects || [], site.categories || []);
    renderChannels(site.profile);
    renderFooter(site.profile);
    reveal();
    return site;
  } catch (error) {
    // Les textes provisoires du HTML restent affichés : la page reste utilisable.
    console.warn("Contenu indisponible :", error.message);
    return null;
  }
}

initHeader();
renderFooter(null);
initContactForm();
initMobileMenu();
reveal();
playHeroIntro(loadSite());
