from apps.core.tests.base import PortfolioAPITestCase
from apps.skills.models import Skill, SkillCategory


class SkillTests(PortfolioAPITestCase):
    def test_public_lists_only_published_skills_and_optional_levels(self):
        backend = SkillCategory.objects.create(kind="backend", name_fr="Backend", name_en="Backend", slug="backend")
        empty = SkillCategory.objects.create(kind="security", name_fr="Sécurité", slug="securite")
        Skill.objects.create(category=backend, name="Django", is_published=True)
        Skill.objects.create(category=backend, name="Caché", is_published=False)
        Skill.objects.create(category=empty, name="Brouillon", is_published=False)
        data = self.client.get("/api/v1/skills/").json()
        self.assertEqual([c["slug"] for c in data], ["backend"])
        self.assertEqual(data[0]["skills"], [{"name": "Django", "level": "", "years": None}])

    def test_admin_crud_and_uniqueness(self):
        client = self.admin_client()
        category = client.post("/api/v1/admin/skill-categories/", {"kind": "devops", "name_fr": "DevOps et Cloud"}, format="json")
        self.assertEqual(category.status_code, 201, category.content)
        self.assertEqual(category.json()["slug"], "devops-et-cloud")
        payload = {"category": category.json()["id"], "name": "Docker", "is_published": True}
        self.assertEqual(client.post("/api/v1/admin/skills/", payload, format="json").status_code, 201)
        self.assertEqual(client.post("/api/v1/admin/skills/", payload, format="json").status_code, 400)
        bad_level = {**payload, "name": "Kubernetes", "level": "guru"}
        self.assertEqual(client.post("/api/v1/admin/skills/", bad_level, format="json").status_code, 400)
