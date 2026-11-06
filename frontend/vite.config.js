import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Deux pages construites par Vite :
 * - index.html : site public (React), complété par les pages SEO générées par Django ;
 * - admin.html : page d'administration (React), servie pour toutes les adresses sous /<DASHBOARD_PREFIX>/.
 *
 * Développement : `npm run dev` (port 5174) relaie l'API et les médias vers Django
 * (`python manage.py runserver`, port 8000). Le navigateur ne voit qu'une seule origine :
 * cookies de session et jeton CSRF fonctionnent comme en production.
 *
 * Production : `npm run build` produit `dist/`, publié par `manage.py build_frontend`.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", ""); // .env à la racine du dépôt (partagé avec Django)
  const backend = env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  const adminPrefix = `/${(env.DASHBOARD_PREFIX || "gestion").replace(/^\/|\/$/g, "")}`;
  const proxied = ["/api", "/media", "/static", "/healthz"];

  /** Sert admin.html pour /<préfixe> et /<préfixe>/… (routage côté navigateur), comme Nginx en production. */
  const rewriteAdmin = (req, _res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path === adminPrefix || path.startsWith(`${adminPrefix}/`)) req.url = "/admin.html";
    next();
  };

  return {
    plugins: [
      react(),
      {
        name: "admin-spa-fallback",
        configureServer: (server) => { server.middlewares.use(rewriteAdmin); },
        configurePreviewServer: (server) => { server.middlewares.use(rewriteAdmin); },
      },
    ],
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
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
        },
      },
    },
  };
});
