import re
from io import StringIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import CommandError, call_command
from django.test import override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.tests.base import PASSWORD, PortfolioAPITestCase

LOGIN = "/api/v1/auth/login/"


class LoginTests(PortfolioAPITestCase):
    def test_login_success_creates_session_and_audit_entry(self):
        client = self.csrf_client()
        response = client.post(LOGIN, {"username": "admin", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "admin")
        cookie = client.cookies["pf_sessionid"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.LOGIN_SUCCESS, actor=self.admin).exists())

    def test_session_id_rotates_on_login(self):
        client = self.csrf_client()
        client.cookies["pf_sessionid"] = "fixation-attempt"
        client.post(LOGIN, {"username": "admin", "password": PASSWORD}, format="json")
        self.assertNotEqual(client.cookies["pf_sessionid"].value, "fixation-attempt")

    def test_wrong_password_and_unknown_user_get_identical_answers(self):
        client = self.csrf_client()
        wrong = client.post(LOGIN, {"username": "admin", "password": "mauvais"}, format="json")
        unknown = client.post(LOGIN, {"username": "inconnu", "password": "mauvais"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(wrong.json(), unknown.json())
        self.assertEqual(AuditLog.objects.filter(action=AuditLog.Action.LOGIN_FAILED).count(), 2)

    def test_audit_never_stores_password(self):
        self.csrf_client().post(LOGIN, {"username": "admin", "password": "secret-tente"}, format="json")
        for entry in AuditLog.objects.all():
            self.assertNotIn("secret-tente", str(entry.metadata))

    def test_non_admin_accounts_cannot_log_in(self):
        client = self.csrf_client()
        for username in ("staff", "visiteur"):
            response = client.post(LOGIN, {"username": username, "password": PASSWORD}, format="json")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(client.get("/api/v1/admin/dashboard/").status_code, 403)

    def test_login_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post(LOGIN, {"username": "admin", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_lockout_after_repeated_failures(self):
        client = self.csrf_client()
        for _ in range(5):
            client.post(LOGIN, {"username": "admin", "password": "mauvais"}, format="json")
        # Même avec le bon mot de passe, le couple identifiant + IP reste verrouillé.
        response = client.post(LOGIN, {"username": "admin", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 429)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.LOGIN_LOCKED).exists())

    def test_login_rate_limit(self):
        client = self.csrf_client()
        statuses = [
            client.post(LOGIN, {"username": f"u{i}", "password": "x"}, format="json").status_code for i in range(11)
        ]
        self.assertEqual(statuses[-1], 429)

    def test_logout_destroys_session(self):
        client = self.csrf_client()
        client.post(LOGIN, {"username": "admin", "password": PASSWORD}, format="json")
        token = client.get("/api/v1/auth/csrf/").json()["csrf_token"]
        client.credentials(HTTP_X_CSRFTOKEN=token)
        self.assertEqual(client.post("/api/v1/auth/logout/").status_code, 204)
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 403)

    def test_no_public_route_creates_accounts(self):
        client = APIClient()
        for path in ("/api/v1/auth/register/", "/api/v1/auth/signup/", "/api/v1/users/", "/api/v1/admin/users/"):
            self.assertEqual(client.post(path, {"username": "x", "password": PASSWORD}, format="json").status_code, 404)
        self.assertEqual(get_user_model().objects.count(), 3)


class PasswordTests(PortfolioAPITestCase):
    def test_password_change_requires_current_password_and_policy(self):
        client = self.admin_client()
        bad = client.post("/api/v1/auth/password/change/", {"current_password": "faux", "new_password": "x"}, format="json")
        self.assertEqual(bad.status_code, 400)
        weak = client.post("/api/v1/auth/password/change/", {"current_password": PASSWORD, "new_password": "123456"}, format="json")
        self.assertEqual(weak.status_code, 400)
        new = "Nouveau-mot-de-passe-tres-long-42"
        ok = client.post("/api/v1/auth/password/change/", {"current_password": PASSWORD, "new_password": new}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(new))

    def _reset_link(self):
        client = self.csrf_client()
        response = client.post("/api/v1/auth/password/reset/", {"email": "admin@example.test"}, format="json")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(len(mail.outbox), 1)
        uid, token = re.search(r"/reinitialisation/([^/]+)/([^/]+)/", mail.outbox[0].body).groups()
        return client, uid, token

    def test_reset_answers_identically_for_unknown_email(self):
        client = self.csrf_client()
        known = client.post("/api/v1/auth/password/reset/", {"email": "admin@example.test"}, format="json")
        unknown = client.post("/api/v1/auth/password/reset/", {"email": "nobody@example.test"}, format="json")
        staff = client.post("/api/v1/auth/password/reset/", {"email": "staff@example.test"}, format="json")
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(known.json(), staff.json())
        self.assertEqual(len(mail.outbox), 1)  # seul l'administrateur reçoit un lien

    def test_reset_confirm_works_once(self):
        client, uid, token = self._reset_link()
        new = "Mot-de-passe-reinitialise-2026"
        payload = {"uid": uid, "token": token, "new_password": new}
        self.assertEqual(client.post("/api/v1/auth/password/reset/confirm/", payload, format="json").status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(new))
        payload["new_password"] = "Encore-un-autre-mot-de-passe-99"
        self.assertEqual(client.post("/api/v1/auth/password/reset/confirm/", payload, format="json").status_code, 400)

    def test_reset_rejects_forged_token(self):
        client, uid, _ = self._reset_link()
        payload = {"uid": uid, "token": "faux-jeton", "new_password": "Mot-de-passe-reinitialise-2026"}
        self.assertEqual(client.post("/api/v1/auth/password/reset/confirm/", payload, format="json").status_code, 400)

    @override_settings(PASSWORD_RESET_ENABLED=False)
    def test_reset_can_be_disabled(self):
        response = self.csrf_client().post("/api/v1/auth/password/reset/", {"email": "admin@example.test"}, format="json")
        self.assertEqual(response.status_code, 404)


class PasswordHashingTests(PortfolioAPITestCase):
    def test_production_settings_use_argon2id(self):
        from config.settings import base

        self.assertEqual(base.PASSWORD_HASHERS[0], "django.contrib.auth.hashers.Argon2PasswordHasher")
        from django.contrib.auth.hashers import make_password

        encoded = make_password("x", hasher="argon2")
        self.assertTrue(encoded.startswith("argon2$argon2id$"))

    def test_passwords_are_never_stored_in_clear(self):
        self.assertNotIn(PASSWORD, self.admin.password)


class CreateAdminCommandTests(PortfolioAPITestCase):
    def test_refuses_when_admin_exists(self):
        with self.assertRaises(CommandError):
            call_command("create_portfolio_admin", username="nouveau", email="n@example.test", password_env="X")

    def test_creates_admin_with_strong_password_only(self):
        get_user_model().objects.filter(username="admin").delete()
        import os

        os.environ["TEST_ADMIN_PASSWORD"] = "faible"
        with self.assertRaises(CommandError):
            call_command("create_portfolio_admin", username="chef", email="chef@example.test", password_env="TEST_ADMIN_PASSWORD")
        os.environ["TEST_ADMIN_PASSWORD"] = "Phrase-de-passe-vraiment-longue-1"
        call_command(
            "create_portfolio_admin", username="chef", email="chef@example.test",
            password_env="TEST_ADMIN_PASSWORD", stdout=StringIO(),
        )
        del os.environ["TEST_ADMIN_PASSWORD"]
        user = get_user_model().objects.get(username="chef")
        self.assertTrue(user.is_staff and not user.is_superuser)
        self.assertTrue(user.groups.filter(name="portfolio_admins").exists())
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.ADMIN_CREATED, actor=user).exists())
