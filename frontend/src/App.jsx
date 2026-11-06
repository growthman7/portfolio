import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { SiteDataProvider } from "./api/SiteDataContext.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { ROUTES } from "./i18n/routes.js";
import { HomePage } from "./pages/HomePage.jsx";
import { ProjectPage } from "./pages/ProjectPage.jsx";
import { LegalPage, NotFoundPage, PrivacyPage } from "./pages/StaticPages.jsx";

/** La langue vient de l'adresse : « /en/… » en anglais, le reste en français. */
function LangShell({ lang }) {
  return (
    <LanguageProvider lang={lang}>
      <SiteDataProvider>
        <Outlet />
      </SiteDataProvider>
    </LanguageProvider>
  );
}

/** Anciennes adresses de l'aperçu statique (projet.html#slug) : redirigées vers les pages projet. */
function LegacyProject({ lang }) {
  const { hash } = useLocation();
  const slug = decodeURIComponent(hash.slice(1));
  return <Navigate replace to={/^[a-z0-9-]{1,120}$/.test(slug) ? ROUTES[lang].project(slug) : ROUTES[lang].home} />;
}

/**
 * Routes publiques. Elles correspondent une à une aux fichiers HTML générés par le backend
 * (apps/core/services/seo.py) pour que chaque adresse ait ses balises SEO au premier chargement.
 */
export function App() {
  return (
    <Routes>
      <Route path="/en" element={<LangShell lang="en" />}>
        <Route index element={<HomePage />} />
        <Route path="projects/:slug" element={<ProjectPage />} />
        <Route path="legal-notice.html" element={<LegalPage />} />
        <Route path="privacy.html" element={<PrivacyPage />} />
        <Route path="index.html" element={<Navigate replace to={ROUTES.en.home} />} />
        <Route path="projet.html" element={<LegacyProject lang="en" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/" element={<LangShell lang="fr" />}>
        <Route index element={<HomePage />} />
        <Route path="projets/:slug" element={<ProjectPage />} />
        <Route path="mentions-legales.html" element={<LegalPage />} />
        <Route path="confidentialite.html" element={<PrivacyPage />} />
        <Route path="index.html" element={<Navigate replace to={ROUTES.fr.home} />} />
        <Route path="projet.html" element={<LegacyProject lang="fr" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
