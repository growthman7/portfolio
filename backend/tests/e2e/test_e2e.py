"""
Tests de bout en bout dans un vrai navigateur (Playwright + Chromium).

    cd frontend && npm run build
    cd ../backend && python manage.py test tests.e2e --settings=config.settings.e2e

Django sert le frontend construit et l'API sur une base de test : aucune donnée réelle n'est touchée.
Ignorés par la suite de tests ordinaire (réglage E2E absent).
"""
import os
import shutil
import unittest
from io import StringIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import LiveServerTestCase

from apps.projects.models import Category, Project

try:
    from playwright.sync_api import expect, sync_playwright
except ImportError:  # dépendance de développement facultative
    sync_playwright = None

ADMIN = f"/{settings.DASHBOARD_PREFIX}"
INITIAL = {"name": "Compte initial", "email": "initial@example.test", "password": "Phrase-initiale-vraiment-longue-1"}
NEW = {"last": "Lovelace", "first": "Ada", "email": "ada@example.test", "password": "Phrase-personnelle-tres-longue-2"}
DIST = settings.BASE_DIR.parent / "frontend" / "dist"
OVERFLOW = "document.documentElement.scrollWidth - document.documentElement.clientWidth"

# Playwright pilote le navigateur de façon synchrone depuis ce fil : Django refuse sinon l'accès à la base.
os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")


