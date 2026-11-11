# Déploiement en production

Deux options : **Vercel + Render** (plateformes managées, ci-dessous) ou **serveur Docker + Nginx** (sections 1 à 10).

## Option A — Frontend sur Vercel, backend sur Render

```
Navigateur ──HTTPS──▶ Vercel (une seule origine)
                      ├── /, /projets/…, /gestion/…  build React (dist/), en-têtes de sécurité (vercel.json)
                      └── /api/, /media/, /healthz/  ──proxy + en-tête secret──▶ Render : Django (Docker)
                                                                                  ├── PostgreSQL (réseau privé)
                                                                                  └── disque /srv/media
```

Le navigateur ne parle qu'à Vercel : cookies de session et CSRF restent « même origine » (aucun CORS, aucun
cookie tiers). Render refuse toute requête sans le secret `PROXY_SHARED_SECRET` (sauf `/healthz/`), ce qui
rend fiable l'IP du visiteur transmise par Vercel (limitation de débit, verrouillage, liste blanche admin).

### 1. Secrets

```bash
python -c "import secrets; [print(k + '=' + secrets.token_urlsafe(n)) for k, n in (('DJANGO_SECRET_KEY', 64), ('IP_HASH_SALT', 48), ('PROXY_SHARED_SECRET', 48))]"
```

Ne les versionnez jamais ; conservez-les dans un gestionnaire de mots de passe.

### 2. Render (backend)

1. *New → Blueprint* → dépôt `growthman7/portfolio` (branche `main`) : `render.yaml` crée la base
   `portfolio-db` (PostgreSQL 16, sans accès Internet) et le service `portfolio-api` (Docker, disque 1 Go).
