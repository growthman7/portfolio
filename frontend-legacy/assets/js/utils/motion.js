const query = window.matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => query.matches;
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
