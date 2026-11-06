import { useId, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n/LanguageContext.jsx";
import { useReducedMotion, useScrollFrame } from "../hooks/motion.js";
import { Chips, Icon, TitleParts } from "../components/ui.jsx";
import { safeUrl, slugify } from "../utils/format.js";

const GROUPS = ["work", "internship", "education", "certification", "achievement"];

/** Missions et technologies repliées par défaut. */
function Collapsible({ children }) {
  const { t } = useLang();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tl-toggle" type="button" aria-expanded={String(open)} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="tl-toggle__sign" aria-hidden="true">+</span>
        <span>{open ? t.career.hideMissions : t.career.showMissions}</span>
      </button>
      <div className={`tl-details${open ? " is-open" : ""}`} id={id} inert={!open}>
        <div className="tl-details__inner">{children}</div>
      </div>
    </>
  );
}

/** Normalise les quatre types d'entrées de l'API en éléments de timeline triables. */
function useEntries(career) {
  const { t, formatDate, formatRange } = useLang();
  return useMemo(() => {
    const entries = [];
    (career?.experiences || []).forEach((exp, i) => {
      const details = exp.missions?.length || exp.technologies?.length;
      entries.push({
        key: `exp-${i}`, group: exp.kind === "internship" ? "internship" : "work", sortKey: exp.end_date || "9999",
        date: formatRange(exp.start_date, exp.end_date),
        body: (
          <>
            <p className="tl-item__kind">{t.career.kinds[exp.kind] || t.career.kinds.job}</p>
            <h3 className="tl-item__title">{exp.title}</h3>
            <p className="tl-item__org">{exp.organization}{exp.location ? <span>{` · ${exp.location}`}</span> : null}</p>
            {exp.summary ? <p className="tl-item__text">{exp.summary}</p> : null}
            {details ? (
              <Collapsible>
                {exp.missions?.length ? <ul className="missions">{exp.missions.map((m, j) => <li key={j}>{m}</li>)}</ul> : null}
                <Chips items={exp.technologies} label={t.career.tech} />
              </Collapsible>
            ) : null}
          </>
        ),
      });
    });
    (career?.educations || []).forEach((edu, i) => {
      entries.push({
        key: `edu-${i}`, group: "education", sortKey: edu.end_date || edu.start_date || "9999",
        date: formatRange(edu.start_date, edu.end_date, { year: true }),
        body: (
          <>
            <p className="tl-item__kind">{t.career.groups.education}</p>
            <h3 className="tl-item__title">{edu.degree}</h3>
            <p className="tl-item__org">{edu.institution}{edu.field ? <span>{` · ${edu.field}`}</span> : null}</p>
            {edu.description ? <p className="tl-item__text">{edu.description}</p> : null}
            {edu.is_degree ? <span className="chip tl-item__badge">{t.career.degree}</span> : null}
          </>
        ),
      });
    });
    (career?.certifications || []).forEach((cert, i) => {
      const link = safeUrl(cert.credential_url);
      entries.push({
        key: `cert-${i}`, group: "certification", sortKey: cert.issued_on || "0000", date: formatDate(cert.issued_on),
        body: (
          <>
            <p className="tl-item__kind">{t.career.groups.certification}</p>
            <h3 className="tl-item__title">{cert.name}</h3>
            <p className="tl-item__org">{cert.issuer}{cert.expires_on ? <span>{` · ${t.career.expires} ${formatDate(cert.expires_on)}`}</span> : null}</p>
            {link ? <a className="tl-item__link" href={link} target="_blank" rel="noopener noreferrer">{t.career.verify} ↗</a> : null}
          </>
        ),
      });
    });
    (career?.achievements || []).forEach((ach, i) => {
      const link = safeUrl(ach.url);
      entries.push({
        key: `ach-${i}`, group: "achievement", sortKey: ach.date || "0000", date: formatDate(ach.date, { year: true }),
        body: (
          <>
            <p className="tl-item__kind">{t.career.groups.achievement}</p>
            <h3 className="tl-item__title">{ach.title}</h3>
            {ach.description ? <p className="tl-item__text">{ach.description}</p> : null}
            {link ? <a className="tl-item__link" href={link} target="_blank" rel="noopener noreferrer">{t.career.more} ↗</a> : null}
          </>
        ),
      });
    });
    // Du plus récent au plus ancien ; « 9999 » = en cours.
    return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [career, t, formatDate, formatRange]);
}

/**
 * Parcours : expériences, stages, formations, certifications et réalisations sur une même timeline,
 * filtrables par type ; le filet se remplit au fil du défilement.
 */
export function Career({ career, profile, status }) {
  const { t, routes } = useLang();
  const reduced = useReducedMotion();
  const entries = useEntries(career);
  const [group, setGroup] = useState("all");
  const listRef = useRef(null);
  const fillRef = useRef(null);
  const cvUrl = safeUrl(profile?.cv?.url);
  const cvAltUrl = safeUrl(profile?.cv_alt?.url);
  const baseName = slugify(`cv-${profile?.first_name || ""}-${profile?.last_name || ""}`);

  const visible = group === "all" ? entries : entries.filter((entry) => entry.group === group);
  const counts = Object.fromEntries(GROUPS.map((g) => [g, entries.filter((e) => e.group === g).length]));
  const options = [["all", t.career.all, entries.length], ...GROUPS.filter((g) => counts[g]).map((g) => [g, t.career.groups[g], counts[g]])];

  useScrollFrame(() => {
    const list = listRef.current;
    if (!list || !fillRef.current) return;
    const items = list.querySelectorAll(".tl-item");
    if (reduced) {
      fillRef.current.style.transform = "scaleY(1)";
      items.forEach((el) => el.classList.add("is-passed"));
      return;
    }
    const rect = list.getBoundingClientRect();
    const anchor = window.innerHeight * 0.6;
    fillRef.current.style.transform = `scaleY(${Math.min(1, Math.max(0, (anchor - rect.top) / Math.max(1, rect.height)))})`;
    items.forEach((el) => el.classList.toggle("is-passed", el.getBoundingClientRect().top + 30 < anchor));
  }, [reduced, group, entries]);

  // Années intercalaires (« en cours » pour les entrées sans date de fin).
  const rows = [];
  let lastYear = null;
  for (const entry of visible) {
    const year = entry.sortKey === "9999" ? t.career.today : entry.sortKey.slice(0, 4);
    if (year && year !== "0000" && year !== lastYear) {
      rows.push(<li className="tl-year" aria-hidden="true" key={`y-${year}`}>{year}</li>);
      lastYear = year;
    }
    rows.push(<li className="tl-item" data-reveal="" key={entry.key}><p className="tl-item__date">{entry.date}</p>{entry.body}</li>);
  }

  return (
    <section className="section" id={routes.sections.career} data-track aria-labelledby="t-career">
      <div className="container">
        <p className="section__label mono">03 — {t.career.label}</p>
        <div className="career__head">
          <h2 className="section__title" id="t-career" data-reveal=""><TitleParts parts={t.career.title} /></h2>
          <div className="career__downloads">
            {cvUrl ? (
              <a className="btn" href={cvUrl} download={`${baseName}.pdf`}>{t.career.cv} <Icon name="download" /></a>
            ) : (
              <a className="btn" href={`#${routes.sections.career}`} aria-disabled="true" title={t.cvMissing}>{t.career.cv} <Icon name="download" /></a>
            )}
            {cvAltUrl ? (
              <a className="btn" href={cvAltUrl} download={`${slugify(`${baseName}-${profile.cv_alt.label || "2"}`)}.pdf`}>
                {`${profile.cv_alt.label || t.career.cvAlt} (PDF)`} <Icon name="download" />
              </a>
            ) : null}
          </div>
        </div>
        {status === "ready" && !entries.length ? (
          <p className="pending mono career__empty">{t.career.empty}</p>
        ) : (
          <>
            <div className="career__toolbar" role="group" aria-label={t.career.filters}>
              {entries.length ? options.map(([value, label, count]) => (
                <button className="filter" type="button" key={value} aria-pressed={String(group === value)} onClick={() => setGroup(value)}>
                  {label}<span className="filter__count">{count}</span>
                </button>
              )) : null}
            </div>
            <ol className="timeline" role="list" aria-live="polite" ref={listRef}>
              <li className="timeline__rail" aria-hidden="true"><div className="timeline__fill" ref={fillRef} /></li>
              {rows}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
