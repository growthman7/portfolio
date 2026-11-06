/**
 * Création d'éléments sans innerHTML : les textes passent toujours par textContent,
 * ce qui neutralise toute injection de HTML provenant des données.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
export const SPRITE = new URL("../../icons/sprite.svg", import.meta.url).href;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function icon(name, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `${SPRITE}#${name}`);
  svg.append(use);
  return svg;
}

/** N'accepte que des liens http(s) : bloque javascript:, data:, etc. */
export function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Image responsive (AVIF puis WebP) à partir de la réponse de l'API. */
export function picture(image, { sizes = "100vw", eager = false, alt } = {}) {
  if (!image?.src) return null;
  const pic = h("picture");
  if (image.sources?.avif) pic.append(h("source", { type: "image/avif", srcset: image.sources.avif.srcset, sizes }));
  if (image.sources?.webp) pic.append(h("source", { type: "image/webp", srcset: image.sources.webp.srcset, sizes }));
  pic.append(h("img", { src: image.src, alt: alt ?? image.alt ?? "", width: image.width, height: image.height, loading: eager ? "eager" : "lazy", decoding: "async" }));
  return pic;
}
