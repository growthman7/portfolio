from apps.career.models import Experience
from apps.core.tests.base import PortfolioAPITestCase


class CareerTests(PortfolioAPITestCase):
    def test_experience_with_nested_missions(self):
        client = self.admin_client()
        payload = {
            "kind": "internship", "title_fr": "Stagiaire développeur", "organization": "Entreprise",
            "start_date": "2024-02-01", "end_date": "2024-07-31", "is_published": True,
            "missions": [{"description_fr": "Mission A"}, {"description_fr": "Mission B", "description_en": "Task B"}],
        }
        response = client.post("/api/v1/admin/experiences/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        experience_id = response.json()["id"]
        response = client.patch(
            f"/api/v1/admin/experiences/{experience_id}/", {"missions": [{"description_fr": "Mission C"}]}, format="json"
        )
        self.assertEqual([m["description_fr"] for m in response.json()["missions"]], ["Mission C"])
        public = self.client.get("/api/v1/career/?lang=en").json()
        self.assertEqual(public["experiences"][0]["missions"], ["Mission C"])
        self.assertEqual(public["experiences"][0]["title"], "Stagiaire développeur")

    def test_dates_are_validated(self):
        client = self.admin_client()
        response = client.post(
            "/api/v1/admin/experiences/",
            {"title_fr": "Poste", "organization": "X", "start_date": "2024-05-01", "end_date": "2023-01-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        response = client.post(
            "/api/v1/admin/certifications/",
            {"name": "Cert", "issuer": "Org", "issued_on": "2024-05-01", "expires_on": "2024-01-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unpublished_entries_stay_private(self):
        Experience.objects.create(title_fr="Privé", organization="X", start_date="2020-01-01")
        self.assertEqual(self.client.get("/api/v1/career/").json()["experiences"], [])

    def test_education_and_certification_crud(self):
        client = self.admin_client()
        education = client.post(
            "/api/v1/admin/educations/",
            {"degree_fr": "Master", "institution": "Université", "is_degree": True, "is_published": True},
            format="json",
        )
        self.assertEqual(education.status_code, 201, education.content)
        cert = client.post(
            "/api/v1/admin/certifications/",
            {"name": "Cert", "issuer": "Org", "issued_on": "2024-05-01", "credential_url": "https://verify.example.org/1", "is_published": True},
            format="json",
        )
        self.assertEqual(cert.status_code, 201, cert.content)
        public = self.client.get("/api/v1/career/").json()
        self.assertEqual(len(public["educations"]), 1)
        self.assertEqual(len(public["certifications"]), 1)


class AchievementTests(PortfolioAPITestCase):
    def test_achievement_crud_and_public_payload(self):
        client = self.admin_client()
        response = client.post(
            "/api/v1/admin/achievements/",
            {"title_fr": "Prix hackathon", "title_en": "Hackathon award", "date": "2024-03-01",
             "url": "https://example.org/prix", "is_published": True},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        public = self.client.get("/api/v1/career/?lang=en").json()
        self.assertEqual(public["achievements"][0]["title"], "Hackathon award")
        self.assertNotIn("id", public["achievements"][0])
        site = self.client.get("/api/v1/site/").json()
        self.assertEqual(site["career"]["achievements"][0]["title"], "Prix hackathon")

    def test_achievement_rejects_insecure_url_and_anonymous_writes(self):
        response = self.admin_client().post(
            "/api/v1/admin/achievements/", {"title_fr": "X", "url": "javascript:alert(1)"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(self.client.post("/api/v1/admin/achievements/", {"title_fr": "X"}, format="json").status_code, (401, 403))

    def test_experience_technologies_are_names(self):
        from apps.projects.models import Technology
        tech = Technology.objects.create(name="Django", slug="django")
        experience = Experience.objects.create(title_fr="Dev", organization="X", start_date="2023-01-01", is_published=True)
        experience.technologies.add(tech)
        self.assertEqual(self.client.get("/api/v1/career/").json()["experiences"][0]["technologies"], ["Django"])
