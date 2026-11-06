/**
 * Session de l'administrateur : état courant (chargement / connecté / déconnecté) et actions.
 * L'état initial vient de GET /auth/me/ ; aucune information d'accès n'est stockée dans le navigateur
 * en dehors du cookie de session HttpOnly géré par Django.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { auth, onUnauthorized } from "./api.js";
import { Loading } from "./ui.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const { user } = await auth.me();
      setState({ status: "authenticated", user });
      return user;
    } catch {
      setState({ status: "anonymous", user: null });
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    onUnauthorized(refresh);
    return () => onUnauthorized(null);
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const { user } = await auth.login(username, password);
    setState({ status: "authenticated", user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setState({ status: "anonymous", user: null });
    }
  }, []);

  const value = useMemo(() => ({ ...state, refresh, login, logout }), [state, refresh, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Protège les écrans d'administration : sans session valide, redirection vers la connexion. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading full />;
  if (status !== "authenticated") return <Navigate replace to="/connexion" state={{ from: location.pathname + location.search }} />;
  return children;
}
