/**
 * Page d'administration du portfolio (React), servie sous /<DASHBOARD_PREFIX>/.
 * Toutes les données passent par l'API protégée côté serveur (session + rôle administrateur).
 */
import { useCallback, useEffect, useRef } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { api } from "./api.js";
import { AuthProvider, RequireAuth, useAuth } from "./auth.jsx";
import { LoginPage, PasswordResetPage } from "./pages/AuthPages.jsx";
import { CareerPage, SkillsPage, TaxonomyPage } from "./pages/Catalog.jsx";
import { MessagesPage } from "./pages/Messages.jsx";
import { OverviewPage } from "./pages/Overview.jsx";
import { ProfilePage } from "./pages/Profile.jsx";
import { ProjectsPage } from "./pages/Projects.jsx";
import { SecurityPage } from "./pages/Security.jsx";
import { ToastProvider, UnreadContext, useUnread, useUnreadState } from "./ui.jsx";

const NAV = [
  ["/", "Vue d'ensemble", true],
  ["/projects", "Projets"],
  ["/taxonomy", "Catégories & technologies"],
  ["/skills", "Compétences"],
  ["/career", "Parcours"],
  ["/messages", "Messages"],
  ["/profile", "Informations générales"],
  ["/security", "Sécurité"],
];

function Shell() {
  const { user, logout } = useAuth();
  const { count, refresh } = useUnread();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const main = useRef(null);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    document.title = "Administration · Portfolio";
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  const signOut = async () => {
    await logout();
    navigate("/connexion", { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand"><span aria-hidden="true" />Portfolio</div>
        <nav className="sidebar__nav" aria-label="Administration">
          {NAV.map(([to, label, end]) => (
            <NavLink key={to} className="sidebar__link" to={to} end={Boolean(end)}>
              {label}
              {to === "/messages" && count > 0 ? <span className="sidebar__badge" aria-label={`${count} non lu(s)`}>{count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          {user ? <p className="sidebar__user mono" title={user.email}>{user.username}</p> : null}
          <a className="btn btn--small btn--ghost" href="/" target="_blank" rel="noopener noreferrer">Voir le site ↗</a>
          <button className="btn btn--small" type="button" onClick={signOut}>Déconnexion</button>
        </div>
      </aside>
      <main className="main" ref={main} tabIndex={-1} aria-live="polite">
        <Outlet />
      </main>
    </div>
  );
}

function UnreadProvider({ children }) {
  const fetchCount = useCallback(async () => (await api.get("/admin/messages/?status=new&page_size=1")).count, []);
  const value = useUnreadState(fetchCount);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function AdminApp() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="connexion" element={<LoginPage />} />
          <Route path="reinitialisation" element={<PasswordResetPage />} />
          <Route path="reinitialisation/:uid/:token" element={<PasswordResetPage />} />
          <Route element={<RequireAuth><UnreadProvider><Shell /></UnreadProvider></RequireAuth>}>
            <Route index element={<OverviewPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectsPage />} />
            <Route path="taxonomy/:section?" element={<TaxonomyPage />} />
            <Route path="taxonomy/:section/:id" element={<TaxonomyPage />} />
            <Route path="skills/:section?" element={<SkillsPage />} />
            <Route path="skills/:section/:id" element={<SkillsPage />} />
            <Route path="career/:section?" element={<CareerPage />} />
            <Route path="career/:section/:id" element={<CareerPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:id" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:section" element={<ProfilePage />} />
            <Route path="profile/:section/:id" element={<ProfilePage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
