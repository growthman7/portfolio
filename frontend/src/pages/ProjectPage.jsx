import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../api/client.js";
import { Layout } from "../components/Layout.jsx";
import { Lightbox } from "../components/Lightbox.jsx";
import { Icon, Picture, PlaceholderShot } from "../components/ui.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLang } from "../i18n/LanguageContext.jsx";
import { hostOf, lines, pad2, safeUrl } from "../utils/format.js";

const SLUG = /^[a-z0-9-]{1,120}$/;

function TextBlock({ text }) {
  const parts = lines(text);
  return parts.length ? <div className="chapter__text">{parts.map((p, i) => <p key={i}>{p}</p>)}</div> : null;
}

function LinkCard({ url, label }) {
  if (!url) return null;
  const { host, pathname } = new URL(url);
  return (
    <a className="link-card" href={url} target="_blank" rel="noopener noreferrer">
      <span className="link-card__label mono">{label}</span>
      <span className="link-card__value">{host + pathname.replace(/\/$/, "")}<Icon name="arrow" /></span>
    </a>
  );
}

/** Les 10 chapitres d'une étude de cas ; un chapitre vide n'est pas affiché. */
function useChapters(p, openShot) {
  const { t } = useLang();
  const c = t.case.chapters;
  const ids = t.case.chapterIds;
  const features = lines(p.features);
  const objectives = lines(p.objectives);
  const images = (p.images || []).filter((item) => item.image?.src);
  const demo = safeUrl(p.demo_url);
  const repo = safeUrl(p.repo_url);

  return [
    ["context", lines(p.context).length && <TextBlock text={p.context} />],
    ["problem", lines(p.problem).length && <TextBlock text={p.problem} />],
    ["objectives", objectives.length && <ul className="bullets">{objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>],
    ["features", features.length && (
      <ol className="features" role="list">
        {features.map((feature, i) => (
          <li className="feature" key={i}><span className="feature__index mono">{pad2(i + 1)}</span><span className="feature__text">{feature}</span></li>
        ))}
      </ol>
    )],
    ["architecture", (p.architecture || p.architecture_image) && (
      <>
        <TextBlock text={p.architecture} />
        {p.architecture_image ? (
          <figure className="arch-figure">
            <div className="arch-figure__frame"><Picture image={p.architecture_image} sizes="(min-width: 1024px) 900px, 100vw" /></div>
            {p.architecture_image.alt ? <figcaption className="mono">{p.architecture_image.alt}</figcaption> : null}
          </figure>
        ) : null}
      </>
    )],
    ["technologies", p.technologies?.length && (
      <ul className="chips" role="list">{p.technologies.map((tech) => <li className="chip" key={tech.slug}>{tech.name}</li>)}</ul>
    )],
    ["screenshots", images.length && (
      <ul className="gallery" role="list">
        {images.map((item, i) => (
          <li className="gallery__item" key={item.image.src}>
            <button
              className="gallery__button" type="button"
              aria-label={`${t.case.enlarge} ${i + 1}${item.caption ? ` : ${item.caption}` : ""}`}
              onClick={(event) => openShot(i, event.currentTarget)}
            >
              <Picture image={item.image} sizes={i === 0 ? "(min-width: 1024px) 900px, 100vw" : "(min-width: 700px) 45vw, 100vw"} alt="" />
            </button>
            {item.caption ? <p className="gallery__caption mono">{item.caption}</p> : null}
          </li>
        ))}
      </ul>
    )],
    ["challenges", p.challenges?.length && (
      <div className="challenges">
        {p.challenges.map((pair, i) => (
          <article className="challenge" key={i}>
            <div className="challenge__part"><p className="challenge__label challenge__label--problem mono">{t.case.difficulty}</p><p>{pair.challenge}</p></div>
            <div className="challenge__part"><p className="challenge__label challenge__label--solution mono">{t.case.solution}</p><p>{pair.solution}</p></div>
          </article>
        ))}
      </div>
    )],
    ["results", lines(p.results).length && <TextBlock text={p.results} />],
    ["links", (demo || repo) && <div className="links"><LinkCard url={demo} label={t.case.liveDemo} /><LinkCard url={repo} label={t.case.repo} /></div>],
  ]
    .filter(([, body]) => Boolean(body))
    .map(([key, body]) => ({ id: ids[key], title: c[key], body }));
}

function CaseStudy({ project: p, active }) {
  const { t, routes, formatDate, formatRange } = useLang();
  const [shot, setShot] = useState(null);
  const opener = useRef(null);
  const images = (p.images || []).filter((item) => item.image?.src);
  const chapters = useChapters(p, (i, button) => { opener.current = button; setShot(i); });
  const demo = safeUrl(p.demo_url);
  const repo = safeUrl(p.repo_url);
  const year = formatDate(p.started_on, { year: true });
  const period = p.started_on ? formatRange(p.started_on, p.ended_on) : "";
  const total = pad2(chapters.length);

  return (
    <>
      <header className="case-hero container" id="intro" data-track="">
        <nav className="case-crumb mono" aria-label={t.case.breadcrumb}>
          <Link to={{ pathname: routes.home, hash: `#${routes.sections.projects}` }}><span className="accent">←</span>{t.case.back}</Link>
          <span aria-hidden="true">{`~/${t.case.folder}/${p.slug}`}</span>
        </nav>
        {p.is_sample ? <p className="case-flag"><span className="flag flag--sample">{t.projects.sampleNotice}</span></p> : null}
        <p className="case-meta mono"><span>{p.category?.name || ""}</span>{year ? <span>{year}</span> : null}{period ? <span>{period}</span> : null}</p>
        <h1 className="case-title">{p.title}</h1>
        <p className="case-summary">{p.summary}</p>
        {demo || repo ? (
          <div className="case-actions">
            {demo ? <a className="btn btn--primary" href={demo} target="_blank" rel="noopener noreferrer">{t.case.viewDemo}<Icon name="arrow" /></a> : null}
            {repo ? <a className="btn" href={repo} target="_blank" rel="noopener noreferrer"><Icon name="code" />{t.case.viewCode}</a> : null}
          </div>
        ) : null}
        <div className="case-cover project-card__frame">
          <div className="project-card__bar"><i /><i /><i /><span className="project-card__url mono">{hostOf(demo) || `${p.slug}/`}</span></div>
          <div className="project-card__media">
            {p.cover ? <Picture image={p.cover} sizes="(min-width: 1240px) 1200px, 100vw" eager highPriority alt={p.cover.alt || ""} /> : <PlaceholderShot />}
          </div>
        </div>
      </header>

      <div className="container case-body">
        <nav className="case-toc" aria-label={t.case.toc}>
          <p className="case-toc__title mono">{t.case.toc}</p>
          <ol className="case-toc__list" role="list">
            {chapters.map((chapter, i) => (
              <li key={chapter.id}>
                <a className="case-toc__link" href={`#${chapter.id}`} aria-current={String(active === chapter.id)}>
                  <span>{pad2(i + 1)}</span>{chapter.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="case-content">
          {chapters.map((chapter, i) => (
            <section className="chapter" id={chapter.id} data-track="" data-reveal="" aria-labelledby={`${chapter.id}-t`} key={chapter.id}>
              <p className="chapter__num mono">{`${pad2(i + 1)} / ${total}`}</p>
              <h2 className="chapter__title" id={`${chapter.id}-t`}>{chapter.title}</h2>
              {chapter.body}
            </section>
          ))}
        </div>
      </div>

      {p.previous || p.next ? (
        <nav className="case-nav" aria-label={t.case.otherProjects}>
          {p.previous ? (
            <Link className="case-nav__link" to={routes.project(p.previous.slug)}>
              <span className="case-nav__dir mono">{`← ${t.case.previous}`}</span><span className="case-nav__title">{p.previous.title}</span>
            </Link>
          ) : <span className="case-nav__link" aria-hidden="true" />}
          {p.next ? (
            <Link className="case-nav__link case-nav__link--next" to={routes.project(p.next.slug)}>
              <span className="case-nav__dir mono">{`${t.case.next} →`}</span><span className="case-nav__title">{p.next.title}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}

      {images.length ? <Lightbox images={images} index={shot} onChange={setShot} onClose={() => setShot(null)} opener={opener} /> : null}
    </>
  );
}

function Missing() {
  const { t, routes } = useLang();
  return (
    <div className="container case-missing">
      <p className="mono faint">404</p>
      <h1 className="case-title">{t.case.notFound}</h1>
      <p className="case-summary">{t.case.notFoundText}</p>
      <Link className="btn" to={{ pathname: routes.home, hash: `#${routes.sections.projects}` }}>{`← ${t.case.back}`}</Link>
    </div>
  );
}

/** Page de détail d'un projet : GET /api/v1/projects/<slug>/ dans la langue de la page. */
export function ProjectPage() {
  const { slug = "" } = useParams();
  const { lang, t, routes } = useLang();
  const [state, setState] = useState({ status: "loading", project: null });
  const [active, setActive] = useState(null);
  const onSectionChange = useCallback((id) => setActive(id), []);

  useEffect(() => {
    if (!SLUG.test(slug)) { setState({ status: "missing", project: null }); return undefined; }
    const controller = new AbortController();
    setState({ status: "loading", project: null });
    api.project(slug, lang, controller.signal)
      .then((project) => setState({ status: "ready", project }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status !== 404) console.warn("Projet indisponible :", error.message);
        setState({ status: "missing", project: null });
      });
    return () => controller.abort();
  }, [slug, lang]);

  const p = state.project;
  useDocumentTitle(
    state.status === "ready" ? `${p.title} — ${lang === "fr" ? "Projet" : "Project"}` : state.status === "missing" ? `${t.case.notFound} — Portfolio` : null,
    p?.summary,
  );

  return (
    <Layout brandName={`${t.case.folder}/${slug}`} highlight={routes.sections.projects} onSectionChange={onSectionChange} contentKey={`${slug}:${state.status}`}>
      {state.status === "loading" ? <p className="container case-missing mono">{t.case.loading}</p> : null}
      {state.status === "missing" ? <Missing /> : null}
      {state.status === "ready" ? <CaseStudy project={p} active={active} /> : null}
    </Layout>
  );
}
