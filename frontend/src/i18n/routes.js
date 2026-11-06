/**
 * Adresses publiques du site, identiques à celles générées par le backend
 * (apps/core/services/seo.py) : ne pas les modifier d'un seul côté.
 */
export const ROUTES = {
  fr: {
    home: "/",
    project: (slug) => `/projets/${encodeURIComponent(slug)}/`,
    legal: "/mentions-legales.html",
    privacy: "/confidentialite.html",
    sections: { home: "accueil", about: "a-propos", skills: "competences", career: "parcours", projects: "projets", contact: "contact" },
  },
  en: {
    home: "/en/",
    project: (slug) => `/en/projects/${encodeURIComponent(slug)}/`,
    legal: "/en/legal-notice.html",
    privacy: "/en/privacy.html",
    sections: { home: "home", about: "about", skills: "skills", career: "background", projects: "projects", contact: "contact" },
  },
};

/** Page équivalente dans l'autre langue (sélecteur FR / EN). */
export function alternatePath(pathname, from, to) {
  if (from === to) return pathname;
  const a = ROUTES[from];
  const b = ROUTES[to];
  const project = pathname.match(from === "fr" ? /^\/projets\/([^/]+)\/?$/ : /^\/en\/projects\/([^/]+)\/?$/);
  if (project) return b.project(decodeURIComponent(project[1]));
  if (pathname === a.legal) return b.legal;
  if (pathname === a.privacy) return b.privacy;
  return b.home;
}
