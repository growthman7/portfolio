import { useLang } from "../i18n/LanguageContext.jsx";
import { TitleParts } from "../components/ui.jsx";

const LEVELS = ["notions", "intermediate", "advanced", "expert"];
const CODES = {
  frontend: "fe/", backend: "be/", fullstack: "fs/", databases: "db/", systems: "sys/",
  devops: "ops/", data: "data/", security: "sec/", tools: "tools/", other: "misc/",
};

function Bars({ rank }) {
  return (
    <span className="level__bars" aria-hidden="true">
      {LEVELS.map((level, i) => <i key={level} className={i <= rank ? "on" : undefined} />)}
    </span>
  );
}

/** Niveau facultatif sur quatre paliers ; rien n'est affiché si aucun niveau n'est renseigné. */
function LevelMeter({ level }) {
  const { t } = useLang();
  const rank = LEVELS.indexOf(level);
  if (rank < 0) return null;
  return <span className="level"><Bars rank={rank} /><span className="level__label mono">{t.levels[level]}</span></span>;
}

/** Section Compétences : domaines et compétences publiés. */
export function Skills({ categories, status }) {
  const { t, routes } = useLang();
  const visible = (categories || []).filter((category) => category.skills?.length);
  const hasLevels = visible.some((category) => category.skills.some((skill) => LEVELS.includes(skill.level)));

  return (
    <section className="section" id={routes.sections.skills} data-track aria-labelledby="t-skills">
      <div className="container">
        <p className="section__label mono">02 — {t.skills.label}</p>
        <div className="skills__head">
          <h2 className="section__title" id="t-skills" data-reveal=""><TitleParts parts={t.skills.title} /></h2>
          {hasLevels ? (
            <ul className="skills__legend mono" role="list" aria-label={t.skills.legend}>
              {LEVELS.map((level, rank) => (
                <li className="skills__legend-item" key={level}><Bars rank={rank} />{t.levels[level]}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {status === "ready" && !visible.length ? (
          <p className="pending mono">{t.skills.empty}</p>
        ) : (
          <div className="skills__grid" aria-live="polite">
            {visible.map((category, index) => (
              <article className="skill-panel" key={category.kind + category.name}>
                {/* L'animation porte sur le contenu, pas sur le panneau : le fond de la grille ne transparaît jamais. */}
                <div className="skill-panel__inner" data-reveal="" style={{ transitionDelay: `${(index % 3) * 80}ms` }}>
                  <header className="skill-panel__head">
                    <h3 className="skill-panel__name">{category.name}</h3>
                    <span className="skill-panel__code mono">{CODES[category.kind] || CODES.other}</span>
                  </header>
                  <ul className="skill-list" role="list">
                    {category.skills.map((skill) => (
                      <li className="skill" key={skill.name}>
                        <span className="skill__name">{skill.name}</span>
                        <LevelMeter level={skill.level} />
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
