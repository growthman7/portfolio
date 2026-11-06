/**
 * Petits composants d'affichage partagés. Toutes les données de l'API passent par JSX :
 * React échappe le texte, aucun HTML venant de la base n'est jamais interprété.
 */
import { useLang } from "../i18n/LanguageContext.jsx";

const SPRITE = "/assets/icons/sprite.svg";

export function Icon({ name, className = "icon" }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`${SPRITE}#${name}`} />
    </svg>
  );
}

/** Image responsive (AVIF puis WebP) à partir de l'objet image renvoyé par l'API. */
export function Picture({ image, sizes = "100vw", eager = false, alt, highPriority = false }) {
  if (!image?.src) return null;
  return (
    <picture>
      {image.sources?.avif && <source type="image/avif" srcSet={image.sources.avif.srcset} sizes={sizes} />}
      {image.sources?.webp && <source type="image/webp" srcSet={image.sources.webp.srcset} sizes={sizes} />}
      <img
        src={image.src}
        alt={alt ?? image.alt ?? ""}
        width={image.width}
        height={image.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={highPriority ? "high" : undefined}
      />
    </picture>
  );
}

export function Chips({ items, label, className = "chips" }) {
  if (!items?.length) return null;
  return (
    <ul className={className} role="list" aria-label={label}>
      {items.map((item, index) => (
        <li className="chip" key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

/** Titre dont la deuxième partie est en italique : ["Une boîte à outils ", "structurée"]. */
export function TitleParts({ parts }) {
  return parts.map((part, index) => (index === 1 ? <em key={index}>{part}</em> : <span key={index}>{part}</span>));
}

/** Visuel neutre affiché tant qu'un projet n'a pas de capture. */
export function PlaceholderShot() {
  const { t } = useLang();
  return (
    <div className="shot" aria-hidden="true">
      <div className="shot__lines"><i /><i /><i /></div>
      <div className="shot__panel" />
      <span className="shot__note mono">{t.projects.shotMissing}</span>
    </div>
  );
}

/** Lien externe : toujours dans un nouvel onglet, sans transmettre l'origine. */
export function ExternalLink({ href, children, ...rest }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
