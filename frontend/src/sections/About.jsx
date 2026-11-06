import { useLang } from "../i18n/LanguageContext.jsx";
import { TitleParts } from "../components/ui.jsx";
import { lines } from "../utils/format.js";

const FACTS = ["vision", "interests", "approach", "ambitions"];

const Paragraphs = ({ text }) => lines(text).map((part, i) => <p key={i}>{part}</p>);

/** Section À propos : récit du profil, quatre repères (vision, intérêts, méthode, ambitions) et disponibilité. */
export function About({ profile }) {
  const { t, routes } = useLang();
  const p = profile || {};
  const facts = FACTS.filter((key) => p[key]);

  return (
    <section className="section" id={routes.sections.about} data-track aria-labelledby="t-about">
      <div className="container">
        <p className="section__label mono">01 — {t.about.label}</p>
        <div className="about__grid">
          <div className="about__aside">
            <h2 className="about__title" id="t-about" data-reveal=""><TitleParts parts={t.about.title} /></h2>
            <div className="about__meta mono" data-reveal="">
              <p className="about__meta-row"><span className="accent">$</span> cat {t.about.file}</p>
              <p className={`about__meta-row${p.is_available ? " about__status--on" : ""}`}>
                <span className="about__status-dot" aria-hidden="true" />
                <span>{profile ? (p.is_available ? t.about.available : t.about.unavailable) : t.about.available}</span>
              </p>
              {p.location ? <p className="about__meta-row"><span aria-hidden="true">⌖</span><span>{p.location}</span></p> : null}
            </div>
          </div>
          <div className="about__body">
            <div className="about__lead" data-reveal="">
              {p.about ? <Paragraphs text={p.about} /> : <p className="faint">{t.about.placeholder}</p>}
            </div>
            {facts.length ? (
              <dl className="about__facts">
                {facts.map((key, index) => (
                  <div className="about__fact" data-reveal="" key={key} style={{ transitionDelay: `${index * 80}ms` }}>
                    <dt className="about__key"><span>› </span>{t.about[key]}</dt>
                    <dd className="about__value"><Paragraphs text={p[key]} /></dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
