import { useEffect } from "react";
import { reducedMotion } from "./motion.js";

/**
 * Apparitions au défilement : tout élément [data-reveal] reçoit la classe `is-visible`
 * en entrant dans la fenêtre. Un MutationObserver prend en charge les éléments rendus
 * plus tard par React (données chargées, filtres), sans câblage dans chaque composant.
 */
export function useReveal() {
  useEffect(() => {
    const showAll = () => document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => el.classList.add("is-visible"));
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      showAll();
      const mutations = new MutationObserver(showAll);
      mutations.observe(document.body, { childList: true, subtree: true });
      return () => mutations.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    const watched = new WeakSet();
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
      if (watched.has(el)) return;
      watched.add(el);
      observer.observe(el);
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
}
