import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Développement : `npm run dev` (port 5173) relaie l'API, les médias et le dashboard vers Django
 * (`python manage.py runserver`, port 8000). Le navigateur ne voit qu'une seule origine :
 * cookies de session et jeton CSRF fonctionnent comme en production.
 *
 * Production : `npm run build` produit `dist/`, publié par `manage.py build_frontend`
 * qui y ajoute les pages SEO générées depuis la base.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", ""); // .env à la racine du dépôt (partagé avec Django)
  const backend = env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  const dashboard = `/${(env.DASHBOARD_PREFIX || "gestion").replace(/^\/|\/$/g, "")}`;
  const proxied = ["/api", "/media", "/static", "/healthz", dashboard];

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: Object.fromEntries(proxied.map((path) => [path, { target: backend, changeOrigin: false }])),
    },
    preview: { port: 4173 },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      // Fichiers générés (nom avec empreinte) séparés des ressources fixes de public/assets.
      assetsDir: "assets/app",
      sourcemap: false,
    },
  };
});
