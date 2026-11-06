import { useEffect, useRef } from "react";
import { useLang } from "../i18n/LanguageContext.jsx";
import { Icon, Picture } from "./ui.jsx";

/**
 * Visionneuse des captures : <dialog> natif (focus piégé, Échap pour fermer), flèches du clavier.
 * index === null : fermée. Le focus revient sur le bouton qui l'a ouverte.
 */
export function Lightbox({ images, index, onChange, onClose, opener }) {
  const { t } = useLang();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const open = index !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add("menu-open");
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const show = (i) => onChange((i + images.length) % images.length);
  const item = open ? images[index] : null;

  return (
    <dialog
      className="lightbox" aria-label={t.case.lightbox} ref={dialogRef}
      onClose={() => { document.body.classList.remove("menu-open"); onClose(); opener?.current?.focus(); }}
      onClick={(event) => { if (event.target === event.currentTarget || event.target.classList.contains("lightbox__stage")) dialogRef.current.close(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") show(index - 1);
        if (event.key === "ArrowRight") show(index + 1);
      }}
    >
      <div className="lightbox__bar mono">
        <span>{item ? t.case.imageOf(index + 1, images.length) : ""}</span>
        <button className="icon-btn" type="button" ref={closeRef} onClick={() => dialogRef.current.close()}>
          <Icon name="close" /><span className="visually-hidden">{t.case.close}</span>
        </button>
      </div>
      <div className="lightbox__stage">
        {item ? <Picture image={item.image} sizes="100vw" eager alt={item.image.alt || item.caption || ""} /> : null}
      </div>
      <div className="lightbox__foot">
        <button className="icon-btn" type="button" disabled={images.length < 2} onClick={() => show(index - 1)}>
          <Icon name="prev" /><span className="visually-hidden">{t.case.prevShot}</span>
        </button>
        <p className="lightbox__caption">{item?.caption || ""}</p>
        <button className="icon-btn" type="button" disabled={images.length < 2} onClick={() => show(index + 1)}>
          <Icon name="next" /><span className="visually-hidden">{t.case.nextShot}</span>
        </button>
      </div>
    </dialog>
  );
}
