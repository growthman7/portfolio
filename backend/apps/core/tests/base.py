"""Outils communs aux tests : comptes, client authentifié, fichiers de test."""
from __future__ import annotations

import io
import shutil

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from apps.accounts.services import sync_admin_group

PASSWORD = "Un-mot-de-passe-solide-2026!"


def png_bytes(size=(800, 500), color=(30, 60, 200), fmt="PNG", **save_kwargs) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, fmt, **save_kwargs)
    return buffer.getvalue()


def image_upload(name="capture.png", content_type="image/png", **kwargs) -> SimpleUploadedFile:
    fmt = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}.get(content_type, "PNG")
    return SimpleUploadedFile(name, png_bytes(fmt=fmt, **kwargs), content_type=content_type)


def pdf_bytes(extra: bytes = b"") -> bytes:
    return (
        b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n" + extra + b"\ntrailer << /Root 1 0 R >>\n%%EOF\n"
    )


class PortfolioAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        group = sync_admin_group()
        cls.admin = User.objects.create_user("admin", "admin@example.test", PASSWORD, is_staff=True)
        cls.admin.groups.add(group)
        cls.staff_not_admin = User.objects.create_user("staff", "staff@example.test", PASSWORD, is_staff=True)
        cls.regular = User.objects.create_user("visiteur", "user@example.test", PASSWORD)

    def setUp(self):
        cache.clear()  # remet à zéro les compteurs de limitation de débit
        settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(settings.MEDIA_ROOT, ignore_errors=True)

    def admin_client(self) -> APIClient:
        client = APIClient()
        client.force_login(self.admin)
        return client

    def csrf_client(self) -> APIClient:
        """Client qui applique réellement la vérification CSRF, comme un navigateur."""
        client = APIClient(enforce_csrf_checks=True)
        response = client.get("/api/v1/auth/csrf/")
        client.credentials(HTTP_X_CSRFTOKEN=response.json()["csrf_token"])
        return client
