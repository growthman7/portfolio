"""
Publie le frontend React construit par Vite :
- copie `frontend/dist/` (produit par `npm run build`) vers le dossier de publication ;
- génère une page HTML par adresse publique avec ses métadonnées SEO, plus sitemap.xml et robots.txt
  (voir apps/core/services/seo.py).

    cd frontend && npm ci && npm run build
    cd backend && python manage.py build_frontend [--source ../frontend/dist] [--target /srv/frontend-build]

Le regroupement, la minification et l'empreinte des fichiers JS/CSS sont faits par Vite.
"""
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Publie le frontend React construit (frontend/dist) et génère les pages SEO."

    def add_arguments(self, parser):
        parser.add_argument("--source", default=str(settings.FRONTEND_DIR), help="Sortie de « npm run build ».")
        parser.add_argument("--target", default=str(settings.FRONTEND_BUILD_DIR), help="Dossier publié (lu par Nginx).")
        parser.add_argument("--skip-seo", action="store_true", help="Ne pas interroger la base (construction d'image Docker).")

    def handle(self, *args, **options):
        source, target = Path(options["source"]).resolve(), Path(options["target"]).resolve()
        if not (source / "index.html").is_file() or not (source / "assets").is_dir():
            raise CommandError(f"{source} ne contient pas de frontend construit. Lancez d'abord « npm run build » dans frontend/.")
        if source != target:
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(source, target, ignore=shutil.ignore_patterns("*.map", ".DS_Store"))
        self.stdout.write(self.style.SUCCESS(f"Frontend publié dans {target}."))

        if not options["skip_seo"]:
            from apps.core.services.seo import regenerate

            written = regenerate(target)
            self.stdout.write(f"Pages SEO générées : {len(written)} fichiers (dont sitemap.xml et robots.txt).")
