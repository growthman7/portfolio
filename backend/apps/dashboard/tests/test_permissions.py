"""Matrice d'autorisation : chaque route d'administration refuse anonymes et comptes non administrateurs."""
from django.conf import settings
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.tests.base import PortfolioAPITestCase

ADMIN_ROUTES = [
    "/api/v1/admin/dashboard/",
    "/api/v1/admin/profile/",
    "/api/v1/admin/social-links/",
    "/api/v1/admin/categories/",
    "/api/v1/admin/technologies/",
    "/api/v1/admin/projects/",
    "/api/v1/admin/skill-categories/",
    "/api/v1/admin/skills/",
    "/api/v1/admin/experiences/",
    "/api/v1/admin/educations/",
    "/api/v1/admin/certifications/",
    "/api/v1/admin/messages/",
    "/api/v1/admin/audit-log/",
]
WRITE_ROUTES = [
    ("post", "/api/v1/admin/projects/"),
    ("post", "/api/v1/admin/skills/"),
    ("patch", "/api/v1/admin/profile/"),
    ("post", "/api/v1/admin/experiences/"),
    ("post", "/api/v1/admin/projects/reorder/"),
]


class AuthorizationMatrixTests(PortfolioAPITestCase):
    def clients(self):
        anonymous = APIClient()
        staff = APIClient()
        staff.force_login(self.staff_not_admin)
        regular = APIClient()
        regular.force_login(self.regular)
        return {"anonyme": anonymous, "staff non admin": staff, "utilisateur": regular}

    def test_every_admin_route_is_protected(self):
        for label, client in self.clients().items():
            for route in ADMIN_ROUTES:
                self.assertEqual(client.get(route).status_code, 403, f"{label} {route}")
            for method, route in WRITE_ROUTES:
                self.assertEqual(getattr(client, method)(route, {}, format="json").status_code, 403, f"{label} {method} {route}")

    def test_admin_can_read_every_route(self):
        client = self.admin_client()
        for route in ADMIN_ROUTES:
            self.assertEqual(client.get(route).status_code, 200, route)

    def test_model_permissions_are_enforced_inside_the_admin_role(self):
        """Un administrateur à qui l'on retire une permission perd l'action correspondante."""
        from django.contrib.auth.models import Group

        group = Group.objects.get(name=settings.PORTFOLIO_ADMIN_GROUP)
        group.permissions.remove(Permission.objects.get(codename="delete_contactmessage"))
        client = self.admin_client()
        self.assertEqual(client.get("/api/v1/admin/messages/").status_code, 200)
        self.assertEqual(client.delete("/api/v1/admin/messages/999/").status_code, 403)

    def test_audit_log_is_read_only(self):
        AuditLog.objects.create(action=AuditLog.Action.LOGOUT)
        client = self.admin_client()
        entry = client.get("/api/v1/admin/audit-log/").json()["results"][0]
        self.assertIn(client.post("/api/v1/admin/audit-log/", {}, format="json").status_code, (403, 405))
        self.assertIn(client.delete(f"/api/v1/admin/audit-log/{entry['id']}/").status_code, (403, 405))
        self.assertTrue(AuditLog.objects.filter(pk=entry["id"]).exists())

    def test_inactive_admin_is_refused(self):
        self.admin.is_active = False
        self.admin.save()
        client = APIClient()
        client.force_login(self.admin)
        self.assertEqual(client.get("/api/v1/admin/dashboard/").status_code, 403)

    def test_admin_write_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        response = client.post("/api/v1/admin/technologies/", {"name": "Go"}, format="json")
        self.assertEqual(response.status_code, 403)
        token = client.get("/api/v1/auth/csrf/").json()["csrf_token"]
        response = client.post("/api/v1/admin/technologies/", {"name": "Go"}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)


class DashboardPageTests(PortfolioAPITestCase):
    def test_dashboard_page_requires_admin(self):
        prefix = settings.DASHBOARD_PREFIX
        response = self.client.get(f"/{prefix}/")
        self.assertRedirects(response, f"/{prefix}/connexion/", fetch_redirect_response=False)
        staff = APIClient()
        staff.force_login(self.staff_not_admin)
        self.assertEqual(staff.get(f"/{prefix}/").status_code, 302)
        response = self.admin_client().get(f"/{prefix}/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("script-src 'self'", response["Content-Security-Policy"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("pf_csrftoken", response.cookies)

    def test_login_page_is_public(self):
        response = self.client.get(f"/{settings.DASHBOARD_PREFIX}/connexion/")
        self.assertEqual(response.status_code, 200)

    def test_stats_payload(self):
        data = self.admin_client().get("/api/v1/admin/dashboard/").json()
        self.assertEqual(len(data["messages"]["timeline"]), 30)
        self.assertIn("failed_logins_7d", data["security"])
