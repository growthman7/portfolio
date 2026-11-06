/** Pied de page : nom, signature, réseaux et année courante. */
import { $, h, safeUrl } from "../core/dom.js";
import { t } from "../core/i18n.js";

export function renderFooter(profile) {
  $("[data-year]").textContent = String(new Date().getFullYear());
  if (!profile) return;
  $("[data-footer-first]").textContent = profile.first_name;
  $("[data-footer-last]").textContent = profile.last_name;
  $("[data-footer-owner]").textContent = `${profile.first_name} ${profile.last_name}`;
  if (profile.signature) $("[data-footer-signature]").textContent = profile.signature;
  const links = (profile.social_links || []).map((link) => [safeUrl(link.url), link.label]).filter(([url]) => url);
  $("[data-footer-social]").replaceChildren(...links.map(([url, label]) => h("li", {}, h("a", { href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": `${label} (${t.openNewTab})`, text: `${label} ↗` }))));
}
