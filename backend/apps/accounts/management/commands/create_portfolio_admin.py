"""
Création contrôlée du compte administrateur.

Seule voie de création d'un administrateur : exécutée sur le serveur par une personne
ayant déjà accès à la machine. Le mot de passe est saisi de façon masquée (ou lu depuis
une variable d'environnement en déploiement automatisé) et doit respecter la politique
de mots de passe.
"""
import getpass
import os

from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction

from apps.accounts.services import sync_admin_group
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = "Crée le compte administrateur du portfolio (refusé si un administrateur existe déjà)."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True)
        parser.add_argument("--email", required=True)
        parser.add_argument(
            "--password-env",
            help="Nom d'une variable d'environnement contenant le mot de passe (déploiement automatisé).",
        )
        parser.add_argument(
            "--allow-additional",
            action="store_true",
            help="Autorise la création d'un administrateur supplémentaire.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        group = sync_admin_group()
        if group.user_set.exists() and not options["allow_additional"]:
            raise CommandError("Un administrateur existe déjà. Utilisez --allow-additional si c'est volontaire.")

        username = options["username"].strip()
        email = options["email"].strip().lower()
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("Adresse e-mail invalide.") from exc
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError("Ce nom d'utilisateur est déjà utilisé.")

        if options.get("password_env"):
            password = os.environ.get(options["password_env"], "")
            if not password:
                raise CommandError(f"La variable {options['password_env']} est vide ou absente.")
        else:
            password = getpass.getpass("Mot de passe : ")
            if password != getpass.getpass("Confirmation : "):
                raise CommandError("Les mots de passe ne correspondent pas.")

        candidate = User(username=username, email=email)
        try:
            password_validation.validate_password(password, candidate)
        except ValidationError as exc:
            raise CommandError("Mot de passe refusé : " + " ".join(exc.messages)) from exc

        with transaction.atomic():
            user = User.objects.create_user(username=username, email=email, password=password, is_staff=True)
            user.groups.add(group)
            AuditLog.objects.create(actor=user, action=AuditLog.Action.ADMIN_CREATED, metadata={"via": "cli"})

        self.stdout.write(self.style.SUCCESS(f"Administrateur « {username} » créé."))
