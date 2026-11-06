"""
Gestion du fichier .env et des secrets aléatoires.

Utilisé par les paramètres (génération automatique en développement) et par la
commande `generate_secret_key` (rotation manuelle, y compris pour la production).
"""
from __future__ import annotations

import re
import secrets
from pathlib import Path

# Préfixes des valeurs d'exemple de .env.example : traitées comme absentes.
PLACEHOLDER_PREFIXES = ("change-me",)


def new_secret(nbytes: int = 64) -> str:
    """
    Secret aléatoire cryptographiquement sûr (~86 caractères pour 64 octets).

    Alphabet URL-safe (A-Z a-z 0-9 - _) : aucun caractère interprété dans un .env
    (pas de `#`, de guillemet ni de `$`, que django-environ lirait comme une référence).
    """
    return secrets.token_urlsafe(nbytes)


def is_placeholder(value: str | None) -> bool:
    return not value or value.strip().startswith(PLACEHOLDER_PREFIXES)


def write_env_value(path: Path, name: str, value: str) -> None:
    """Remplace `NAME=...` dans le fichier .env, ou l'ajoute à la fin (fichier créé si absent)."""
    line = f"{name}={value}"
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    pattern = re.compile(rf"^{re.escape(name)}=.*$", re.MULTILINE)
    if pattern.search(text):
        text = pattern.sub(lambda _: line, text, count=1)
    else:
        text = (text if not text or text.endswith("\n") else text + "\n") + line + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
