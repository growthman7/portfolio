import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export const reducedMotion = () => window.matchMedia(QUERY).matches;
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Préférence « réduire les animations » du système, mise à jour en direct. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(reducedMotion);
  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Exécute `callback` au plus une fois par image lors du défilement et du redimensionnement. */
export function useScrollFrame(callback, deps = []) {
  useEffect(() => {
    let ticking = false;
    const run = () => {
      ticking = false;
      callback();
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(run);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    run();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Position du pointeur dans la fenêtre, de -1 à 1, exposée en variables CSS (--px, --py) sur <html> :
 * la lumière d'ambiance s'en sert. Souris uniquement, une écriture par image, rien si mouvement réduit.
 */
export function usePointerField() {
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    const root = document.documentElement;
    let frame = 0;
    const onMove = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--px", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--py", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}
