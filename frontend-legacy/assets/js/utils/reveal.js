/** Apparitions au défilement via Intersection Observer. */
import { reducedMotion } from "./motion.js";

let observer;

export function reveal(root = document) {
  const elements = [...root.querySelectorAll("[data-reveal]:not(.is-visible)")];
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  observer ??= new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }),
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
  );
  elements.forEach((el) => observer.observe(el));
}
