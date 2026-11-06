"""
Traitement sécurisé des fichiers téléversés.

- validation du contenu réel (voir validators/files.py) ;
- ré-encodage des images (WebP, et AVIF si Pillow le supporte), suppression des métadonnées EXIF ;
- génération de déclinaisons responsives ;
- nom de fichier = UUID, dossier choisi par le serveur dans une liste fermée ;
- écriture via le stockage Django, qui refuse tout chemin sortant de MEDIA_ROOT.
"""
from __future__ import annotations

import io
import logging
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from PIL import Image, ImageOps, features

from ..models import MediaAsset
from ..validators.files import validate_image_upload, validate_pdf_upload

logger = logging.getLogger("portfolio.security")

ALLOWED_FOLDERS = {"projects", "profile", "og", "cv"}


def _safe_original_name(name: str) -> str:
    return "".join(ch for ch in (name or "")[-120:] if ch.isprintable() and ch not in "/\\")


def _check_folder(folder: str) -> str:
    if folder not in ALLOWED_FOLDERS:
        raise ValueError(f"Dossier de téléversement inconnu : {folder}")
    return folder


def _formats() -> list[tuple[str, str, dict]]:
    formats = [("webp", "WEBP", {"quality": 82, "method": 6})]
    if features.check("avif"):
        formats.append(("avif", "AVIF", {"quality": 60}))
    return formats


@transaction.atomic
def store_image(upload: UploadedFile, folder: str) -> MediaAsset:
    folder = _check_folder(folder)
    image = validate_image_upload(upload)

    image = ImageOps.exif_transpose(image)  # applique l'orientation puis l'EXIF est abandonné
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

    stem = uuid.uuid4().hex
    width, height = image.size
    widths = sorted({w for w in settings.IMAGE_WIDTHS if w < width} | {min(width, max(settings.IMAGE_WIDTHS))})
    files: dict[str, dict[str, str]] = {}
    written: list[str] = []
    total = 0
    try:
        for ext, pil_format, options in _formats():
            files[ext] = {}
            for target in widths:
                if target < width:
                    ratio = target / width
                    resized = image.resize((target, max(1, round(height * ratio))), Image.Resampling.LANCZOS)
                else:
                    resized = image
                buffer = io.BytesIO()
                resized.save(buffer, pil_format, **options)  # aucune métadonnée n'est recopiée
                name = default_storage.save(f"public/{folder}/{stem}-{target}.{ext}", ContentFile(buffer.getvalue()))
                written.append(name)
                files[ext][str(target)] = name
                total += buffer.tell()
    except Exception:
        for name in written:
            default_storage.delete(name)
        raise

    return MediaAsset.objects.create(
        kind=MediaAsset.Kind.IMAGE,
        folder=folder,
        files=files,
        width=width,
        height=height,
        size_bytes=total,
        original_name=_safe_original_name(upload.name),
    )


@transaction.atomic
def store_pdf(upload: UploadedFile, folder: str = "cv") -> MediaAsset:
    folder = _check_folder(folder)
    data = validate_pdf_upload(upload)
    name = default_storage.save(f"public/{folder}/{uuid.uuid4().hex}.pdf", ContentFile(data))
    return MediaAsset.objects.create(
        kind=MediaAsset.Kind.PDF,
        folder=folder,
        files={"pdf": name},
        size_bytes=len(data),
        original_name=_safe_original_name(upload.name),
    )


def delete_asset(asset: MediaAsset | None) -> None:
    """Supprime l'enregistrement ; les fichiers sont effacés par le signal post_delete."""
    if asset is not None and asset.pk:
        asset.delete()


def delete_asset_files(asset: MediaAsset) -> None:
    for name in asset.relative_paths():
        try:
            default_storage.delete(name)
        except OSError:  # pragma: no cover - journalisé, ne bloque pas la suppression
            logger.warning("media_delete_failed asset=%s", asset.pk)


def asset_payload(asset: MediaAsset | None, request=None) -> dict | None:
    """Représentation JSON d'un fichier, avec srcset pour les images."""
    if asset is None:
        return None

    def url(name: str) -> str:
        return default_storage.url(name)

    if asset.kind == MediaAsset.Kind.PDF:
        return {"id": str(asset.id), "kind": "pdf", "url": url(asset.files["pdf"]), "size": asset.size_bytes}

    sources = {}
    for ext, variants in asset.files.items():
        ordered = sorted(variants.items(), key=lambda item: int(item[0]))
        sources[ext] = {
            "srcset": ", ".join(f"{url(path)} {w}w" for w, path in ordered),
            "src": url(ordered[-1][1]),
        }
    fallback = sources.get("webp") or next(iter(sources.values()))
    return {
        "id": str(asset.id),
        "kind": "image",
        "src": fallback["src"],
        "srcset": fallback["srcset"],
        "sources": sources,
        "width": asset.width,
        "height": asset.height,
    }


def ensure_valid(callable_, *args):
    """Convertit une ValidationError Django en dictionnaire d'erreurs DRF."""
    from rest_framework.exceptions import ValidationError as DRFValidationError

    try:
        return callable_(*args)
    except ValidationError as exc:
        raise DRFValidationError({"file": exc.messages}) from exc
