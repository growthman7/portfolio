from pathlib import Path

from django.core.management.base import BaseCommand

from apps.core.services.seo import regenerate


class Command(BaseCommand):
    help = "Régénère les métadonnées SEO (title, Open Graph, Schema.org), sitemap.xml et robots.txt du frontend."

    def add_arguments(self, parser):
        parser.add_argument("--target", help="Dossier du frontend publié (défaut : FRONTEND_BUILD_DIR).")

    def handle(self, *args, **options):
        written = regenerate(Path(options["target"]) if options.get("target") else None)
        self.stdout.write(self.style.SUCCESS("Fichiers mis à jour : " + ", ".join(written)))
