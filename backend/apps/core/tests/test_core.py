import io
import json
import logging
import shutil

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import RequestFactory, override_settings

from apps.core.logging import RedactSecretsFilter
from apps.core.models import SiteProfile, SocialLink
from apps.core.net import get_client_ip
from apps.core.services import seo
from apps.core.tests.base import PortfolioAPITestCase, image_upload, pdf_bytes
from apps.core.validators.urls import validate_public_https_url


class SecurityHeadersTests(PortfolioAPITestCase):
    def test_api_responses_carry_security_headers(self):
        response = self.client.get("/api/v1/site/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("default-src 'self'", response["Content-Security-Policy"])
        self.assertIn("frame-ancestors 'none'", response["Content-Security-Policy"])
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Referrer-Policy"], "strict-origin-when-cross-origin")
        self.assertIn("camera=()", response["Permissions-Policy"])

    def test_admin_responses_are_never_cached(self):
        response = self.admin_client().get("/api/v1/admin/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])

    def test_unknown_api_route_returns_json_404(self):
        response = self.client.get("/api/v1/inexistant/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Ressource introuvable."})

    def test_unexpected_content_type_is_refused(self):
        response = self.admin_client().generic(
            "POST", "/api/v1/admin/skills/", "name=x", content_type="application/x-www-form-urlencoded"
        )
        self.assertEqual(response.status_code, 415)

    def test_oversized_body_is_refused(self):
        response = self.admin_client().generic(
            "POST", "/api/v1/admin/skills/", "{}", content_type="application/json",
            CONTENT_LENGTH=str(settings.DATA_UPLOAD_MAX_MEMORY_SIZE + 1),
        )
        self.assertEqual(response.status_code, 413)

    def test_unexpected_http_method_is_refused(self):
        self.assertEqual(self.client.generic("TRACE", "/api/v1/site/").status_code, 405)

    @override_settings(ADMIN_ALLOWED_IPS=["203.0.113.0/24"])
    def test_admin_ip_allowlist(self):
        from apps.core.middleware import admin_guard

        middleware = admin_guard.AdminAreaGuardMiddleware(lambda request: None)
        self.assertFalse(middleware._ip_allowed("198.51.100.7"))
        self.assertTrue(middleware._ip_allowed("203.0.113.9"))


class PublicSiteTests(PortfolioAPITestCase):
    def test_site_endpoint_aggregates_only_published_content(self):
        profile = SiteProfile.load()
        SocialLink.objects.create(profile=profile, platform="github", url="https://github.com/x", is_published=True)
        SocialLink.objects.create(profile=profile, platform="x", url="https://x.com/hidden", is_published=False)
        data = self.client.get("/api/v1/site/?lang=fr").json()
        self.assertEqual(set(data), {"lang", "profile", "skills", "career", "categories", "projects"})
        self.assertEqual([link["url"] for link in data["profile"]["social_links"]], ["https://github.com/x"])
        self.assertNotIn("seo_title_fr", data["profile"])

    def test_profile_is_a_singleton(self):
        SiteProfile.load()
        with self.assertRaises(IntegrityError), transaction.atomic():
            SiteProfile.objects.create(singleton=1, first_name="a", last_name="b", job_title_fr="c")

    def test_public_rate_limit(self):
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "public": "3/min"}}):
            from rest_framework.settings import api_settings
            from rest_framework.throttling import SimpleRateThrottle

            api_settings.reload()
            SimpleRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
            try:
                codes = [self.client.get("/api/v1/profile/").status_code for _ in range(4)]
            finally:
                api_settings.reload()
                SimpleRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
        self.assertEqual(codes, [200, 200, 200, 429])


