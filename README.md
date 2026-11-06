# Portfolio Full Stack (v2)

Portfolio professionnel bilingue (FR/EN), au style minimaliste et immersif (noir, bleu #3B82F6, rouge #FF453A, touches de terminal).

| Partie | Technologies | Emplacement |
|---|---|---|
| Site public | React 19 + React Router 7, construit avec Vite 8 | `frontend/` |
| API REST | Django 5.2 LTS + Django REST Framework | `backend/` |
| Base de données | PostgreSQL 16 (psycopg 3) | — |
| Administration | Page React dédiée (pas l'admin Django), branchée sur l'API protégée | `frontend/admin.html`, servie sous `/gestion/` |

Autres caractéristiques :

- **Sécurité :** conformité OWASP Top 10:2025 et OWASP API Security Top 10. Voir [SECURITY.md](SECURITY.md).
- **Déploiement :** Docker Compose (Nginx, Gunicorn, PostgreSQL), même origine pour le site et l'API. Voir [DEPLOYMENT.md](DEPLOYMENT.md).
- **Documentation :** [docs/api.md](docs/api.md) pour l'API et [docs/database.md](docs/database.md) pour la base de données. [docs/schema.sql](docs/schema.sql) en est l'export de référence.

---

## 1. Arborescence

```
portfolio-v2/
├── frontend/                         Site public et administration (React + Vite)
│   ├── index.html                    Site public ; son bloc <!-- seo:start/end --> est rempli par le backend
│   ├── admin.html                    Page d'administration, servie pour toutes les adresses sous /<DASHBOARD_PREFIX>/
│   ├── vite.config.js                Deux entrées (site, admin) ; proxy de développement vers Django (/api, /media)
│   ├── src/
│   │   ├── admin/                    Administration : connexion, session (auth.jsx), API (api.js), formulaires, pages
│   │   ├── main.jsx, App.jsx         Point d'entrée et routes (/, /en/, /projets/:slug/, /en/projects/:slug/, pages légales, 404)
│   │   ├── api/                      client.js (API REST, CSRF, délais, erreurs) et SiteDataContext (GET /api/v1/site/)
│   │   ├── i18n/                     Textes FR/EN, routes par langue, formats de date
│   │   ├── components/               Layout, Header (menu mobile, progression), Footer, Lightbox, ui
│   │   ├── sections/                 Hero, About, Skills, Career, Projects, Contact
│   │   ├── pages/                    HomePage, ProjectPage (10 chapitres), pages légales et 404
│   │   ├── hooks/                    Apparitions au défilement, mouvement réduit, titre de page
│   │   └── styles/                   tokens, base, layout, components/, sections/, animations + main.css
│   ├── public/assets/                Polices (WOFF2, OFL), sprite d'icônes, favicon, image Open Graph
│   └── dist/                         Sortie de « npm run build » (hors Git), complétée par les pages SEO
├── backend/
│   ├── manage.py
│   ├── config/                       settings/ (base, dev, prod, test), urls.py, api_urls.py
│   ├── apps/
│   │   ├── core/                     Profil, réseaux, fichiers, statistiques admin, middlewares, permissions, limitation de débit, SEO, commandes
│   │   ├── accounts/                 Connexion, mot de passe, création contrôlée de l'administrateur
│   │   ├── projects/                 Catégories, technologies, projets, difficultés/solutions, captures
│   │   ├── skills/                   Catégories de compétences, compétences
│   │   ├── career/                   Expériences et stages, missions, formations, certifications, réalisations
│   │   ├── contact/                  Messages, anti-spam, notification par e-mail
│   │   └── audit/                    Journal d'audit
│   └── requirements/                 base.txt, dev.txt, prod.txt
├── deploy/                           docker/, nginx/, scripts/ (sauvegardes chiffrées)
├── docs/                             api.md, database.md, schema.sql
├── docker-compose.yml                PostgreSQL de développement
├── docker-compose.prod.yml           Production
└── .env.example                      Modèle de configuration (aucun secret réel)
```

## 2. Prérequis

- Python 3.12 ou 3.13.
- Node.js 20.19+ ou 22+ (npm) pour le frontend React.
- PostgreSQL 16, en local ou via `docker compose up -d db`.
- En production : Docker, Docker Compose, un nom de domaine et un serveur SMTP.

## 3. Installation locale

```bash
# 1. Dépendances
python -m venv .venv && source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r backend/requirements/dev.txt

# 2. Base de données
docker compose up -d db              # ou un PostgreSQL local

# 3. Configuration
cp .env.example .env
#   DJANGO_SECRET_KEY : python -c "import secrets; print(secrets.token_urlsafe(64))"
#   POSTGRES_DB=portfolio_v2, POSTGRES_USER=postgres, POSTGRES_PASSWORD=devpass, POSTGRES_HOST=localhost (développement)
#   SITE_URL=http://localhost:8000, TRUST_PROXY_HEADERS=false
#   (DJANGO_SECRET_KEY et IP_HASH_SALT sont générés automatiquement en développement s'ils manquent)

# 4. Schéma, cache et contenus de départ
cd backend
python manage.py migrate
python manage.py createcachetable
python manage.py seed_placeholders                                   # catégories seulement
python manage.py seed_placeholders --with-samples --publish-samples  # + exemples clairement identifiés

# 5. Compte administrateur (seule voie de création ; mot de passe saisi de façon masquée)
python manage.py create_portfolio_admin --username votre-identifiant --email vous@exemple.fr

# 6. API Django (terminal 1)
python manage.py runserver

# 7. Frontend React avec rechargement à chaud (terminal 2)
cd ../frontend
npm install
npm run dev
```

Adresses locales (développement) :

- site : http://localhost:5174/ (version anglaise : `/en/`) ;
- page projet : http://localhost:5174/projets/<slug>/ ;
- administration : http://localhost:5174/<DASHBOARD_PREFIX>/ (connexion : `/<DASHBOARD_PREFIX>/connexion`), ou sur le port 8000 après `npm run build`.

**Connexion frontend ↔ backend :** le serveur Vite sert le site et la page d'administration, et relaie `/api`, `/media` et `/static` vers Django (`http://127.0.0.1:8000`, modifiable avec `VITE_BACKEND_URL` dans `.env`). Le navigateur ne voit qu'une seule origine, comme en production derrière Nginx : cookies de session et jeton CSRF fonctionnent sans CORS. Les e-mails s'affichent dans la console.

**Tester la version de production en local :** `npm run build` dans `frontend/`, puis `python manage.py build_seo` dans `backend/`. Django sert alors `frontend/dist` sur http://localhost:8000/, comme Nginx (vraie page 404 comprise).

## 4. Contenu provisoire

Aucune information personnelle n'est inventée. Tout le contenu de départ est marqué comme provisoire :

- **Profil :** « Prénom Nom » et « [À REMPLACER] … » pour l'à propos, la vision, les centres d'intérêt, l'approche et les ambitions.
- **Projets d'exemple :** drapeau `is_sample`, badge « Exemple » et mention « il ne s'agit pas d'une réalisation réelle ». Les chapitres sont marqués « [À REMPLACER] ».
- **Parcours et compétences d'exemple :** préfixe « [EXEMPLE] » ou « [Exemple] ».
- **Pages légales :** champs « [À REMPLACER] ».

Le dashboard signale les projets d'exemple encore publiés. Remplacez-les ou dépubliez-les avant la mise en ligne.

## 5. Administration (`/gestion/`)

Page React (`frontend/src/admin/`) servie pour toutes les adresses sous `/<DASHBOARD_PREFIX>/`. Elle ne contient aucune donnée : la connexion passe par l'API `/api/v1/auth/` (session HttpOnly + jeton CSRF) et chaque écran par `/api/v1/admin/`, protégée côté serveur.

| Écran | Adresse | API |
|---|---|---|
| Connexion | `/<préfixe>/connexion` | `POST auth/login/`, `GET auth/me/`, `POST auth/logout/` |
| Mot de passe oublié | `/<préfixe>/reinitialisation[/<uid>/<token>]` | `POST auth/password/reset/`, `POST auth/password/reset/confirm/` |

| Écran | Fonctions |
|---|---|
| Vue d'ensemble | Projets publiés et brouillons, messages non lus, messages sur 30 jours, sécurité, activité récente |
| Projets | Création, modification, suppression ; publication et dépublication en un clic ; carte (titre, résumé, catégorie, technologies, liens démo/GitHub) ; chapitres de l'étude de cas en FR et EN ; difficultés et solutions ; couverture, schéma d'architecture, captures |
| Catégories & technologies | Filtres publics des projets et technologies associées |
| Compétences | Catégories du cahier des charges et compétences. Le niveau est facultatif (notions, intermédiaire, avancé, expert) |
| Parcours | Expériences et stages (missions, technologies), formations et diplômes, certifications, réalisations |
| Messages | Filtres par statut, lecture, archivage, marquage indésirable, suppression, réponse par e-mail |
| Informations générales | Identité, présentation, expertise, textes « À propos », SEO, photo, CV FR/EN (PDF), image Open Graph, réseaux |
| Sécurité | Changement de mot de passe, journal d'audit |

Les tableaux deviennent des cartes sur mobile.

Correspondance entre la page projet et les champs du dashboard :

| Chapitre | Source |
|---|---|
| 01 Contexte, 02 Problématique | Textes |
| 03 Objectifs, 04 Fonctionnalités | Une entrée par ligne |
| 05 Architecture | Texte et schéma facultatif |
| 06 Technologies | Sélection de technologies |
| 07 Captures | Galerie |
| 08 Difficultés / solutions | Liste répétable |
| 09 Résultats | Texte |
| 10 Liens | Démo et dépôt |

Un chapitre vide n'est pas affiché.

## 6. Référencement et pages projet

Le frontend React n'a qu'une page (`index.html`). Le backend s'en sert de modèle pour écrire un fichier HTML par adresse publique, chacun avec ses propres métadonnées ; React prend ensuite le relais dans le navigateur. Chaque enregistrement du profil ou d'un projet régénère automatiquement, dans `FRONTEND_BUILD_DIR` :

- l'accueil FR et EN : title, description, canonical, hreflang, Open Graph, Twitter et JSON-LD `ProfilePage` ;
- les pages légales et `404.html` (non indexées) ;
- une page par projet publié, `/projets/<slug>/` et `/en/projects/<slug>/`, avec ses propres métadonnées et un JSON-LD `CreativeWork`. Ces pages sont retirées si le projet est dépublié ;
- `sitemap.xml` (avec alternatives hreflang) et `robots.txt` (le dashboard et l'API sont exclus).

Commande manuelle : `python manage.py build_seo`.

## 7. Tests

```bash
cd backend
python manage.py test --settings=config.settings.test     # 94 tests, sur un vrai PostgreSQL
coverage run --source=apps manage.py test --settings=config.settings.test && coverage report
```

| Domaine | Ce qui est vérifié |
|---|---|
| Fonctionnel | Endpoints publics et d'administration, publication, langues avec repli sur le français, difficultés imbriquées, liens précédent/suivant (brouillons exclus), réalisations, schéma d'architecture, pages projet générées puis supprimées |
| Autorisations | Profils anonyme, standard, staff et administrateur, permissions par modèle, aucune route d'inscription |
| Injections et XSS | Charges SQL dans les filtres, contenu HTML renvoyé comme donnée JSON, échappement du SEO et du JSON-LD |
| CSRF, débit, force brute | Connexion, contact, écritures d'administration, verrouillage de compte |
| Téléversements | Script déguisé, SVG, MIME incohérent, taille et dimensions, traversée de répertoires, EXIF supprimées, PDF actifs |
| Mots de passe et configuration | Argon2id, réinitialisation à usage unique, en-têtes de sécurité, `check --deploy` |

## 8. Construction de production

```bash
cd frontend && npm ci && npm run build          # Vite : JS/CSS regroupés, minifiés, avec empreinte (dist/assets/app/)
cd ../backend
python manage.py build_frontend                 # copie frontend/dist vers FRONTEND_BUILD_DIR (ou --target <dossier>)
```

`build_frontend` publie la sortie de Vite puis génère les pages SEO (accueil, projets, pages légales, 404), le sitemap et robots.txt.

Dans l'image Docker, une étape Node construit le frontend, puis le SEO est régénéré au démarrage du conteneur.

## 9. Choix techniques

| Choix | Raison |
|---|---|
| Django 5.2 LTS | Correctifs de sécurité jusqu'en avril 2028 |
| Même origine (Nginx devant le site et l'API) | Sessions et CSRF sans CORS |
| Sessions serveur plutôt que JWT | Révocation immédiate, cookies `HttpOnly` |
| `GET /api/v1/site/` | Tout le contenu public en une requête, mis en cache 60 s |
| Champs `*_fr` / `*_en` | Pas de dépendance supplémentaire, repli automatique sur le français |
| Pages projet générées côté serveur | URL propres et métadonnées par projet, sans rendu serveur à chaque requête |
| CSP stricte (`script-src 'self'`, `style-src 'self'`) | Aucun script ni style en ligne |
| Polices auto-hébergées | Aucun appel à un service tiers |
| Images ré-encodées côté serveur (WebP/AVIF, 3 tailles) | Fichiers piégés neutralisés, métadonnées supprimées, images responsives |

## 10. Points d'attention

- **Contenu chargé par JavaScript :** le texte des sections est rendu par React à partir de l'API. Les métadonnées, elles, sont statiques et régénérées depuis la base.
- **Adresses :** les routes de `frontend/src/i18n/routes.js` et celles générées par `backend/apps/core/services/seo.py` doivent rester identiques.
- **Visuels des brouillons :** les images d'un projet non publié ont une URL aléatoire, mais ne sont pas protégées par authentification.
- **Avant la mise en ligne :**
  - remplacer chaque « [À REMPLACER] » ;
  - fournir la photo, le CV, les mentions légales et une image Open Graph ;
  - vérifier `SITE_URL`.
