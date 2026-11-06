import io

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from PIL import Image

from apps.audit.models import AuditLog
from apps.core.models import MediaAsset
from apps.core.tests.base import PortfolioAPITestCase, image_upload, png_bytes
from apps.projects.models import Category, Project, Technology


class ProjectFixtures(PortfolioAPITestCase):
    def setUp(self):
        super().setUp()
        self.frontend = Category.objects.create(name_fr="Frontend", name_en="Frontend", slug="frontend")
        self.backend = Category.objects.create(name_fr="Backend", slug="backend")
        self.django = Technology.objects.create(name="Django", slug="django")
        self.published = Project.objects.create(
            title_fr="Projet publié", title_en="Published project", slug="publie", summary_fr="Résumé",
            category=self.backend, is_published=True,
        )
        self.published.technologies.add(self.django)
        self.draft = Project.objects.create(title_fr="Brouillon", slug="brouillon", summary_fr="Secret", category=self.frontend)


class PublicProjectTests(ProjectFixtures):
    def test_public_list_hides_drafts(self):
        response = self.client.get("/api/v1/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p["slug"] for p in response.json()], ["publie"])
        self.assertEqual(self.client.get("/api/v1/projects/brouillon/").status_code, 404)

    def test_language_selection_with_fallback(self):
        en = self.client.get("/api/v1/projects/publie/?lang=en").json()
        self.assertEqual(en["title"], "Published project")
        self.assertEqual(en["summary"], "Résumé")  # pas de traduction : repli sur le français
        self.assertEqual(self.client.get("/api/v1/projects/publie/?lang=zz").json()["title"], "Projet publié")

    def test_category_filter_and_sql_injection_attempt(self):
        self.assertEqual(len(self.client.get("/api/v1/projects/?category=backend").json()), 1)
        response = self.client.get("/api/v1/projects/", {"category": "x' OR '1'='1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        response = self.client.get("/api/v1/projects/", {"category": "x'; DROP TABLE projects_project; --"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("projects_project", connection.introspection.table_names())

    def test_public_endpoints_are_read_only(self):
        response = self.client.post("/api/v1/projects/", {"title_fr": "x"}, format="json")
        self.assertIn(response.status_code, (403, 405))
        self.assertEqual(self.client.delete("/api/v1/projects/publie/").status_code, 405)
        self.assertTrue(Project.objects.filter(slug="publie").exists())

    def test_public_serializer_does_not_leak_admin_fields(self):
        data = self.client.get("/api/v1/projects/publie/").json()
        for field in ("id", "is_published", "display_order", "created_at", "title_fr"):
            self.assertNotIn(field, data)

    def test_public_categories_only_list_used_ones(self):
        slugs = [c["slug"] for c in self.client.get("/api/v1/categories/").json()]
        self.assertEqual(slugs, ["backend"])


class AdminProjectTests(ProjectFixtures):
    def test_create_with_generated_slug_and_audit(self):
        client = self.admin_client()
        response = client.post(
            "/api/v1/admin/projects/",
            {"title_fr": "Mon Projet Été", "summary_fr": "Résumé", "category": self.frontend.pk,
             "technologies": [self.django.pk], "repo_url": "https://github.com/exemple/projet"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["slug"], "mon-projet-ete")
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.CREATE, target_type="projects.project").exists())

    def test_insecure_urls_are_rejected(self):
        client = self.admin_client()
        for url in ("http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "https://127.0.0.1/x",
                    "https://10.0.0.5/", "https://localhost/"):
            response = client.patch(f"/api/v1/admin/projects/{self.published.pk}/", {"demo_url": url}, format="json")
            self.assertEqual(response.status_code, 400, url)

    def test_date_order_is_validated(self):
        response = self.admin_client().patch(
            f"/api/v1/admin/projects/{self.published.pk}/",
            {"started_on": "2025-05-01", "ended_on": "2024-01-01"}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_xss_payload_is_stored_as_data_and_served_as_json(self):
        payload = '<img src=x onerror="alert(1)">'
        self.admin_client().patch(f"/api/v1/admin/projects/{self.published.pk}/", {"summary_fr": payload}, format="json")
        response = self.client.get("/api/v1/projects/publie/")
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.json()["summary"], payload)  # restitué tel quel, jamais interprété comme HTML

    def test_control_characters_rejected(self):
        response = self.admin_client().patch(
            f"/api/v1/admin/projects/{self.published.pk}/", {"context_fr": "abc\x00def"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_reorder(self):
        client = self.admin_client()
        response = client.post("/api/v1/admin/projects/reorder/", {"ids": [self.draft.pk, self.published.pk]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.draft.refresh_from_db()
        self.published.refresh_from_db()
        self.assertEqual((self.draft.display_order, self.published.display_order), (0, 1))

    def test_category_with_projects_cannot_be_deleted(self):
        response = self.admin_client().delete(f"/api/v1/admin/categories/{self.backend.pk}/")
        self.assertEqual(response.status_code, 409)


class UploadTests(ProjectFixtures):
    def _cover(self, upload):
        return self.admin_client().post(
            f"/api/v1/admin/projects/{self.published.pk}/cover/", {"file": upload}, format="multipart"
        )

    def test_valid_cover_is_reencoded_into_variants(self):
        response = self._cover(image_upload(size=(2000, 1250)))
        self.assertEqual(response.status_code, 200, response.content)
        cover = response.json()["cover"]
        self.assertIn("480w", cover["srcset"])
        self.assertIn("1600w", cover["srcset"])
        asset = MediaAsset.objects.get(pk=cover["id"])
        for path in asset.relative_paths():
            self.assertTrue(path.startswith("public/projects/"))
            self.assertTrue((settings.MEDIA_ROOT / path).exists())

    def test_exif_metadata_is_stripped(self):
        exif = Image.Exif()
        exif[0x010F] = "Fabricant-secret"
        exif[0x8825] = {1: "N"}  # bloc GPS
        upload = SimpleUploadedFile("photo.jpg", png_bytes(fmt="JPEG", exif=exif.tobytes()), content_type="image/jpeg")
        response = self._cover(upload)
        self.assertEqual(response.status_code, 200)
        asset = MediaAsset.objects.get(pk=response.json()["cover"]["id"])
        with Image.open(settings.MEDIA_ROOT / asset.files["webp"][next(iter(asset.files["webp"]))]) as stored:
            self.assertFalse(stored.getexif())
            self.assertNotIn(b"Fabricant-secret", (settings.MEDIA_ROOT / asset.relative_paths()[0]).read_bytes())

    def test_disguised_script_is_rejected(self):
        upload = SimpleUploadedFile("shell.php.jpg", b"<?php system($_GET['c']); ?>", content_type="image/jpeg")
        self.assertEqual(self._cover(upload).status_code, 400)

    def test_svg_and_unknown_extensions_are_rejected(self):
        svg = SimpleUploadedFile("logo.svg", b"<svg onload='alert(1)'/>", content_type="image/svg+xml")
        self.assertEqual(self._cover(svg).status_code, 400)
        renamed = SimpleUploadedFile("image.html", png_bytes(), content_type="image/png")
        self.assertEqual(self._cover(renamed).status_code, 400)

    def test_mime_must_match_content(self):
        upload = SimpleUploadedFile("capture.png", b"GIF89a" + b"\x00" * 100, content_type="image/png")
        self.assertEqual(self._cover(upload).status_code, 400)

    def test_oversized_and_huge_dimension_images_are_rejected(self):
        big = SimpleUploadedFile("big.png", b"\x89PNG" + b"0" * (5 * 1024 * 1024 + 10), content_type="image/png")
        self.assertEqual(self._cover(big).status_code, 400)
        buffer = io.BytesIO()
        Image.new("1", (7000, 7000)).save(buffer, "PNG")  # petit fichier, dimensions excessives
        huge = SimpleUploadedFile("huge.png", buffer.getvalue(), content_type="image/png")
        self.assertEqual(self._cover(huge).status_code, 400)

    def test_path_traversal_in_filename_has_no_effect(self):
        response = self._cover(image_upload(name="../../../../etc/evil.png"))
        self.assertEqual(response.status_code, 200)
        asset = MediaAsset.objects.get(pk=response.json()["cover"]["id"])
        for path in asset.relative_paths():
            self.assertNotIn("..", path)
            self.assertNotIn("evil", path)
            resolved = (settings.MEDIA_ROOT / path).resolve()
            self.assertTrue(str(resolved).startswith(str(settings.MEDIA_ROOT.resolve())))

    def test_upload_requires_admin(self):
        response = self.client.post(
            f"/api/v1/admin/projects/{self.published.pk}/cover/", {"file": image_upload()}, format="multipart"
        )
        self.assertEqual(response.status_code, 403)

    def test_json_route_rejects_multipart_and_vice_versa(self):
        client = self.admin_client()
        response = client.post("/api/v1/admin/projects/", {"title_fr": "x"}, format="multipart")
        self.assertEqual(response.status_code, 415)
        response = client.post(f"/api/v1/admin/projects/{self.published.pk}/cover/", {"file": "x"}, format="json")
        self.assertEqual(response.status_code, 415)

    def test_replacing_and_deleting_removes_files(self):
        first = MediaAsset.objects.get(pk=self._cover(image_upload()).json()["cover"]["id"])
        first_paths = first.relative_paths()
        with self.captureOnCommitCallbacks(execute=True):
            self._cover(image_upload(color=(200, 0, 0)))
        for path in first_paths:
            self.assertFalse((settings.MEDIA_ROOT / path).exists())
        current = Project.objects.get(pk=self.published.pk).cover
        current_paths = current.relative_paths()
        with self.captureOnCommitCallbacks(execute=True):
            self.admin_client().delete(f"/api/v1/admin/projects/{self.published.pk}/")
        for path in current_paths:
            self.assertFalse((settings.MEDIA_ROOT / path).exists())
        self.assertFalse(MediaAsset.objects.filter(pk=current.pk).exists())

    def test_gallery_images(self):
        client = self.admin_client()
        response = client.post(
            f"/api/v1/admin/projects/{self.published.pk}/images/",
            {"file": image_upload(), "alt_fr": "Écran d'accueil"}, format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.content)
        image_id = response.json()["id"]
        detail = self.client.get("/api/v1/projects/publie/").json()
        self.assertEqual(detail["images"][0]["image"]["alt"], "Écran d'accueil")
        response = client.patch(
            f"/api/v1/admin/projects/{self.published.pk}/images/{image_id}/", {"caption_fr": "Légende"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.delete(f"/api/v1/admin/projects/{self.published.pk}/images/{image_id}/").status_code, 204)


class ProjectChapterTests(ProjectFixtures):
    def test_challenges_are_nested_and_replaced(self):
        client = self.admin_client()
        url = f"/api/v1/admin/projects/{self.published.pk}/"
        response = client.patch(url, {
            "context_fr": "Contexte", "problem_fr": "Problème", "results_fr": "Résultats",
            "challenges": [
                {"challenge_fr": "Latence", "solution_fr": "Cache"},
                {"challenge_fr": "Sécurité", "solution_fr": "CSP", "solution_en": "CSP header"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()["challenges"]), 2)
        response = client.patch(url, {"challenges": [{"challenge_fr": "Seule", "solution_fr": "Unique"}]}, format="json")
        self.assertEqual([c["challenge_fr"] for c in response.json()["challenges"]], ["Seule"])
        detail = self.client.get("/api/v1/projects/publie/?lang=en").json()
        self.assertEqual(detail["challenges"], [{"challenge": "Seule", "solution": "Unique"}])
        for key in ("context", "problem", "objectives", "features", "architecture", "results", "architecture_image"):
            self.assertIn(key, detail)
        self.assertEqual(detail["context"], "Contexte")

    def test_too_many_challenges_rejected(self):
        payload = {"challenges": [{"challenge_fr": f"D{i}", "solution_fr": "S"} for i in range(13)]}
        response = self.admin_client().patch(f"/api/v1/admin/projects/{self.published.pk}/", payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_previous_next_follow_public_order_and_skip_drafts(self):
        second = Project.objects.create(title_fr="Deuxième", slug="deuxieme", category=self.backend, is_published=True, display_order=2)
        self.draft.display_order = 1
        self.draft.save()
        first = self.client.get("/api/v1/projects/publie/").json()
        self.assertIsNone(first["previous"])
        self.assertEqual(first["next"], {"slug": "deuxieme", "title": "Deuxième"})
        last = self.client.get(f"/api/v1/projects/{second.slug}/").json()
        self.assertEqual(last["previous"]["slug"], "publie")
        self.assertIsNone(last["next"])

    def test_architecture_image_upload_and_removal(self):
        client = self.admin_client()
        url = f"/api/v1/admin/projects/{self.published.pk}/architecture-image/"
        response = client.post(url, {"file": image_upload()}, format="multipart")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNotNone(response.json()["architecture_image"])
        self.assertIsNotNone(self.client.get("/api/v1/projects/publie/").json()["architecture_image"])
        self.assertEqual(client.delete(url).status_code, 204)
        self.published.refresh_from_db()
        self.assertIsNone(self.published.architecture_image)
        self.assertEqual(self.client.post(url, {"file": image_upload()}, format="multipart").status_code, 403)
