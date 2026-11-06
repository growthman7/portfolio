# Sécurité

Ce document décrit les menaces prises en compte et les protections mises en œuvre, leur emplacement dans le code et la façon dont elles sont vérifiées. Référentiels : **OWASP Top 10:2025** et **OWASP API Security Top 10 (2023)**.

## Modèle de menaces (résumé)

| Actif | Menaces principales | Protections clés |
|---|---|---|
| Compte administrateur | Force brute, vol de session, CSRF, fixation de session | Argon2id, django-axes, limitation de débit, cookies `HttpOnly`/`Secure`/`SameSite`, rotation de session, CSRF |
| Contenu du portfolio | Modification non autorisée, XSS stockée | Permissions serveur par modèle, serializers stricts, rendu DOM sans `innerHTML`, CSP stricte |
| Serveur | Téléversement malveillant, traversée de répertoires, déni de service | Validation du contenu réel, ré-encodage, noms UUID, médias non exécutables, quotas de taille et de débit |
| Visiteurs | Liens dangereux, fuite de données du formulaire | URL https publiques uniquement, `rel="noopener noreferrer"`, IP pseudonymisée, aucun traceur |
| Base de données | Injection SQL, abus de privilèges | ORM uniquement, rôle applicatif sans droit sur le schéma, réseau interne |

## OWASP Top 10:2025

| Risque | Mesures | Où |
|---|---|---|
| **A01 Contrôle d'accès défaillant** | Refus par défaut (`IsAuthenticated`), rôle `IsPortfolioAdmin` + `DjangoModelPermissions` (y compris lecture) sur chaque route admin ; querysets publics filtrés sur `is_published` ; la page d'administration React ne contient aucune donnée et chaque écran vérifie la session via `auth/me/` (le serveur reste seul juge) ; liste blanche d'IP optionnelle | `apps/core/permissions.py`, `apps/core/viewsets.py`, `apps/accounts/views.py`, `apps/core/middleware/admin_guard.py` |
| **A02 Mauvaise configuration** | Paramètres séparés dev/prod/test ; `DEBUG=False` ; démarrage refusé si la clé secrète est faible ; `check --deploy` sans alerte ; Django Admin non installé ; fichiers cachés refusés par Nginx | `config/settings/`, `deploy/nginx/portfolio.conf` |
| **A03 Chaîne d'approvisionnement** | Dépendances minimales et encadrées, verrouillage avec empreintes documenté, `pip-audit` en CI, aucune ressource tierce côté navigateur | `backend/requirements/`, `.github/workflows/ci.yml` |
| **A04 Défaillances cryptographiques** | HTTPS imposé + HSTS ; Argon2id ; secrets hors dépôt ; IP stockées en HMAC-SHA256 salé ; sauvegardes chiffrées AES-256 | `config/settings/prod.py`, `apps/core/net.py`, `deploy/scripts/backup_db.sh` |
| **A05 Injection** | ORM exclusivement (aucun SQL brut) ; validation de type et de longueur ; caractères de contrôle refusés ; en-têtes d'e-mail mono-lignes ; XSS : `textContent` uniquement, CSP sans `unsafe-inline`, JSON-LD échappé | `apps/core/validators/`, `frontend/assets/js/core/dom.js`, `apps/core/services/seo.py` |
| **A06 Conception non sécurisée** | Pas d'inscription publique ; création de l'administrateur en ligne de commande ; limites métier (12 images par projet, 20 missions, 5 Mo par image, 10 Mo par PDF) | `apps/accounts/management/commands/create_portfolio_admin.py`, `config/settings/base.py` |
| **A07 Échecs d'authentification** | Verrouillage après 5 échecs (identifiant + IP, 15 min) ; 10 tentatives/min/IP ; messages identiques (pas d'énumération) ; politique de mot de passe ; réinitialisation à usage unique (30 min) ; sessions invalidées après changement | `apps/accounts/views.py`, `config/settings/base.py` |
| **A08 Intégrité des données** | CSRF sur toute écriture (y compris anonyme : connexion, contact, réinitialisation) ; fichiers ré-encodés ; transactions atomiques | `apps/core/viewsets.py` (`EnforceCSRFMixin`), `apps/core/services/uploads.py` |
| **A09 Journalisation et alertes** | Journal d'audit (connexions, échecs, verrouillages, créations, modifications, suppressions, téléversements, spam) ; journal des requêtes sensibles ; filtre masquant mots de passe, jetons et cookies | `apps/audit/`, `apps/core/middleware/request_logging.py`, `apps/core/logging.py` |
| **A10 Conditions exceptionnelles** | Gestionnaire d'erreurs unique : message neutre + identifiant corrélé aux journaux, aucune trace en production ; refus par défaut en cas d'échec ; l'échec d'envoi d'e-mail n'interrompt pas l'enregistrement | `apps/core/exceptions.py`, `config/urls.py` |

