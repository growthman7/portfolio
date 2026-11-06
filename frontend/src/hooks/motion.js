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
