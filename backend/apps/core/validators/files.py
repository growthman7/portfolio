"""
Contrôles des fichiers téléversés.

On ne fait jamais confiance au nom, à l'extension ni au type MIME annoncés par le client :
chaque fichier est vérifié sur son contenu réel (signature, décodage complet par Pillow).
"""
from __future__ import annotations

import warnings

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp"}
PDF_SIGNATURE = b"%PDF-"
# Marqueurs de contenus actifs refusés dans un CV (JavaScript, actions automatiques, fichiers embarqués).
PDF_FORBIDDEN_MARKERS = (b"/JavaScript", b"/JS", b"/OpenAction", b"/AA", b"/Launch", b"/EmbeddedFile", b"/RichMedia")


def _extension(name: str) -> str:
    name = (name or "").lower()
    return name[name.rfind("."):] if "." in name else ""


def validate_image_upload(upload: UploadedFile) -> Image.Image:
    limits = settings.UPLOAD_LIMITS
    if upload.size > limits["image_max_bytes"]:
        raise ValidationError("L'image dépasse la taille maximale autorisée (5 Mo).", code="too_large")
    if _extension(upload.name) not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Extension non autorisée (JPEG, PNG ou WebP uniquement).", code="extension")
    if upload.content_type not in ALLOWED_IMAGE_MIME:
        raise ValidationError("Type de fichier non autorisé.", code="mime")

    Image.MAX_IMAGE_PIXELS = limits["image_max_pixels"]
    try:
        with warnings.catch_warnings():
            # Une image au-delà de la limite de pixels est traitée comme une attaque, pas comme un avertissement.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            return _decode(upload, limits)
    except ValidationError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise ValidationError("Le fichier n'est pas une image valide.", code="invalid") from exc


def _decode(upload: UploadedFile, limits: dict) -> Image.Image:
    upload.seek(0)
    probe = Image.open(upload)
    probe.verify()  # contrôle de structure
    upload.seek(0)
    image = Image.open(upload)
    if image.format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError("Le contenu du fichier n'est pas une image autorisée.", code="format")
    if max(image.size) > limits["image_max_side"]:
        raise ValidationError("Les dimensions de l'image sont trop grandes (6000 px max).", code="dimensions")
    image.load()  # décodage complet : détecte les fichiers tronqués ou piégés
    return image


def validate_pdf_upload(upload: UploadedFile) -> bytes:
    if upload.size > settings.UPLOAD_LIMITS["pdf_max_bytes"]:
        raise ValidationError("Le PDF dépasse la taille maximale autorisée (10 Mo).", code="too_large")
    if _extension(upload.name) != ".pdf":
        raise ValidationError("Seuls les fichiers .pdf sont acceptés.", code="extension")
    if upload.content_type != "application/pdf":
        raise ValidationError("Type de fichier non autorisé.", code="mime")
    upload.seek(0)
    data = upload.read()
    if not data.startswith(PDF_SIGNATURE) or b"%%EOF" not in data[-2048:]:
        raise ValidationError("Le fichier n'est pas un PDF valide.", code="invalid")
    for marker in PDF_FORBIDDEN_MARKERS:
        if marker + b" " in data or marker + b"(" in data or marker + b"<" in data or marker + b"/" in data:
            raise ValidationError("Ce PDF contient du contenu actif (scripts ou pièces jointes) refusé.", code="active")
    return data
