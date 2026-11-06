/** Composants d'interface communs de l'administration. */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

/* ---------- Notifications ---------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const toast = useCallback((message, type = "success") => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), type === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`toast toast--${t.type}`} role={t.type === "error" ? "alert" : "status"}>{t.message}</p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------- Mise en page ---------- */

export function PageHead({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-actions">{children}</div>
    </header>
  );
}

export function Loading({ full = false }) {
  return <p className={`loading${full ? " loading--full" : ""}`}>Chargement…</p>;
}

export function ErrorAlert({ children }) {
  return <p className="alert alert--error" role="alert">{children}</p>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/** Onglets de navigation : [[chemin, libellé], …] ; `current` = chemin actif. */
export function Tabs({ items, current }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([to, label]) => (
        <Link key={to} className="tab" role="tab" to={to} aria-selected={String(to === current)}>{label}</Link>
      ))}
    </div>
  );
}

export function Badge({ on = false, kind, children }) {
  return <span className={`badge${on ? " badge--on" : ""}${kind ? ` badge--${kind}` : ""}`}>{children}</span>;
}

export function Published({ item, on = "Publié", off = "Masqué" }) {
  return <Badge on={item.is_published}>{item.is_published ? on : off}</Badge>;
}

export function Thumb({ asset, className = "thumb", alt = "" }) {
  return asset?.src ? <img className={className} src={asset.src} alt={alt} loading="lazy" /> : <div className={className} aria-hidden="true" />;
}

/* ---------- Formats ---------- */

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
export const fmtDate = (value) => (value ? dateFormat.format(new Date(value.length === 10 ? `${value}T00:00:00` : value)) : "—");
export const fmtDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : "—");

/* ---------- Compteur de messages non lus (barre latérale) ---------- */

export const UnreadContext = createContext({ count: 0, refresh: () => {} });
export const useUnread = () => useContext(UnreadContext);

export function useUnreadState(fetchCount) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    try {
      setCount(await fetchCount());
    } catch {
      /* indicateur non bloquant */
    }
  }, [fetchCount]);
  return useMemo(() => ({ count, refresh }), [count, refresh]);
}
