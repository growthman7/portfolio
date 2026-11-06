import { useSiteData } from "../api/SiteDataContext.jsx";
import { Layout } from "../components/Layout.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLang } from "../i18n/LanguageContext.jsx";
import { About } from "../sections/About.jsx";
import { Career } from "../sections/Career.jsx";
import { Contact } from "../sections/Contact.jsx";
import { Hero } from "../sections/Hero.jsx";
import { Projects } from "../sections/Projects.jsx";
import { Skills } from "../sections/Skills.jsx";

/** Accueil : hero, À propos, Compétences, Parcours, Projets, Contact — alimentés par GET /api/v1/site/. */
export function HomePage() {
  const { t } = useLang();
  const { site, status } = useSiteData();
  const profile = site?.profile;
  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";
  useDocumentTitle(name ? `${name} — ${profile.job_title || t.hero.defaultTitle}` : null, profile?.short_bio);

  return (
    <Layout onHome>
      {status === "error" ? <p className="container form-status form-status--error" role="alert">{t.loadError}</p> : null}
      <Hero profile={profile} status={status} />
      <About profile={profile} />
      <Skills categories={site?.skills} status={status} />
      <Career career={site?.career} profile={profile} status={status} />
      <Projects projects={site?.projects} categories={site?.categories} status={status} />
      <Contact profile={profile} />
    </Layout>
  );
}
