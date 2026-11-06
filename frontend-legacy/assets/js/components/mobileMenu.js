/** Menu mobile plein écran : ouverture au bouton, fermeture par Échap, lien ou passage en grand écran. */
import { $ } from "../core/dom.js";

export function initMobileMenu() {
  const toggle = $("[data-menu-toggle]");
  const panel = $("[data-mobile-nav]");
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
    if (open) {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add("is-open"));
      $("a", panel)?.focus({ preventScroll: true });
    } else {
      panel.classList.remove("is-open");
      setTimeout(() => { if (toggle.getAttribute("aria-expanded") === "false") panel.hidden = true; }, 420);
    }
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  panel.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 960px)").addEventListener("change", (mq) => { if (mq.matches) setOpen(false); });
}