@unittest.skipUnless(getattr(settings, "E2E", False) and sync_playwright, "tests E2E : --settings=config.settings.e2e + playwright")
class EndToEndTests(LiveServerTestCase):
    host = "localhost"

    @classmethod
    def setUpClass(cls):
        if not (DIST / "index.html").is_file():
            raise unittest.SkipTest("frontend non construit : lancez « npm run build » dans frontend/")
        shutil.rmtree(settings.FRONTEND_BUILD_DIR, ignore_errors=True)
        shutil.copytree(DIST, settings.FRONTEND_BUILD_DIR, dirs_exist_ok=True)
        super().setUpClass()
        cls.playwright = sync_playwright().start()
        # Chromium de Playwright (« playwright install chromium »), sinon un navigateur déjà installé.
        for channel in (os.environ.get("E2E_BROWSER_CHANNEL"), "msedge", "chrome"):
            try:
                cls.browser = cls.playwright.chromium.launch(channel=channel)
                break
            except Exception:  # noqa: BLE001, S112, PERF203 - navigateur absent : on essaie le suivant
                continue
        else:
            cls.playwright.stop()
            super().tearDownClass()
            raise unittest.SkipTest("aucun navigateur : lancez « playwright install chromium »")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        super().tearDownClass()
        shutil.rmtree(settings.FRONTEND_BUILD_DIR, ignore_errors=True)
        shutil.rmtree(settings.MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        cache.clear()
        # Comme au démarrage du conteneur : administrateur initial créé depuis l'environnement.
        os.environ["E2E_ADMIN_PASSWORD"] = INITIAL["password"]
        call_command(
            "create_portfolio_admin", username=INITIAL["email"], email=INITIAL["email"], name=INITIAL["name"],
            password_env="E2E_ADMIN_PASSWORD", if_missing=True, stdout=StringIO(),
        )
        Category.objects.create(name_fr="Web", name_en="Web", slug="web")
        call_command("build_seo", stdout=StringIO())
        self.js_errors = []

    # ----- outils -----
    def page(self, **context_options):
        context = self.browser.new_context(base_url=self.live_server_url, **context_options)
        self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: self.js_errors.append(str(error)))
        return page

    def login(self, page, username, password):
        page.goto(f"{ADMIN}/connexion")
        page.fill("#username", username)
        page.fill("#password", password)
        page.get_by_role("button", name="Se connecter").click()

    def open_admin(self, page, label):
        page.get_by_role("link", name=label, exact=True).click()
        expect(page.get_by_role("heading", level=1, name=label)).to_be_visible()

    def create_project(self, page, title, slug):
        self.open_admin(page, "Projets")
        page.locator(".page-actions a").click()
        page.fill('[name="title_fr"]', title)
        page.fill('[name="slug"]', slug)
        page.select_option('[name="category"]', label="Web")
        page.fill('[name="summary_fr"]', f"Résumé de {title}")
        page.get_by_role("button", name="Créer").click()
        expect(page.get_by_text("Élément créé.")).to_be_visible()
        self.open_admin(page, "Projets")
        page.get_by_role("button", name=f"Publier « {title} »").click()
        expect(page.get_by_role("button", name=f"Dépublier « {title} »")).to_be_visible()

    # ----- projets -----
    def test_projects_are_listed_created_and_opened(self):
        page = self.page()
        self.login(page, INITIAL["email"], INITIAL["password"])
        expect(page.get_by_role("heading", level=1, name="Vue d'ensemble")).to_be_visible()
        self.create_project(page, "Projet simple", "projet-simple")
        # Identifiant « comme en production » : tiret bas et majuscule, acceptés par le serveur.
        self.create_project(page, "Mon portfolio", "Mon_portfolio")

        page.goto("/")
        for title in ("Projet simple", "Mon portfolio"):
            expect(page.get_by_role("heading", level=3, name=title)).to_be_visible()
        page.get_by_role("link", name="Voir le projet : Mon portfolio").click()
        page.wait_for_url("**/projets/Mon_portfolio/")
        expect(page.get_by_role("heading", level=1, name="Mon portfolio")).to_be_visible()
        expect(page.get_by_text("Résumé de Mon portfolio")).to_be_visible()

        # Accès direct (rechargement, lien partagé) à chacun des projets.
        page.goto("/projets/Mon_portfolio/")
        expect(page.get_by_role("heading", level=1, name="Mon portfolio")).to_be_visible()
        page.goto("/projets/projet-simple/")
        expect(page.get_by_role("heading", level=1, name="Projet simple")).to_be_visible()

        # Projet inexistant : message clair, pas de page blanche.
        page.goto("/projets/inconnu/")
        expect(page.get_by_role("heading", level=1, name="Projet introuvable")).to_be_visible()
        expect(page.get_by_role("link", name="← Tous les projets")).to_be_visible()
        self.assertEqual(self.js_errors, [])

    # ----- administrateurs -----
    def test_initial_admin_is_replaced_by_a_new_one(self):
        first = self.page()
        first.on("dialog", lambda dialog: dialog.accept())
        self.login(first, INITIAL["email"], INITIAL["password"])
        self.open_admin(first, "Administrateurs")
        rows = first.locator("tbody tr")
        expect(rows).to_have_count(1)
        expect(rows.first).to_contain_text("Compte initial")
        expect(rows.first).to_contain_text("Vous")
        # Dernier administrateur actif : suppression impossible, y compris en appelant l'API directement.
        expect(rows.first.get_by_role("button", name="Supprimer Compte initial")).to_be_disabled()
        own_id = get_user_model().objects.get(username=INITIAL["email"]).pk
        csrf = first.request.get("/api/v1/auth/csrf/").json()["csrf_token"]
        refused = first.request.delete(f"/api/v1/admin/admins/{own_id}/", headers={"X-CSRFToken": csrf})
        self.assertEqual(refused.status, 409)

        # Création : la confirmation erronée est refusée, puis le compte est créé.
        first.fill('[name="last_name"]', NEW["last"])
        first.fill('[name="first_name"]', NEW["first"])
        first.fill('[name="email"]', NEW["email"])
        first.fill('[name="password"]', NEW["password"])
        first.fill('[name="password_confirm"]', "autre chose")
        first.get_by_role("button", name="Créer l'administrateur").click()
        expect(first.locator(".field__error", has_text="Les mots de passe ne correspondent pas.")).to_be_visible()
        expect(rows).to_have_count(1)
        first.fill('[name="password_confirm"]', NEW["password"])
        first.get_by_role("button", name="Créer l'administrateur").click()
        expect(first.get_by_text("Administrateur créé.")).to_be_visible()
        expect(rows).to_have_count(2)
        expect(first.locator('[name="password"]')).to_have_value("")
        self.assertNotIn(NEW["password"], get_user_model().objects.get(username=NEW["email"]).password)

        # Le nouvel administrateur se connecte avec ses propres identifiants.
        second = self.page()
        self.login(second, NEW["email"], NEW["password"])
        expect(second.get_by_role("heading", level=1, name="Vue d'ensemble")).to_be_visible()

        # L'administrateur initial supprime son propre compte : il est déconnecté.
        first.get_by_role("button", name="Supprimer Compte initial").click()
        first.wait_for_url(f"**{ADMIN}/connexion")
        self.assertFalse(get_user_model().objects.filter(username=INITIAL["email"]).exists())
        self.assertIn(first.request.get("/api/v1/admin/admins/").status, (401, 403))
        self.login(first, INITIAL["email"], INITIAL["password"])
        expect(first.get_by_text("Identifiant ou mot de passe incorrect.")).to_be_visible()

        # Le nouveau conserve tous les privilèges et ne peut pas se supprimer (dernier administrateur).
        self.create_project(second, "Projet du nouvel admin", "projet-nouvel-admin")
        self.open_admin(second, "Administrateurs")
        rows = second.locator("tbody tr")
        expect(rows).to_have_count(1)
        expect(rows.first).to_contain_text("Ada Lovelace")
        expect(rows.first.get_by_role("button", name="Supprimer Ada Lovelace")).to_be_disabled()

        # Visiteur non connecté : ni la page ni l'API ne sont accessibles.
        anonymous = self.page()
        self.assertIn(anonymous.request.get("/api/v1/admin/admins/").status, (401, 403))
        anonymous.goto(f"{ADMIN}/admins")
        anonymous.wait_for_url(f"**{ADMIN}/connexion")
        self.assertEqual(self.js_errors, [])

    # ----- interface -----
    def test_interface_is_alive_responsive_and_respects_reduced_motion(self):
        Project.objects.create(title_fr="Vitrine", slug="vitrine", summary_fr="Résumé", category=Category.objects.get(), is_published=True)
        call_command("build_seo", stdout=StringIO())

        page = self.page(viewport={"width": 1280, "height": 800})
        page.goto("/")
        # Démarrage du « système » puis apparition du hero.
        expect(page.locator(".terminal__boot span")).to_have_count(3)
        expect(page.locator("#hero-name")).to_have_class("hero__name is-on")
        # Témoin d'activité : il pulse et l'horloge avance.
        self.assertEqual(page.evaluate("getComputedStyle(document.querySelector('.sys-status__dot'), '::after').animationName"), "sys-pulse")
        clock = page.locator(".sys-status span").nth(1)
        expect(clock).not_to_have_text(clock.inner_text())
        # La lumière d'ambiance suit la souris ; la carte s'incline sous le pointeur.
        page.mouse.move(900, 200)
        page.wait_for_function("document.documentElement.style.getPropertyValue('--px') !== ''")
        page.locator(".project-card").first.hover(position={"x": 30, "y": 60})
        page.wait_for_function("document.querySelector('.project-card__frame').style.getPropertyValue('--rx') !== ''")
        # Navigation : ouverture du projet par une transition de vue, puis retour à la liste.
        self.assertTrue(page.evaluate("typeof document.startViewTransition === 'function'"))
        page.get_by_role("link", name="Voir le projet : Vitrine").click()
        expect(page.get_by_role("heading", level=1, name="Vitrine")).to_be_visible()
        self.assertEqual(page.evaluate("getComputedStyle(document.querySelector('.case-cover')).animationName"), "window-open")
        page.get_by_role("link", name="Tous les projets").first.click()
        expect(page.get_by_role("heading", level=3, name="Vitrine")).to_be_visible()

        # Mobile : pas de défilement horizontal, sur le site comme dans l'administration.
        mobile = self.page(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        for path in ("/", "/projets/vitrine/", f"{ADMIN}/connexion"):
            mobile.goto(path)
            mobile.wait_for_load_state("networkidle")
            self.assertLessEqual(mobile.evaluate(OVERFLOW), 1, f"défilement horizontal sur {path}")
        self.login(mobile, INITIAL["email"], INITIAL["password"])
        self.open_admin(mobile, "Administrateurs")
        self.assertLessEqual(mobile.evaluate(OVERFLOW), 1, "défilement horizontal dans l'administration")

        # « Réduire les animations » : tout est visible tout de suite, plus de boucle ni de suivi du pointeur.
        calm = self.page(reduced_motion="reduce")
        calm.goto("/")
        expect(calm.locator("#hero-name")).to_have_class("hero__name is-on")
        self.assertEqual(calm.evaluate("getComputedStyle(document.querySelector('.sys-status__dot'), '::after').display"), "none")
        calm.mouse.move(600, 300)
        calm.wait_for_timeout(200)
        self.assertEqual(calm.evaluate("document.documentElement.style.getPropertyValue('--px')"), "")
        self.assertEqual(self.js_errors, [])
