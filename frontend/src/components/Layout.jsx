import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useSiteData } from "../api/SiteDataContext.jsx";
import { useLang } from "../i18n/LanguageContext.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { slugify } from "../utils/format.js";
import { Footer } from "./Footer.jsx";
import { Header } from "./Header.jsx";

/**
 * Au changement de page : défilement vers l'ancre demandée (#projets…) ou retour en haut.
 * L'ancre est visée de nouveau une fois les données chargées, car la hauteur des sections change.
 */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  const { status } = useSiteData();
  const toAnchor = () => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: "instant", block: "start" });
  useEffect(() => {
    if (hash) toAnchor();
    else window.scrollTo({ top: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash]);
  useEffect(() => {
    if (hash && status === "ready") requestAnimationFrame(toAnchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}

/** Gabarit complet (accueil, pages projet) : en-tête, contenu, pied de page. */
export function Layout({ onHome = false, brandName, highlight, onSectionChange, contentKey, children, mainProps }) {
  const { site, status } = useSiteData();
  const profile = site?.profile;
  useReveal();
  useScrollOnNavigate();
  const name = brandName ?? (profile ? slugify(`${profile.first_name}-${profile.last_name}`) : "portfolio");

  return (
    <>
      <Header onHome={onHome} brandName={name || "portfolio"} location={profile?.location} highlight={highlight} onSectionChange={onSectionChange} contentKey={`${status}:${contentKey ?? ""}`} />
      <main id="main" {...mainProps}>{children}</main>
      <Footer onHome={onHome} />
    </>
  );
}

/** Gabarit sobre (mentions légales, confidentialité, 404) : en-tête réduit, sans navigation. */
export function SimpleLayout({ brand, children }) {
  const { t, routes } = useLang();
  useScrollOnNavigate();
  return (
    <>
      <div className="backdrop" aria-hidden="true"><div className="backdrop__halo" /><div className="backdrop__grain" /></div>
      <header className="site-header is-scrolled">
        <div className="container site-header__inner">
          <Link className="brand" to={routes.home}><span className="brand__path">~/</span><span className="brand__name">{brand ?? t.back}</span></Link>
        </div>
      </header>
      <main className="container legal" id="main">{children}</main>
    </>
  );
}
