import { useEffect } from "react";

/**
 * Titre et description de la page lors de la navigation côté client.
 * Au premier chargement, ces balises viennent déjà du HTML généré par le backend (SEO).
 */
export function useDocumentTitle(title, description) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}
