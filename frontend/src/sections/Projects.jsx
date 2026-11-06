import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useLang } from "../i18n/LanguageContext.jsx";
import { Icon, Picture, PlaceholderShot, TitleParts } from "../components/ui.jsx";
import { hostOf, safeUrl } from "../utils/format.js";

/** Halo qui suit le pointeur sur la capture (variables CSS --mx / --my). */
function trackPointer(event) {
  const media = event.currentTarget;
  const rect = media.getBoundingClientRect();
  media.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  media.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

function ProjectCard({ project, featured, animate }) {
  const { t, routes, formatDate } = useLang();
  const href = routes.project(project.slug);
  const demo = safeUrl(project.demo_url);
  const repo = safeUrl(project.repo_url);
  const year = formatDate(project.started_on, { year: true });
  const classes = ["project-card", featured && "project-card--featured", animate && "is-visible"].filter(Boolean).join(" ");

  return (
    <article className={classes} data-reveal="">
      <div className="project-card__frame">
        <div className="project-card__bar">
          <i /><i /><i />
          <span className="project-card__url mono">{hostOf(demo) || `${project.slug}/`}</span>
          <span className="project-card__flags">
            {project.is_sample ? <span className="flag flag--sample" title={t.projects.sampleNotice}>{t.projects.sample}</span> : null}
            {featured ? <span className="flag flag--featured">{t.projects.featured}</span> : null}
          </span>
        </div>
        <div className="project-card__media" onPointerMove={trackPointer}>
          {project.cover ? (
            <Picture image={project.cover} sizes={featured ? "(min-width: 1024px) 1200px, 100vw" : "(min-width: 760px) 50vw, 100vw"} alt={project.cover.alt || ""} />
          ) : <PlaceholderShot />}
        </div>
      </div>
      <div className="project-card__body">
        <p className="project-card__meta mono"><span>{project.category?.name || ""}</span>{year ? <span>{year}</span> : null}</p>
        <h3 className="project-card__title"><Link to={href}>{project.title}</Link></h3>
        <p className="project-card__summary">{project.summary}</p>
        {project.technologies?.length ? (
          <ul className="chips" role="list" aria-label={t.projects.stack}>
            {project.technologies.map((tech) => <li className="chip" key={tech.slug}>{tech.name}</li>)}
          </ul>
        ) : null}
        <div className="project-card__actions">
          <Link className="project-card__details" to={href} aria-label={`${t.projects.details} : ${project.title}`}>
            {t.projects.details}<span aria-hidden="true">→</span>
          </Link>
          {demo ? (
            <a className="ext-link" href={demo} target="_blank" rel="noopener noreferrer" aria-label={`${t.projects.demo} : ${project.title} (${t.openNewTab})`}>
              {t.projects.demo}<Icon name="arrow" />
            </a>
          ) : null}
          {repo ? (
            <a className="ext-link" href={repo} target="_blank" rel="noopener noreferrer" aria-label={`GitHub : ${project.title} (${t.openNewTab})`}>
              GitHub<Icon name="arrow" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Galerie de projets : filtre par catégorie et par technologie (combinés), lien vers la page de détail. */
export function Projects({ projects: all, categories, status }) {
  const { t, routes } = useLang();
  const projects = all || [];
  const [category, setCategory] = useState("all");
  const [tech, setTech] = useState("all");
  const [animate, setAnimate] = useState(false);

  // Technologies réellement utilisées, triées par nombre de projets puis par nom.
  const techs = useMemo(() => {
    const use = new Map();
    projects.forEach((p) => (p.technologies || []).forEach((item) => {
      const entry = use.get(item.slug) || { ...item, n: 0 };
      entry.n += 1;
      use.set(item.slug, entry);
    }));
    return [...use.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [projects]);

  const filters = [
    ["all", t.projects.all, projects.length],
    ...(categories || [])
      .map((c) => [c.slug, c.name, projects.filter((p) => p.category?.slug === c.slug).length])
      .filter(([, , n]) => n > 0),
  ];
  const visible = projects.filter((p) =>
    (category === "all" || p.category?.slug === category) &&
    (tech === "all" || (p.technologies || []).some((item) => item.slug === tech)));
  const filtered = category !== "all" || tech !== "all";

  const choose = (setter) => (value) => { setter(value); setAnimate(true); };
  const resetAll = () => { setCategory("all"); setTech("all"); setAnimate(true); };

  return (
    <section className="section" id={routes.sections.projects} data-track aria-labelledby="t-projects">
      <div className="container">
        <p className="section__label mono">04 — {t.projects.label}</p>
        <h2 className="section__title" id="t-projects" data-reveal=""><TitleParts parts={t.projects.title} /></h2>

        {projects.length ? (
          <div className="projects__toolbar">
            <div className="projects__row">
              <div className="projects__cats" role="group" aria-label={t.projects.byCategory}>
                {filters.map(([value, label, n]) => (
                  <button className="filter" type="button" key={value} aria-pressed={String(category === value)} onClick={() => choose(setCategory)(value)}>
                    {label}<span className="filter__count">{n}</span>
                  </button>
                ))}
              </div>
              <div className="projects__tools">
                <label className="tech-select mono" htmlFor="filter-tech">
                  {t.projects.tech}{" "}
                  <select id="filter-tech" value={tech} onChange={(event) => choose(setTech)(event.target.value)}>
                    <option value="all">{t.projects.allTech}</option>
                    {techs.map((item) => <option value={item.slug} key={item.slug}>{`${item.name} (${item.n})`}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="projects__row">
              <p className="projects__count mono" aria-live="polite">{t.projects.count(visible.length)}</p>
              <button className="projects__reset" type="button" hidden={!filtered} onClick={resetAll}>{t.projects.reset}</button>
            </div>
          </div>
        ) : null}

        <div className={`project-grid${animate ? " is-switching" : ""}`}>
          {status === "ready" && !projects.length ? <p className="projects__empty">{t.projects.none}</p> : null}
          {projects.length && !visible.length ? (
            <div className="projects__empty" role="status">
              <p>{t.projects.noMatch}</p>
              <button className="projects__reset" type="button" onClick={resetAll}>{t.projects.reset}</button>
            </div>
          ) : null}
          {visible.map((project, i) => (
            <ProjectCard key={`${category}-${tech}-${project.slug}`} project={project} featured={!filtered && i === 0 && project.is_featured} animate={animate} />
          ))}
        </div>
      </div>
    </section>
  );
}
