import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useLang } from "../i18n/LanguageContext.jsx";
import { alternatePath } from "../i18n/routes.js";
import { reducedMotion, useScrollFrame } from "../hooks/motion.js";
import { pad2 } from "../utils/format.js";

/** Lien vers une section de l'accueil : ancre simple sur l'accueil, navigation React ailleurs. */
export function SectionLink({ id, onHome, className, children, ...rest }) {
  const { routes } = useLang();
  if (onHome) return <a className={className} href={`#${id}`} {...rest}>{children}</a>;
  return <Link className={className} to={{ pathname: routes.home, hash: `#${id}` }} {...rest}>{children}</Link>;
}

/**
 * En-tête : état au défilement, barre de progression, lien actif et indicateur de section.
 * Les repères sont les éléments [data-track] de la page (sections de l'accueil, chapitres d'un projet) ;
 * le repère courant est remonté via onSectionChange (ex. sommaire d'un projet).
 */
export function Header({ onHome, brandName, location: place, onSectionChange, highlight, contentKey }) {
  const { lang, t, routes } = useLang();
  const { pathname } = useLocation();
  const headerRef = useRef(null);
  const barRef = useRef(null);
  const indicatorRef = useRef(null);
  const [active, setActive] = useState(null);
  const [menu, setMenu] = useState({ open: false, mounted: false });
  const toggleRef = useRef(null);
  const panelRef = useRef(null);

  useScrollFrame(() => {
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, y / max))})`;
    headerRef.current?.classList.toggle("is-scrolled", y > 16);
    const halo = document.querySelector("[data-parallax]");
    if (halo && !reducedMotion()) halo.style.transform = `translate3d(0, ${y * Number(halo.dataset.parallax)}px, 0)`;

    // Repère courant : le dernier dont le haut a dépassé 45 % de la fenêtre (recalculé : le contenu est dynamique).
    const tracks = [...document.querySelectorAll("[data-track]:not([hidden])")];
    let index = 0;
    tracks.forEach((el, i) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.45) index = i; });
    if (indicatorRef.current) indicatorRef.current.textContent = `[${pad2(index)}/${pad2(Math.max(0, tracks.length - 1))}]`;
    const id = tracks[index]?.id ?? null;
    setActive((previous) => (previous === id ? previous : id));
  }, [pathname, contentKey]); // recalcul quand le contenu de la page change (données chargées)

  useEffect(() => { onSectionChange?.(active); }, [active, onSectionChange]);

  // Menu mobile : ouverture animée, fermeture par Échap, par un lien ou au passage en grand écran.
  const setOpen = (open) => setMenu((m) => ({ open, mounted: open ? true : m.mounted }));
  useEffect(() => {
    document.body.classList.toggle("menu-open", menu.open);
    if (menu.open) {
      panelRef.current?.querySelector("a")?.focus({ preventScroll: true });
      return undefined;
    }
    const timer = setTimeout(() => setMenu((m) => (m.open ? m : { ...m, mounted: false })), 420);
    return () => clearTimeout(timer);
  }, [menu.open]);
  const [visible, setVisible] = useState(false); // classe is-open appliquée une image après l'affichage
  useEffect(() => {
    if (!menu.open) { setVisible(false); return undefined; }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [menu.open]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && menu.open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const query = window.matchMedia("(min-width: 960px)");
    const onWide = (mq) => { if (mq.matches) setOpen(false); };
    document.addEventListener("keydown", onKey);
    query.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      query.removeEventListener("change", onWide);
    };
  }, [menu.open]);
  useEffect(() => () => document.body.classList.remove("menu-open"), []);

  const other = lang === "fr" ? "en" : "fr";
  const switchTo = alternatePath(pathname, lang, other);
  const items = t.nav.items.map(([key, label], i) => ({ id: routes.sections[key], label, num: pad2(i + 1) }));
  const homeId = routes.sections.home;

  return (
    <>
      <a className="skip-link" href="#main">{t.skip}</a>
      <div className="progress" aria-hidden="true"><div className="progress__bar" ref={barRef} /></div>
      <div className="backdrop" aria-hidden="true"><div className="backdrop__halo" data-parallax="0.05" /><div className="backdrop__grain" /></div>

      <header className="site-header" ref={headerRef}>
        <div className="container site-header__inner">
          {onHome ? (
            <a className="brand" href={`#${homeId}`} aria-label={t.nav.backTop}>
              <span className="brand__path">~/</span><span className="brand__name">{brandName}</span><span className="brand__cursor" aria-hidden="true" />
            </a>
          ) : (
            <Link className="brand" to={routes.home} aria-label={t.nav.backHome}>
              <span className="brand__path">~/</span><span className="brand__name">{brandName}</span><span className="brand__cursor" aria-hidden="true" />
            </Link>
          )}
          <nav className="nav" aria-label={t.nav.main}>
            <ul className="nav__list" role="list">
              {items.map((item) => (
                <li key={item.id}>
                  <SectionLink id={item.id} onHome={onHome} className="nav__link" aria-current={onHome ? String(active === item.id) : (highlight === item.id ? "true" : undefined)}>
                    <span>{item.num}</span>{item.label}
                  </SectionLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="header-tools">
            <span className="section-indicator mono" ref={indicatorRef} aria-hidden="true">[00/00]</span>
            <div className="lang-switch" role="group" aria-label={t.language}>
              {["fr", "en"].map((code) => (
                <Link key={code} to={code === lang ? pathname : switchTo} hrefLang={code} lang={code} aria-current={code === lang ? "page" : undefined}>
                  {code.toUpperCase()}
                </Link>
              ))}
            </div>
            <button
              className="menu-toggle" type="button" ref={toggleRef}
              aria-expanded={String(menu.open)} aria-controls="mobile-nav"
              onClick={() => setOpen(!menu.open)}
            >
              <span className="menu-toggle__bars" aria-hidden="true" /><span className="visually-hidden">{t.menu}</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        className={`mobile-nav${visible ? " is-open" : ""}`} id="mobile-nav" aria-label={t.nav.mobile}
        hidden={!menu.mounted} ref={panelRef}
        onClick={(event) => { if (event.target.closest("a")) setOpen(false); }}
      >
        <ul className="mobile-nav__list" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <SectionLink id={item.id} onHome={onHome} className="mobile-nav__link">
                <span>{item.num}</span>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}
              </SectionLink>
            </li>
          ))}
        </ul>
        {place ? <p className="mono faint">{place}</p> : null}
      </nav>
    </>
  );
}
