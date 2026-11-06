# API REST v1

Base : `/api/v1/` — JSON uniquement, même origine que le site. Les langues se choisissent avec `?lang=fr` (défaut) ou `?lang=en` ; un texte non traduit revient automatiquement au français.

Codes d'erreur : `400` données invalides (détail par champ), `403` non authentifié ou non autorisé, `404` introuvable, `405` méthode refusée, `413` corps trop volumineux, `415` type de contenu refusé, `429` trop de requêtes (`retry_after` en secondes), `500` erreur interne (`error_id` à rapprocher des journaux).

## Public

| Méthode | Route | Description | Limite |
|---|---|---|---|
| GET | `/site/` | Tout le contenu publié en une requête : `profile`, `skills`, `career`, `categories`, `projects` | 120/min/IP |
| GET | `/profile/` | Profil, réseaux, photo (`srcset` WebP/AVIF), URL du CV | 120/min/IP |
| GET | `/skills/` | Catégories ayant au moins une compétence publiée : `{kind, name, skills: [{name, level}]}` ; `level` vide si non renseigné | 120/min/IP |
| GET | `/career/` | `experiences` (`missions` : liste de textes, `technologies` : liste de noms), `educations`, `certifications`, `achievements` | 120/min/IP |
| GET | `/categories/` | Catégories de projets utilisées | 120/min/IP |
| GET | `/projects/?category=<slug>` | Cartes des projets publiés | 120/min/IP |
| GET | `/projects/<slug>/` | Détail : `context`, `problem`, `objectives`, `features`, `architecture`, `architecture_image`, `images[{image, caption}]`, `challenges[{challenge, solution}]`, `results`, `previous` / `next` (`{slug, title}` dans l'ordre de la galerie publique) | 120/min/IP |
| GET | `/contact/token/` | Jeton horodaté signé à renvoyer avec le formulaire | 120/min/IP |
| POST | `/contact/` | `name`, `email`, `subject`, `message`, `language`, `consent`, `form_token`, `website` (champ piège, vide). CSRF requis. | 5/h et 20/j par IP |

## Authentification

| Méthode | Route | Description |
|---|---|---|
| GET | `/auth/csrf/` | Pose le cookie `pf_csrftoken` et renvoie le jeton |
| POST | `/auth/login/` | `username`, `password` — CSRF requis ; 10/min/IP ; verrouillage après 5 échecs |
| POST | `/auth/logout/` | Détruit la session |
| GET | `/auth/me/` | Administrateur connecté et ses permissions |
| POST | `/auth/password/change/` | `current_password`, `new_password` |
| POST | `/auth/password/reset/` | `email` — réponse identique que l'adresse existe ou non ; 3/h/IP |
| POST | `/auth/password/reset/confirm/` | `uid`, `token`, `new_password` — lien à usage unique, 30 min |

Toute écriture envoie l'en-tête `X-CSRFToken`.

## Administration (`/api/v1/admin/`)

Session valide **et** rôle administrateur **et** permission sur le modèle concerné. Listes paginées (`?page=`, `?page_size=` ≤ 50) sauf mention contraire.

| Ressource | Routes |
|---|---|
| Statistiques | `GET dashboard/` |
| Profil | `GET, PATCH profile/` · `POST, DELETE profile/photo/` · `POST, DELETE profile/og-image/` · `POST, DELETE profile/cv/<fr|en>/` |
| Réseaux | CRUD `social-links/` |
| Projets | CRUD `projects/` — `challenges` imbriqués (`[{challenge_fr, challenge_en, solution_fr, solution_en}]`, 12 au plus ; la liste envoyée remplace la précédente) — (`?status=published|draft`, `?category=<id>`, `?search=`) · `POST, DELETE projects/<id>/cover/` · `POST, DELETE projects/<id>/architecture-image/` · `POST projects/<id>/images/` · `PATCH, DELETE projects/<id>/images/<image_id>/` · `POST projects/reorder/` (`{"ids": [...]}`) |
| Catégories de projets | CRUD `categories/` (suppression refusée — 409 — si des projets y sont rattachés) |
| Technologies | CRUD `technologies/` |
| Compétences | CRUD `skill-categories/`, CRUD `skills/` (`?category=<id>`) |
| Parcours | CRUD `experiences/` (missions imbriquées : la liste envoyée remplace la précédente), CRUD `educations/`, CRUD `certifications/`, CRUD `achievements/` |
| Messages | `GET messages/` (`?status=new|read|archived|spam`, `?search=`) · `GET messages/<id>/` (marque comme lu) · `PATCH messages/<id>/` (`status` uniquement) · `DELETE messages/<id>/` |
| Journal | `GET audit-log/` (`?action=`) — lecture seule |

Téléversements : `multipart/form-data`, champ `file`. Images : JPEG, PNG ou WebP, 5 Mo, 6000 px maximum. CV : PDF, 10 Mo.

Champs bilingues : chaque texte traduisible existe en `<nom>_fr` et `<nom>_en` (ex. `title_fr`, `title_en`).

## Pages générées (hors API)

À chaque enregistrement du profil ou d'un projet, le backend régénère dans le dossier publié (`FRONTEND_BUILD_DIR`) :

- les métadonnées SEO de `/` et `/en/` (title, description, canonical, hreflang, Open Graph, JSON-LD `ProfilePage`) ;
- une page par projet publié : `/projets/<slug>/` et `/en/projects/<slug>/` (Open Graph, JSON-LD `CreativeWork`, `data-slug`) ; les pages des projets dépubliés ou supprimés sont retirées ;
- `sitemap.xml` (avec alternatives hreflang) et `robots.txt`.

Les pages d'accueil annoncent le format des URL projet avec `<meta name="pf-project-url">` ; sans cette balise (développement, aperçu), le frontend utilise `projet.html#<slug>`.
