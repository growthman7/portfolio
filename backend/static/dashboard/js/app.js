/**
 * Dashboard d'administration : routeur par fragment (#/…) et mise en page.
 * Toutes les données passent par l'API protégée côté serveur.
 */
import { api, prefix } from "./core/api.js";
import { $, $$ } from "./core/dom.js";
import { errorMessage, toast } from "./core/ui.js";
import { overview } from "./pages/overview.js";
import { projects } from "./pages/projects.js";
import { taxonomy } from "./pages/taxonomy.js";
import { skillsPage } from "./pages/skills.js";
import { careerPage } from "./pages/career.js";
import { messages } from "./pages/messages.js";
import { profilePage } from "./pages/profile.js";
import { security } from "./pages/security.js";

const view = $("#view");

const ROUTES = [
  [/^\/?$/, () => overview(view)],
  [/^\/projects(?:\/(new|\d+))?$/, (m) => projects(view, m[1])],
  [/^\/taxonomy(?:\/(categories|technologies))?(?:\/(new|\d+))?$/, (m) => taxonomy(view, m[1], m[2])],
  [/^\/skills(?:\/(skills|categories))?(?:\/(new|\d+))?$/, (m) => skillsPage(view, m[1], m[2])],
  [/^\/career(?:\/(experiences|educations|certifications|achievements))?(?:\/(new|\d+))?$/, (m) => careerPage(view, m[1], m[2])],
  [/^\/messages(?:\/(\d+))?$/, (m) => messages(view, m[1])],
  [/^\/profile(?:\/(links))?(?:\/(new|\d+))?$/, (m) => profilePage(view, m[1], m[2])],
  [/^\/security$/, () => security(view)],
];

function route() {
  const path = (window.location.hash.slice(1) || "/").split("?")[0];
  const section = `#/${path.split("/")[1] || ""}`;
  $$("[data-sidebar] a").forEach((link) => {
    const href = link.getAttribute("href");
    link.setAttribute("aria-current", (href === "#/" ? section === "#/" : section === href) ? "page" : "false");
  });
  for (const [pattern, handler] of ROUTES) {
    const match = path.match(pattern);
    if (match) {
      Promise.resolve(handler(match)).catch((error) => toast(errorMessage(error), "error"));
      view.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      return;
    }
  }
  window.location.hash = "#/";
}

export async function refreshUnread() {
  try {
    const data = await api.get("/admin/messages/?status=new&page_size=1");
    const badge = $("[data-unread]");
    badge.textContent = String(data.count);
    badge.hidden = data.count === 0;
  } catch {
    /* indicateur non bloquant */
  }
}

async function init() {
  try {
    await api.get("/auth/me/"); // vérifie la session avant tout affichage
  } catch {
    window.location.assign(`${prefix}connexion/`);
    return;
  }
  $("[data-logout]").addEventListener("click", async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      window.location.assign(`${prefix}connexion/`);
    }
  });
  window.addEventListener("hashchange", route);
  route();
  refreshUnread();
}

init();
