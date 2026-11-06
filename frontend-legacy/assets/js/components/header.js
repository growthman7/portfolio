/**
 * En-tête : état au défilement, barre de progression, lien actif et indicateur de section.
 * Chaque page déclare ses repères avec [data-track] (sections de l'accueil, chapitres d'un projet).
 * Les calculs liés au défilement sont regroupés dans une seule boucle requestAnimationFrame.
 */
import { $, $$ } from "../core/dom.js";
import { reducedMotion } from "../utils/motion.js";

const listeners = new Set();

/** Permet à une page d'être prévenue du repère courant (ex. sommaire d'un projet). */
export function onSectionChange(callback) {
  listeners.add(callback);
}

export function initHeader() {
  const header = $("[data-header]");
  const bar = $("[data-progress]");
  const indicator = $("[data-section-indicator]");
  const halo = $("[data-parallax]");
  let ticking = false;
  let current = -1;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, y / max))})`;
    header.classList.toggle("is-scrolled", y > 16);
    if (halo && !reducedMotion()) halo.style.transform = `translate3d(0, ${y * Number(halo.dataset.parallax)}px, 0)`;

    // Repère courant : le dernier dont le haut a dépassé 45 % de la fenêtre (recalculé car le contenu est dynamique).
    const tracks = $$("[data-track]:not([hidden])");
    let index = 0;
    tracks.forEach((el, i) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.45) index = i; });
    if (index !== current || indicator.dataset.total !== String(tracks.length)) {
      current = index;
      const total = Math.max(0, tracks.length - 1);
      indicator.dataset.total = String(tracks.length);
      indicator.textContent = `[${String(index).padStart(2, "0")}/${String(total).padStart(2, "0")}]`;
      const id = tracks[index]?.id;
      $$("[data-nav]").forEach((link) => link.setAttribute("aria-current", String(link.getAttribute("href") === `#${id}`)));
      listeners.forEach((callback) => callback(id));
    }
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
  return onScroll;
}