class AdminProfileTests(PortfolioAPITestCase):
    def test_update_profile_and_expertise_validation(self):
        client = self.admin_client()
        response = client.patch("/api/v1/admin/profile/", {"first_name": "Ada", "expertise_fr": ["Django", "Sécurité"]}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(SiteProfile.load().first_name, "Ada")
        bad = client.patch("/api/v1/admin/profile/", {"expertise_fr": ["ok", 3]}, format="json")
        self.assertEqual(bad.status_code, 400)
        multiline = client.patch("/api/v1/admin/profile/", {"first_name": "Ada\nBcc: x@y.z"}, format="json")
        self.assertEqual(multiline.status_code, 400)

    def test_public_phone_is_validated_and_exposed(self):
        client = self.admin_client()
        for bad in ("javascript:alert(1)", "<b>0102</b>", "+225 01\n52 16"):
            response = client.patch("/api/v1/admin/profile/", {"phone_public": bad}, format="json")
            self.assertEqual(response.status_code, 400, bad)
        ok = client.patch("/api/v1/admin/profile/", {"phone_public": "+225 01 52 16 17 69"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertEqual(self.client.get("/api/v1/site/?lang=en").json()["profile"]["phone"], "+225 01 52 16 17 69")

    def test_photo_and_cv_uploads(self):
        client = self.admin_client()
        response = client.post("/api/v1/admin/profile/photo/", {"file": image_upload()}, format="multipart")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["photo"]["kind"], "image")
        pdf = SimpleUploadedFile("cv.pdf", pdf_bytes(), content_type="application/pdf")
        response = client.post("/api/v1/admin/profile/cv/fr/", {"file": pdf}, format="multipart")
        self.assertEqual(response.status_code, 200, response.content)
        public = self.client.get("/api/v1/profile/?lang=en").json()
        self.assertTrue(public["cv"]["url"].endswith(".pdf"))  # repli sur le CV français

    def test_malicious_pdfs_are_rejected(self):
        client = self.admin_client()
        cases = [
            SimpleUploadedFile("cv.pdf", pdf_bytes(b"<< /S /JavaScript /JS (app.alert(1)) >>"), content_type="application/pdf"),
            SimpleUploadedFile("cv.pdf", pdf_bytes(b"<< /OpenAction 3 0 R >>"), content_type="application/pdf"),
            SimpleUploadedFile("cv.pdf", b"MZ\x90\x00 not a pdf", content_type="application/pdf"),
            SimpleUploadedFile("cv.exe", pdf_bytes(), content_type="application/pdf"),
        ]
        for upload in cases:
            response = client.post("/api/v1/admin/profile/cv/fr/", {"file": upload}, format="multipart")
            self.assertEqual(response.status_code, 400, upload.name)

    def test_cv_language_is_restricted(self):
        pdf = SimpleUploadedFile("cv.pdf", pdf_bytes(), content_type="application/pdf")
        response = self.admin_client().post("/api/v1/admin/profile/cv/de/", {"file": pdf}, format="multipart")
        self.assertIn(response.status_code, (404, 415))
        self.assertIsNone(SiteProfile.load().cv_fr)


class SeoTests(PortfolioAPITestCase):
    def setUp(self):
        super().setUp()
        self.target = settings.FRONTEND_BUILD_DIR
        self.target.mkdir(parents=True, exist_ok=True)
        # Page unique produite par Vite : modèle de toutes les pages publiques.
        template = (
            '<!doctype html><html lang="fr" class="no-js"><head>\n<!-- seo:start --><title>x</title><!-- seo:end -->\n'
            '<script type="module" src="/assets/app/index-abc.js"></script></head><body><div id="root"></div></body></html>'
        )
        (self.target / "index.html").write_text(template, encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.target, ignore_errors=True)

    def test_regenerate_escapes_content(self):
        profile = SiteProfile.load()
        profile.first_name = '"><script>alert(1)</script>'
        profile.job_title_en = "Engineer"
        profile.save()
        written = seo.regenerate(self.target)
        self.assertIn("sitemap.xml", written)
        html = (self.target / "index.html").read_text()
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertIn("&quot;&gt;&lt;script&gt;", html)
        ld = html.split('<script type="application/ld+json">')[1].split("</script>")[0]
        self.assertNotIn("<", ld)
        self.assertTrue(json.loads(ld)["mainEntity"]["name"].startswith('"><script>'))
        self.assertIn('hreflang="en"', html)
        self.assertIn("og:title", (self.target / "en" / "index.html").read_text())
        robots = (self.target / "robots.txt").read_text()
        self.assertIn(f"Disallow: /{settings.DASHBOARD_PREFIX}/", robots)
        self.assertIn("<loc>", (self.target / "sitemap.xml").read_text())

    def test_every_public_address_gets_its_own_page(self):
        seo.regenerate(self.target)
        en = (self.target / "en" / "index.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="en"', en)
        self.assertIn('og:locale" content="en_US"', en)
        self.assertIn('<div id="root"></div>', en)  # React prend le relais dans le navigateur
        self.assertIn('src="/assets/app/index-abc.js"', en)
        pages = [("mentions-legales.html", "fr"), ("confidentialite.html", "fr"),
                 ("en/legal-notice.html", "en"), ("en/privacy.html", "en"), ("404.html", "fr")]
        for relative, lang in pages:
            html = (self.target / relative).read_text(encoding="utf-8")
            self.assertIn(f'<html lang="{lang}"', html)
            self.assertIn('content="noindex, follow"', html)
        # Régénération répétée : index.html, déjà traité, reste un modèle valide.
        seo.regenerate(self.target)
        self.assertEqual((self.target / "index.html").read_text(encoding="utf-8").count("<!-- seo:start -->"), 1)

    def test_missing_template_is_reported_without_error(self):
        (self.target / "index.html").unlink()
        self.assertEqual(seo.regenerate(self.target), [])

    def test_project_pages_are_generated_and_pruned(self):
        from apps.projects.models import Category, Project

        category = Category.objects.create(name_fr="Web", slug="web")
        project = Project.objects.create(
            title_fr='Titre "<b>"', slug="mon-projet", summary_fr="Résumé", category=category, is_published=True
        )
        Project.objects.create(title_fr="Brouillon", slug="brouillon", category=category)
        seo.regenerate(self.target)
        page = (self.target / "projets" / "mon-projet" / "index.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="fr"', page)
        self.assertIn(f'rel="canonical" href="{settings.SITE_URL}/projets/mon-projet/"', page)
        self.assertIn(f'hreflang="en" href="{settings.SITE_URL}/en/projects/mon-projet/"', page)
        self.assertNotIn("<b>", page.split("<!-- seo:end -->")[0])
        en = (self.target / "en" / "projects" / "mon-projet" / "index.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="en"', en)
        self.assertFalse((self.target / "projets" / "brouillon").exists())
        self.assertIn("/projets/mon-projet/", (self.target / "sitemap.xml").read_text(encoding="utf-8"))
        project.is_published = False
        project.save()
        seo.regenerate(self.target)
        self.assertFalse((self.target / "projets" / "mon-projet").exists())
        self.assertFalse((self.target / "en" / "projects" / "mon-projet").exists())


class BuildFrontendCommandTests(PortfolioAPITestCase):
    def test_refuses_unbuilt_source(self):
        from django.core.management import CommandError, call_command

        with self.assertRaises(CommandError):
            call_command("build_frontend", source=str(settings.BASE_DIR / "inexistant"), skip_seo=True)

    def test_publishes_build_and_generates_pages(self):
        import tempfile
        from pathlib import Path

        from django.core.management import call_command

        workdir = Path(tempfile.mkdtemp(prefix="pf-build-"))
        source, target = workdir / "dist", workdir / "public"
        (source / "assets").mkdir(parents=True)
        (source / "index.html").write_text(
            '<html lang="fr"><head><!-- seo:start --><title>x</title><!-- seo:end --></head><body></body></html>', encoding="utf-8"
        )
        try:
            call_command("build_frontend", source=str(source), target=str(target), stdout=io.StringIO())
            self.assertTrue((target / "en" / "index.html").is_file())
            self.assertTrue((target / "sitemap.xml").is_file())
        finally:
            shutil.rmtree(workdir, ignore_errors=True)


class ValidatorAndNetworkTests(PortfolioAPITestCase):
    def test_url_validator(self):
        validate_public_https_url("https://github.com/exemple")
        for bad in ("http://github.com", "ftp://x.org", "https://a:b@x.org", "https://192.168.1.1", "https://intra.local"):
            with self.assertRaises(ValidationError, msg=bad):
                validate_public_https_url(bad)

    def test_forwarded_for_header_is_ignored(self):
        request = RequestFactory().get("/", REMOTE_ADDR="198.51.100.4", HTTP_X_FORWARDED_FOR="1.2.3.4")
        self.assertEqual(get_client_ip(request), "198.51.100.4")
        with override_settings(TRUST_PROXY_HEADERS=True):
            request = RequestFactory().get("/", REMOTE_ADDR="10.0.0.2", HTTP_X_REAL_IP="203.0.113.50")
            self.assertEqual(get_client_ip(request), "203.0.113.50")

    def test_log_filter_redacts_secrets(self):
        record = logging.LogRecord("t", logging.INFO, "", 0, "login password=hunter2 token: abc", (), None)
        RedactSecretsFilter().filter(record)
        self.assertNotIn("hunter2", record.getMessage())
        self.assertNotIn("abc", record.getMessage())


class HealthTests(PortfolioAPITestCase):
    def test_healthz(self):
        self.assertEqual(self.client.get("/healthz/").json(), {"status": "ok"})
