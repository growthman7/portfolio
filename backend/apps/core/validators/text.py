"""Validateurs de texte : refus des caractères de contrôle et des retours à la ligne là où ils n'ont pas leur place."""
import re

from django.core.exceptions import ValidationError

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_LINE_BREAKS = re.compile(r"[\r\n  ]")


def validate_no_control_chars(value: str) -> None:
    if value and _CONTROL_CHARS.search(value):
        raise ValidationError("Le texte contient des caractères de contrôle non autorisés.", code="control_chars")


def validate_single_line(value: str) -> None:
    """Empêche notamment l'injection d'en-têtes dans les e-mails."""
    validate_no_control_chars(value)
    if value and _LINE_BREAKS.search(value):
        raise ValidationError("Ce champ doit tenir sur une seule ligne.", code="multiline")
