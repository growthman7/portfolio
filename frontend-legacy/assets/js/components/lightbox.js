/** Visionneuse des captures : <dialog> natif, flèches du clavier, Échap pour fermer. */
import { $, picture } from "../core/dom.js";
import { t } from "../core/i18n.js";

export function createLightbox(images) {
  const dialog = $("[data-lightbox]");
  const stage = $("[data-lightbox-stage]", dialog);
  const caption = $("[data-lightbox-caption]", dialog);
  const counter = $("[data-lightbox-count]", dialog);
  const prev = $("[data-lightbox-prev]", dialog);
  const next = $("[data-lightbox-next]", dialog);
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + images.length) % images.length;
    const item = images[index];
    stage.replaceChildren(picture(item.image, { sizes: "100vw", eager: true, alt: item.image.alt || item.caption || "" }));
    caption.textContent = item.caption || "";
    counter.textContent = t.case.imageOf(index + 1, images.length);
    prev.disabled = next.disabled = images.length < 2;
  };

  prev.onclick = () => show(index - 1);
  next.onclick = () => show(index + 1);
  $("[data-lightbox-close]", dialog).onclick = () => dialog.close();
  dialog.onclick = (event) => { if (event.target === dialog || event.target === stage) dialog.close(); };
  dialog.onkeydown = (event) => {
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  };
  dialog.onclose = () => { document.body.classList.remove("menu-open"); opener?.focus(); };

  return (i, trigger) => {
    opener = trigger;
    show(i);
    dialog.showModal();
    document.body.classList.add("menu-open");
    $("[data-lightbox-close]", dialog).focus();
  };
}
