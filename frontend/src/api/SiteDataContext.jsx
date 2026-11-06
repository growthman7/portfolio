import { createContext, useContext, useEffect, useState } from "react";
import { useLang } from "../i18n/LanguageContext.jsx";
import { api } from "./client.js";

const SiteDataContext = createContext(null);

/**
 * Charge une fois par langue GET /api/v1/site/ (profil, compétences, parcours, catégories, projets)
 * et le partage entre l'en-tête, les sections de l'accueil, les pages projet et le pied de page.
 * status : "loading" | "ready" | "error".
 */
export function SiteDataProvider({ children }) {
  const { lang } = useLang();
  const [state, setState] = useState({ lang, status: "loading", site: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, lang, status: "loading", error: null }));
    api.site(lang, controller.signal)
      .then((site) => setState({ lang, status: "ready", site, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("Contenu indisponible :", error.message);
        setState({ lang, status: "error", site: null, error });
      });
    return () => controller.abort();
  }, [lang]);

  return <SiteDataContext.Provider value={state}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const value = useContext(SiteDataContext);
  if (!value) throw new Error("useSiteData doit être utilisé dans <SiteDataProvider>.");
  return value;
}