2. Renseignez les variables `sync: false` :

   | Variable | Valeur |
   |---|---|
   | `DJANGO_SECRET_KEY` | Étape 1 (50 caractères minimum) |
   | `SITE_URL` | `https://<projet>.vercel.app` (ou votre domaine) |
   | `DJANGO_ALLOWED_HOSTS` | `<projet>.vercel.app` (l'hôte `*.onrender.com` est ajouté automatiquement) |
   | `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://<projet>.vercel.app` |
   | `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, `CONTACT_NOTIFY_EMAIL` | Fournisseur SMTP (TLS) |
   | `ADMIN_ALLOWED_IPS` | Facultatif (CIDR) ; laisser vide sinon |

3. Une fois déployé, `https://portfolio-api.onrender.com/healthz/` doit répondre `{"status": "ok"}` et
   `https://portfolio-api.onrender.com/api/v1/site/` doit répondre **404** (accès direct refusé).
4. Compte administrateur : *Shell* du service, puis
   `python manage.py create_portfolio_admin --username <identifiant> --email <e-mail>`.
   Sans Shell (offre gratuite) : dans *Environment*, renseignez `ADMIN_USERNAME`, `ADMIN_EMAIL` et
   `ADMIN_PASSWORD` (14 caractères minimum, non courant, différent de l'identifiant), puis redéployez.
   Le compte est créé au démarrage s'il n'existe encore aucun administrateur. Supprimez ensuite
   `ADMIN_PASSWORD`.

Offres : le Blueprint utilise les offres gratuites (`plan: free`). Limites : le service se met en veille après
15 min d'inactivité, les fichiers téléversés (photo, CV, images) sont perdus à chaque redéploiement ou
redémarrage (pas de disque persistant) et la base gratuite expire après 30 jours. Pour la production, passez à
`starter` + disque `/srv/media` et `basic-256mb` (voir les commentaires de `render.yaml`). `IP_HASH_SALT` et
`PROXY_SHARED_SECRET` sont générés par Render (`generateValue`) : recopiez le second dans Vercel. Une seule
base est fournie : migrations et application utilisent le même rôle PostgreSQL.

### 3. Vercel (frontend)

1. *Add New → Project* → dépôt `growthman7/portfolio`, **Root Directory : `frontend`** (le reste est lu dans
   `frontend/vercel.json`).
2. *Settings → Environment Variables* (Production, et Preview si besoin), puis redéployez :

   | Variable | Valeur |
   |---|---|
   | `BACKEND_URL` | `https://portfolio-api.onrender.com` (sans `/` final) |
   | `PROXY_SHARED_SECRET` | Même valeur que sur Render (variable de type *Sensitive*) |

3. Si vous ajoutez un domaine personnalisé, mettez à jour `SITE_URL`, `DJANGO_ALLOWED_HOSTS` et
   `DJANGO_CSRF_TRUSTED_ORIGINS` sur Render.
4. Le préfixe d'administration `gestion` est écrit dans `vercel.json` : modifiez-le aussi si vous changez
   `DASHBOARD_PREFIX`.

### 4. Vérifications

```bash
curl -sI https://<projet>.vercel.app/ | grep -iE "strict-transport|content-security|x-frame|x-content-type"
curl -s https://<projet>.vercel.app/healthz/                      # {"status": "ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://<projet>.vercel.app/api/v1/admin/dashboard/   # 403
```

Limite connue : les pages HTML pré-rendues pour le SEO (`build_seo`, sitemap.xml, robots.txt) ne sont pas
publiées sur Vercel ; le site fonctionne en application monopage.

## Option B — Serveur Docker + Nginx

Architecture : **Nginx** (TLS, fichiers statiques, limitation de débit) → **Gunicorn/Django** → **PostgreSQL**, orchestrés par Docker Compose. Seul Nginx est exposé ; PostgreSQL est sur un réseau Docker interne.

```
Internet ──HTTPS──▶ nginx :443 ──▶ /           frontend construit (volume, lecture seule)
                              ├──▶ /static/    fichiers du dashboard
                              ├──▶ /media/     images et CV (aucune exécution, extensions filtrées)
                              └──▶ /api/, /gestion/, /healthz/ ──▶ web:8000 (Gunicorn, utilisateur non root)
                                                                    └──▶ db:5432 (réseau interne)
```

## 1. Préparer le serveur (Ubuntu 24.04 LTS)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 ufw gnupg certbot unattended-upgrades
sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades          # mises à jour de sécurité automatiques
sudo adduser --disabled-password deploy && sudo usermod -aG docker deploy
```

Recommandé : connexion SSH par clé uniquement (`PasswordAuthentication no`, `PermitRootLogin no` dans `/etc/ssh/sshd_config`).

## 2. Récupérer le projet et configurer

```bash
sudo mkdir -p /opt/portfolio && sudo chown deploy: /opt/portfolio
cd /opt/portfolio && git clone <votre-dépôt> .
cp .env.example .env && chmod 600 .env
```

Renseignez **toutes** les valeurs de `.env` :

| Variable | À faire |
|---|---|
| `DJANGO_SECRET_KEY`, `IP_HASH_SALT` | Deux valeurs aléatoires distinctes : `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `SITE_URL` | Votre domaine (avec `https://` pour les origines et `SITE_URL`) |
| `POSTGRES_OWNER_*`, `POSTGRES_*` | Deux mots de passe forts distincts (propriétaire du schéma / rôle applicatif) |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL`, `CONTACT_NOTIFY_EMAIL` | Votre fournisseur SMTP (TLS) |
| `BACKUP_PASSPHRASE` | Phrase de chiffrement des sauvegardes, conservée **hors du serveur** |
| `ADMIN_ALLOWED_IPS` | Facultatif : restreindre `/gestion/` et l'API d'administration à vos IP |

Remplacez `votredomaine.tld` dans `deploy/nginx/portfolio.conf` (5 occurrences).

## 3. Certificat TLS (Let's Encrypt)

Premier certificat, avant de démarrer Nginx :

```bash
sudo certbot certonly --standalone -d votredomaine.tld -d www.votredomaine.tld --agree-tos -m vous@votredomaine.tld
```

Renouvellement automatique (webroot partagé avec Nginx) — ajoutez à la crontab root :

```
0 4 * * * certbot renew --quiet --webroot -w /var/lib/docker/volumes/portfolio_certbot-www/_data --deploy-hook "docker compose -f /opt/portfolio/docker-compose.prod.yml exec nginx nginx -s reload"
```

## 4. Démarrer

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps          # web doit être « healthy »
```

Au démarrage, le conteneur `web` :
1. attend PostgreSQL ;
2. applique les migrations avec le rôle **propriétaire** ;
3. crée la table de cache, les catégories de base ;
4. publie le frontend et les fichiers statiques dans les volumes lus par Nginx, puis régénère SEO, sitemap et robots ;
5. lance Gunicorn avec le rôle **applicatif** (lecture/écriture des données uniquement : il ne peut ni créer, ni modifier, ni supprimer de tables).

## 5. Créer le compte administrateur

Seule voie de création, exécutée sur le serveur (saisie masquée du mot de passe) :

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py create_portfolio_admin \
  --username votre-identifiant --email vous@votredomaine.tld
```

La commande refuse de créer un second administrateur sans `--allow-additional` et impose la politique de mots de passe (14 caractères minimum, non courant, non numérique, différent de l'identifiant).

Connectez-vous ensuite sur `https://votredomaine.tld/gestion/`, remplissez les informations générales, téléversez votre photo et vos CV, puis créez vos projets.

## 6. Vérifications après mise en ligne

```bash
curl -sI https://votredomaine.tld/ | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer"
curl -s https://votredomaine.tld/healthz/
docker compose -f docker-compose.prod.yml exec web python manage.py check --deploy
```

- Testez la configuration TLS (par exemple avec SSL Labs) et les en-têtes (securityheaders.com).
- Vérifiez que `https://votredomaine.tld/api/v1/admin/dashboard/` répond 403 sans session.
- Soumettez le sitemap (`https://votredomaine.tld/sitemap.xml`) dans la Search Console.
- Une fois le domaine et ses sous-domaines servis exclusivement en HTTPS, vous pouvez activer `DJANGO_HSTS_PRELOAD=true` et ajouter `preload` dans `deploy/nginx/security-headers.conf`.

## 7. Sauvegardes

```bash
crontab -e   # utilisateur deploy
15 3 * * * cd /opt/portfolio && ./deploy/scripts/backup_db.sh >> /home/deploy/backup.log 2>&1
```

- La base (`pg_dump`, format custom) et les médias sont chiffrés en AES-256 (GnuPG) dans `backups/`, conservés 14 jours.
- **Copiez ce dossier hors du serveur** (stockage objet, autre machine).
- Restauration : `./deploy/scripts/restore_db.sh backups/db-<date>.dump.gpg backups/media-<date>.tar.gz.gpg`. Testez-la régulièrement sur un environnement séparé.

## 8. Mises à jour

```bash
cd /opt/portfolio && git pull
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

Les migrations s'appliquent automatiquement au redémarrage. Avant une mise à jour majeure de Django, lisez les notes de version et lancez la suite de tests.

### Déploiement continu (GitHub Actions)

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) enchaîne : frontend (audit + build) → backend (ruff, pip-audit, migrations, tests ≥ 85 %, `check --deploy`) → construction de l'image Docker → **déploiement** sur le serveur via SSH (`deploy/scripts/deploy.sh`), uniquement pour un push sur `main` et si tout est vert.

Mise en place (une seule fois) :

1. Sur le serveur, en tant que `deploy` : générez une clé dédiée à la CD et autorisez-la :
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github_cd -N "" -C "github-actions-cd"
   cat ~/.ssh/github_cd.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/github_cd   # clé privée à copier dans le secret DEPLOY_SSH_KEY, puis supprimez ce fichier
   ```
   Si le dépôt est privé, le serveur doit aussi pouvoir faire `git fetch` (clé de déploiement en lecture seule dans *Settings → Deploy keys*).
2. Depuis votre poste : `ssh-keyscan -p 22 votre-serveur` → contenu du secret `DEPLOY_KNOWN_HOSTS`.
3. Dans GitHub, *Settings → Environments* : créez l'environnement `production` (ajoutez éventuellement une approbation manuelle) avec les secrets :

   | Secret | Valeur |
   |---|---|
   | `DEPLOY_HOST` | IP ou nom du serveur |
   | `DEPLOY_USER` | `deploy` |
   | `DEPLOY_PORT` | Facultatif (22 par défaut) |
   | `DEPLOY_SSH_KEY` | Clé privée de l'étape 1 |
   | `DEPLOY_KNOWN_HOSTS` | Sortie de l'étape 2 |

4. *Settings → Secrets and variables → Actions → Variables* : `DEPLOY_ENABLED=true` et `SITE_URL=https://votredomaine.tld` (vérification de `/healthz/` après déploiement).

Tant que `DEPLOY_ENABLED` n'est pas défini, seule la CI s'exécute. Le `.env` de production reste uniquement sur le serveur.

## 9. Journaux et surveillance

- `docker compose -f docker-compose.prod.yml logs -f web nginx`
- Journal applicatif en rotation : volume `logs` (`portfolio.log`, 10 × 5 Mo). Les mots de passe, jetons et cookies sont masqués.
- Journal d'audit consultable dans le dashboard (onglet Sécurité).
- Surveillez la sonde `/healthz/` avec un service de supervision externe.

## 10. Déploiement sans Docker (alternative)

1. Python 3.12, PostgreSQL 16, Nginx installés sur le serveur.
2. Créez les deux rôles PostgreSQL comme dans `deploy/docker/postgres-init/01-roles.sh`.
3. `pip install -r backend/requirements/prod.txt` dans un environnement virtuel.
4. Avec les identifiants du rôle propriétaire : `migrate`, `createcachetable`. Puis `collectstatic` et `build_frontend --target /srv/portfolio/frontend`.
5. Service systemd lançant Gunicorn (`config.wsgi:application`, `DJANGO_SETTINGS_MODULE=config.settings.prod`) avec un utilisateur système dédié et les identifiants du rôle applicatif.
6. Adaptez `deploy/nginx/portfolio.conf` : `upstream` vers `127.0.0.1:8000`, chemins `root` et `alias` vers vos dossiers.
7. Permissions : code en lecture seule pour l'utilisateur du service ; écriture limitée aux dossiers `media/`, `logs/` et au dossier du frontend publié (`chmod 750`, propriétaire dédié).
