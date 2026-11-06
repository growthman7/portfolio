import { createContext, useContext, useEffect, useMemo } from "react";
import { ROUTES } from "./routes.js";
import { STRINGS } from "./strings.js";

const LanguageContext = createContext(null);

/** Fournit la langue de la page (déduite de l'adresse), ses textes, ses routes et ses formats de date. */
export function LanguageProvider({ lang, children }) {
  const value = useMemo(() => {
    const t = STRINGS[lang];
    const locale = lang === "en" ? "en-GB" : "fr-FR";
    const monthYear = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
    const yearOnly = new Intl.DateTimeFormat(locale, { year: "numeric" });

    /** Dates AAAA-MM-JJ de l'API, affichées selon la langue. */
    const formatDate = (value, { year = false } = {}) => {
      if (!value) return "";
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime()) ? "" : (year ? yearOnly : monthYear).format(date);
    };
    const formatRange = (start, end, options) => {
      const from = formatDate(start, options);
      const to = end ? formatDate(end, options) : t.career.present;
      return from ? `${from} — ${to}` : to;
    };
    return { lang, t, routes: ROUTES[lang], formatDate, formatRange };
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLang doit être utilisé dans <LanguageProvider>.");
  return value;
}
