"""Anti-spam et notification des messages de contact."""
from __future__ import annotations

import logging
import time

from django.conf import settings
from django.core import signing
from django.core.mail import EmailMessage

from .models import ContactMessage

logger = logging.getLogger("portfolio.security")
_SALT = "portfolio.contact.form"


def issue_form_token() -> str:
    """Jeton signé contenant l'heure d'affichage du formulaire."""
    return signing.dumps({"t": int(time.time())}, salt=_SALT, compress=True)


def check_form_token(token: str) -> bool:
    """Refuse les envois trop rapides (robots) ou trop tardifs, et les jetons falsifiés."""
    try:
        data = signing.loads(token or "", salt=_SALT, max_age=settings.CONTACT_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return False
    elapsed = time.time() - int(data.get("t", 0))
    return elapsed >= settings.CONTACT_MIN_FILL_SECONDS


def notify_owner(message: ContactMessage) -> None:
    """E-mail en texte brut au propriétaire. Les champs d'en-tête sont mono-lignes (validés en amont)."""
    if not settings.CONTACT_NOTIFY_EMAIL:
        return
    body = (
        f"Nouveau message reçu depuis le portfolio.\n\n"
        f"Nom : {message.name}\nE-mail : {message.email}\nObjet : {message.subject}\n"
        f"Langue : {message.language}\n\n{message.message}\n\n"
        f"— Consultez le tableau de bord : {settings.SITE_URL}/{settings.DASHBOARD_PREFIX}/messages/{message.pk}"
    )
    email = EmailMessage(
        subject=f"[Portfolio] {message.subject}"[:150],
        body=body,
        to=[settings.CONTACT_NOTIFY_EMAIL],
        reply_to=[message.email],
    )
    try:
        email.send(fail_silently=False)
    except Exception:  # l'envoi d'e-mail ne doit jamais faire échouer l'enregistrement du message
        logger.exception("contact_notification_failed message_id=%s", message.pk)
