"""
Génère des secrets aléatoires (clé Django, sel des IP, phrase de sauvegarde).

    python manage.py generate_secret_key                 # affiche une nouvelle DJANGO_SECRET_KEY
    python manage.py generate_secret_key --all           # affiche les trois secrets
    python manage.py generate_secret_key --all --write   # les écrit dans le .env (rotation)

Attention : changer DJANGO_SECRET_KEY déconnecte toutes les sessions et invalide les liens
de réinitialisation en cours ; changer IP_HASH_SALT rend les anciennes empreintes d'IP
incomparables aux nouvelles.
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

from config.envfile import new_secret, write_env_value

SECRETS = ("DJANGO_SECRET_KEY", "IP_HASH_SALT", "BACKUP_PASSPHRASE")


class Command(BaseCommand):
    help = "Génère des secrets aléatoires et, en option, les écrit dans le fichier .env."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Génère aussi IP_HASH_SALT et BACKUP_PASSPHRASE.")
        parser.add_argument("--write", action="store_true", help=f"Écrit les valeurs dans {settings.ENV_FILE}.")

    def handle(self, *args, **options):
        names = SECRETS if options["all"] else SECRETS[:1]
        for name in names:
            value = new_secret()
            if options["write"]:
                write_env_value(settings.ENV_FILE, name, value)
                self.stdout.write(self.style.SUCCESS(f"{name} écrit dans {settings.ENV_FILE}"))
            else:
                self.stdout.write(f"{name}={value}")
        if options["write"]:
            self.stdout.write("Redémarrez le serveur pour appliquer les nouvelles valeurs.")