## OWASP API Security Top 10 (2023)

| Risque | Mesures |
|---|---|
| API1 BOLA | Aucune ressource privée sur l'API publique ; les objets non publiés renvoient 404. |
| API2 Authentification | Sessions serveur uniquement (pas de Basic Auth ni de jetons longue durée). |
| API3 Propriétés d'objet | Serializers publics et d'administration séparés, champs listés explicitement ; contenu d'un message de contact non modifiable. |
| API4 Consommation de ressources | Limitation par portée (public, contact, connexion, réinitialisation, téléversement) en Django **et** en Nginx ; pagination plafonnée à 50 ; tailles de corps et de fichiers bornées. |
| API5 Fonctions d'administration | Toutes sous `/api/v1/admin/`, avec rôle et permission par action. |
| API6 Flux métier sensibles | Formulaire de contact : jeton horodaté signé, champ piège, délai minimal, double quota horaire/journalier. |
| API7 SSRF | Le serveur ne télécharge aucune URL fournie ; les liens sont seulement validés (https, hôte public, sans identifiants) puis affichés. |
| API8 Mauvaise configuration | En-têtes de sécurité, `nosniff` sur l'API, pas de CORS, `Cache-Control: no-store` sur l'administration. |
| API9 Inventaire | API versionnée (`/api/v1/`), endpoints documentés dans `docs/api.md`. |
| API10 Consommation d'API tierces | Aucune API tierce consommée. |

## Détails par exigence du cahier des charges

- **Injections SQL** : ORM Django (requêtes paramétrées) ; aucun `raw()` ni `cursor.execute` avec données utilisateur ; rôle applicatif PostgreSQL limité à `SELECT/INSERT/UPDATE/DELETE` (vérifié : `DROP`, `ALTER`, `CREATE` refusés).
- **XSS** : aucune utilisation de `innerHTML` ni de `dangerouslySetInnerHTML` dans le site ni dans l'administration (React échappe tout le texte) ; aucun HTML utilisateur n'est autorisé (donc rien à assainir) ; CSP `script-src 'self'; style-src 'self'` sans exception ; aucun attribut `style` ni script en ligne.
- **CSRF** : jetons Django vérifiés côté serveur ; cookies `SameSite=Lax` ; contrôle de l'en-tête `Origin` par Django en HTTPS ; `CSRF_TRUSTED_ORIGINS` explicite.
- **Cookies** : session `HttpOnly`, `Secure`, `SameSite=Lax`, 8 h glissantes, expirée à la fermeture du navigateur. Le cookie CSRF est lisible par le JavaScript (fonctionnement standard Django) mais inutile sans la session.
- **Téléversements** : extension + MIME annoncé + contenu réel (décodage complet Pillow), bombes de décompression rejetées, ré-encodage WebP/AVIF sans métadonnées, nom UUID, dossier imposé par le serveur, stockage hors code, Nginx n'accepte que `.webp`, `.avif` et `.pdf` sous `/media/`.
- **PDF** : signature, taille, extension et absence de marqueurs actifs (`/JavaScript`, `/OpenAction`, `/Launch`, `/EmbeddedFile`…). Limite connue : des marqueurs placés dans des flux compressés ne sont pas détectés ; le CV étant fourni par l'administrateur, le risque est faible.
- **Secrets** : uniquement dans `.env` (non versionné, permissions 600) ; `.env.example` sans valeur réelle ; aucune donnée sensible dans le frontend.
- **Permissions des fichiers** : conteneur non root, système de fichiers en lecture seule, `no-new-privileges`, toutes les capacités Linux retirées ; fichiers téléversés en `0640`, dossiers en `0750`.
- **Sauvegardes** : quotidiennes, chiffrées, rotation 14 jours, vérification de l'archive, procédure de restauration.

## Vérifications automatisées

`python manage.py test --settings=config.settings.test` exécute 94 tests dont la majorité porte sur la sécurité (voir README, section Tests). La CI ajoute `pip-audit`, la vérification des migrations et `check --deploy`.

## Signaler une vulnérabilité

Écrivez à **[À REMPLACER : adresse de contact sécurité]** sans divulguer publiquement le problème avant correction. Un fichier `/.well-known/security.txt` peut être ajouté au frontend avec cette adresse.
