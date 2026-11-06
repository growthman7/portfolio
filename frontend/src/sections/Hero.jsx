import { useEffect, useState } from "react";
import { useLang } from "../i18n/LanguageContext.jsx";
import { useReducedMotion, wait } from "../hooks/motion.js";
import { Icon, Picture } from "../components/ui.jsx";
import { safeUrl, slugify } from "../utils/format.js";

const COMMAND = "whoami";

/** Frappe de la commande de l'invite, rejouée à chaque visite (instantanée si mouvement réduit). */
function useTyped(reduced) {
  const [typed, setTyped] = useState(reduced ? COMMAND : "");
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (reduced) { setTyped(COMMAND); setDone(true); return undefined; }
    let cancelled = false;
    (async () => {
      await wait(350);
      for (let i = 1; i <= COMMAND.length && !cancelled; i += 1) {
        setTyped(COMMAND.slice(0, i));
        await wait(85 + Math.round(Math.random() * 40) - 20); // léger aléa : rythme de frappe naturel
      }
      await wait(220);
      if (!cancelled) setDone(true);
    })();
    return () => { cancelled = true; };
  }, [reduced]);
  return [typed, done];
}

/** Nom découpé en mots pour l'apparition progressive (le texte reste lisible pour les lecteurs d'écran). */
function Words({ text, offset }) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  return words.map((word, i) => (
    <span key={i}>
      <span className="word" style={{ transitionDelay: `${(offset + i) * 110}ms` }}>{word}</span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}

/**
 * Hero : la frappe de « whoami » et le chargement des données se déroulent en parallèle,
 * puis la réponse s'affiche, le nom apparaît mot par mot et le reste du hero suit.
 */
export function Hero({ profile, status }) {
  const { t, routes } = useLang();
  const reduced = useReducedMotion();
  const [typed, typingDone] = useTyped(reduced);
  const settled = status !== "loading";
  const [stage, setStage] = useState(0); // 0 : frappe, 1 : réponse affichée, 2 : tout est affiché

  useEffect(() => {
    if (!typingDone || !settled) return undefined;
    if (reduced) { setStage(2); return undefined; }
    setStage(1);
    const timer = setTimeout(() => setStage(2), 260);
    return () => clearTimeout(timer);
  }, [typingDone, settled, reduced]);

  const p = profile || {};
  const title = p.job_title || t.hero.defaultTitle;
  const whoami = [p.job_title, p.location].filter(Boolean).join(" · ") || title;
  const cvUrl = safeUrl(p.cv?.url);
  const firstWords = (p.first_name || "").trim().split(/\s+/).filter(Boolean).length;
  const s = routes.sections;

  // Éléments qui entrent en scène l'un après l'autre (après la réponse du terminal).
  let order = 0;
  const enter = (className = "") => {
    const index = order++;
    return {
      "data-enter": "",
      className: `${className}${stage === 2 ? " is-on" : ""}`.trim(),
      style: reduced ? undefined : { transitionDelay: `${index * 90}ms` },
    };
  };

  return (
    <section className="hero" id={s.home} data-track aria-labelledby="hero-name">
      <div className="container hero__grid">
        <div className="hero__text">
          <div className={`terminal${stage >= 1 ? " is-done" : ""}`}>
            <div className="terminal__dots" aria-hidden="true"><span /><span /><span /></div>
            <p className="terminal__line">
              <span className="terminal__user">{t.hero.prompt}</span><span className="terminal__path">:~$ </span>
              <span aria-hidden="true">{typed}</span><span className="cursor cursor--prompt" aria-hidden="true" />
              <span className="visually-hidden">{COMMAND}</span>
            </p>
            <p className={`terminal__line terminal__out${stage >= 1 ? " is-on" : ""}`} data-enter="">
              <span>{whoami}</span><span className="cursor" aria-hidden="true" />
            </p>
          </div>

          <h1 id="hero-name" {...enter("hero__name")}>
            <span className="hero__first"><Words text={p.first_name} offset={0} /></span>
            <span className="hero__last"><Words text={p.last_name} offset={firstWords} /></span>
          </h1>
          <p {...enter("hero__title")}>{title}</p>
          <p {...enter("hero__bio")}>{p.short_bio}</p>
          <ul {...enter("hero__expertise chips")} role="list" aria-label={t.hero.expertise}>
            {(p.expertise || []).map((item) => <li className="chip" key={item}>{item}</li>)}
          </ul>
          <div {...enter("hero__actions")}>
            <a className="btn btn--primary" href={`#${s.projects}`}>{t.hero.cta} <Icon name="arrow-down" className="icon icon--down" /></a>
            {cvUrl ? (
              <a className="btn" href={cvUrl} download={`${slugify(`cv-${p.first_name}-${p.last_name}`)}.pdf`}>{t.hero.cv} <Icon name="download" /></a>
            ) : (
              <a className="btn" href={`#${s.career}`} aria-disabled="true" title={t.cvMissing}>{t.hero.cv} <Icon name="download" /></a>
            )}
            <a className="cmd-link" href={`#${s.contact}`}>./contact <span className="arrow" aria-hidden="true">→</span></a>
          </div>
        </div>

        <figure {...enter("hero__portrait")}>
          <div className="hero__frame">
            {p.photo ? (
              <Picture image={p.photo} sizes="(min-width: 900px) 420px, 300px" eager highPriority alt={p.photo.alt || `${p.first_name} ${p.last_name}`} />
            ) : (
              <>
                <div className="hero__placeholder" aria-hidden="true">
                  <svg viewBox="0 0 200 220" fill="none" strokeWidth="1.5"><circle cx="100" cy="70" r="42" /><path d="M20 220c6-56 40-88 80-88s74 32 80 88" /></svg>
                </div>
                <span className="hero__badge mono">{t.hero.photoTodo}</span>
              </>
            )}
          </div>
          <figcaption className="hero__caption mono"><span>// <span>{p.location || t.hero.photoCaption}</span></span><span aria-hidden="true">↘</span></figcaption>
        </figure>
      </div>
      <a className="hero__scroll mono" href={`#${s.about}`}><span>{t.hero.scroll}</span><span className="hero__scroll-line" aria-hidden="true" /></a>
    </section>
  );
}

