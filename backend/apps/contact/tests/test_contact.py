from django.core import mail
from django.core.cache import cache
from django.test import override_settings

from apps.audit.models import AuditLog
from apps.contact.models import ContactMessage
from apps.core.tests.base import PortfolioAPITestCase


class ContactTests(PortfolioAPITestCase):
    def payload(self, client, **overrides):
        data = {
            "name": "Grace Hopper",
            "email": "grace@example.test",
            "subject": "Proposition de mission",
            "message": "Bonjour, j'aimerais échanger sur un projet.",
            "language": "fr",
            "consent": True,
            "website": "",
            "form_token": client.get("/api/v1/contact/token/").json()["form_token"],
        }
        data.update(overrides)
        return data

    def send(self, client=None, **overrides):
        client = client or self.csrf_client()
        with self.captureOnCommitCallbacks(execute=True):
            return client.post("/api/v1/contact/", self.payload(client, **overrides), format="json")

    def test_valid_message_is_stored_and_notified(self):
        response = self.send()
        self.assertEqual(response.status_code, 201)
        message = ContactMessage.objects.get()
        self.assertEqual(message.status, ContactMessage.Status.NEW)
        self.assertEqual(len(message.ip_hash), 32)  # IP pseudonymisée, jamais en clair
        self.assertNotIn("127.0.0.1", message.ip_hash)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].reply_to, ["grace@example.test"])

    def test_csrf_is_enforced(self):
        from rest_framework.test import APIClient

        client = APIClient(enforce_csrf_checks=True)
        response = client.post("/api/v1/contact/", self.payload(client), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(ContactMessage.objects.exists())

    def test_honeypot_silently_drops_message(self):
        response = self.send(website="https://spam.example")
        self.assertEqual(response.status_code, 201)
        self.assertFalse(ContactMessage.objects.exists())
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.CONTACT_SPAM).exists())

    def test_forged_token_is_dropped(self):
        self.send(form_token="faux")
        self.assertFalse(ContactMessage.objects.exists())

    @override_settings(CONTACT_MIN_FILL_SECONDS=30)
    def test_too_fast_submission_is_dropped(self):
        self.send()
        self.assertFalse(ContactMessage.objects.exists())

    def test_server_side_validation(self):
        cases = [
            {"email": "pas-un-email"},
            {"message": "court"},
            {"name": ""},
            {"subject": "Objet\r\nBcc: victime@example.test"},
            {"consent": False},
            {"message": "x" * 5001},
        ]
        for overrides in cases:
            cache.clear()
            self.assertEqual(self.send(**overrides).status_code, 400, list(overrides))
        self.assertFalse(ContactMessage.objects.exists())

    def test_rate_limit(self):
        client = self.csrf_client()
        statuses = [self.send(client).status_code for _ in range(6)]
        self.assertEqual(statuses[:5], [201] * 5)
        self.assertEqual(statuses[5], 429)

    def test_admin_message_management(self):
        self.send()
        message = ContactMessage.objects.get()
        client = self.admin_client()
        self.assertEqual(client.get("/api/v1/admin/messages/?status=new").json()["count"], 1)
        client.get(f"/api/v1/admin/messages/{message.pk}/")
        message.refresh_from_db()
        self.assertEqual(message.status, ContactMessage.Status.READ)
        self.assertIsNotNone(message.read_at)
        response = client.patch(f"/api/v1/admin/messages/{message.pk}/", {"status": "archived", "message": "modifié"}, format="json")
        self.assertEqual(response.status_code, 200)
        message.refresh_from_db()
        self.assertEqual(message.status, "archived")
        self.assertNotEqual(message.message, "modifié")  # le contenu reçu n'est pas modifiable
        self.assertEqual(client.delete(f"/api/v1/admin/messages/{message.pk}/").status_code, 204)

    def test_messages_are_private(self):
        self.send()
        self.assertEqual(self.client.get("/api/v1/admin/messages/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/contact/").status_code, 405)
