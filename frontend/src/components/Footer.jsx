import { Link } from "react-router";
import { useSiteData } from "../api/SiteDataContext.jsx";
import { useLang } from "../i18n/LanguageContext.jsx";
import { phoneLinks, safeUrl } from "../utils/format.js";
import { SectionLink } from "./Header.jsx";

/** Pied de page : nom, signature, navigation, réseaux et mentions. */
export function Footer({ onHome }) {
  const { t, routes } = useLang();
  const { site } = useSiteData();
  const profile = site?.profile;
  const first = profile?.first_name || "";
  const last = profile?.last_name || "";
  const links = (profile?.social_links || []).map((link) => ({ ...link, url: safeUrl(link.url) })).filter((link) => link.url);
  const phone = phoneLinks(profile?.phone);
  const items = t.nav.items.map(([key, label]) => ({ id: routes.sections[key], label: label.charAt(0).toUpperCase() + label.slice(1) }));

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <p className="footer__name"><span>{first}</span> <em>{last}</em></p>
            {profile?.signature ? <p className="footer__signature">{profile.signature}</p> : null}
          </div>
          <div className="footer__cols">
            <nav aria-label={t.nav.footer}>
              <p className="footer__title mono">navigation</p>
              <ul className="footer__list" role="list">
                {items.map((item) => (
                  <li key={item.id}><SectionLink id={item.id} onHome={onHome}>{item.label}</SectionLink></li>
                ))}
              </ul>
            </nav>
            {profile?.email || phone ? (
              <div>
                <p className="footer__title mono">{t.footer.contact}</p>
                <ul className="footer__list" role="list">
                  {profile.email ? <li><a href={`mailto:${profile.email}`}>{profile.email}</a></li> : null}
                  {phone ? <li><a href={phone.tel} aria-label={`${t.form.call} ${profile.phone}`}>{profile.phone}</a></li> : null}
                </ul>
              </div>
            ) : null}
            {links.length ? (
              <div>
                <p className="footer__title mono">{t.footer.networks}</p>
                <ul className="footer__list" role="list">
                  {links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.label} (${t.openNewTab})`}>{link.label} ↗</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} {`${first} ${last}`.trim()}{t.footer.rights}</p>
          <p className="footer__legal">
            <Link to={routes.legal}>{t.footer.legal}</Link>
            <Link to={routes.privacy}>{t.footer.privacy}</Link>
            <SectionLink id={routes.sections.home} onHome={onHome}>{t.footer.top}</SectionLink>
          </p>
        </div>
      </div>
    </footer>
  );
}
