"""
Génération des pages publiques et de leurs métadonnées de référencement.

Le frontend React (frontend/, construit par Vite dans dist/) n'a qu'une page : `index.html`,
qui contient un bloc délimité par `<!-- seo:start -->` et `<!-- seo:end -->`. Ce service s'en sert
de modèle pour écrire un fichier HTML par adresse publique (accueil FR/EN, chaque projet publié,
pages légales, 404), chacun avec ses propres balises title, description, canonical, hreflang,
Open Graph et données structurées Schema.org. React prend ensuite le relais dans le navigateur.
Nginx sert ainsi chaque adresse comme un fichier statique, avec un vrai code 404 pour le reste.

Il génère aussi sitemap.xml et robots.txt. Il est appelé après chaque modification du profil
ou d'un projet, et par `manage.py build_seo` / `manage.py build_frontend`.
Les adresses doivent rester identiques à celles de frontend/src/i18n/routes.js.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import tempfile
from datetime import date
from pathlib import Path

from django.conf import settings
from django.utils.html import escape

logger = logging.getLogger("portfolio.requests")

SEO_BLOCK = re.compile(r"<!-- seo:start -->.*?<!-- seo:end -->", re.DOTALL)
HTML_LANG = re.compile(r'<html lang="[a-zA-Z-]*"')
TEMPLATE = "index.html"  # page unique produite par Vite
PAGES = {"fr": ("index.html", "/"), "en": ("en/index.html", "/en/")}
# Dossier des pages projet générées, par langue.
PROJECT_FOLDERS = {"fr": "projets", "en": "en/projects"}
PROJECT_URL = {"fr": "/projets/{slug}/", "en": "/en/projects/{slug}/"}
SLUG_SAFE = re.compile(r"^[a-z0-9-]{1,120}$")
# Pages sans contenu en base : (fichier, langue, titre). Non indexées.
STATIC_PAGES = (
    ("mentions-legales.html", "fr", "Mentions légales"),
    ("confidentialite.html", "fr", "Confidentialité"),
    ("en/legal-notice.html", "en", "Legal notice"),
    ("en/privacy.html", "en", "Privacy"),
    ("404.html", "fr", "Page introuvable — 404"),
)
LEGAL_PAGES = tuple(f"/{path}" for path, _lang, _title in STATIC_PAGES if path != "404.html")


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".seo-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _json_ld(data: dict) -> str:
    # Empêche toute sortie du bloc <script> (« </script> », commentaires HTML).
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return raw.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def _absolute(url: str) -> str:
    return url if url.startswith("http") else f"{settings.SITE_URL}{url}"


def build_head(profile, lang: str) -> str:
    from apps.core.i18n import translated
    from apps.core.services.uploads import asset_payload

    site = settings.SITE_URL
    name = profile.full_name
    job = translated(profile, "job_title", lang)
    title = translated(profile, "seo_title", lang) or f"{name} — {job}"
    description = translated(profile, "seo_description", lang) or translated(profile, "short_bio", lang) or job
    description = description[:170]
    url = f"{site}{PAGES[lang][1]}"
    og_asset = profile.og_image or profile.photo
    image = asset_payload(og_asset)
    image_url = _absolute(image["src"]) if image else f"{site}/assets/img/og-default.png"
    links = [link.url for link in profile.social_links.all() if link.is_published]

    person = {
        "@type": "Person",
        "name": name,
        "jobTitle": job,
        "description": description,
        "url": url,
        "image": image_url,
        "sameAs": links,
        "knowsAbout": translated(profile, "expertise", lang) or [],
    }
    if profile.location:
        person["address"] = {"@type": "PostalAddress", "addressLocality": profile.location}
    structured = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "url": url,
        "name": title,
        "inLanguage": lang,
        "dateModified": profile.updated_at.isoformat() if profile.updated_at else None,
        "mainEntity": person,
    }

    e = escape
    return "\n".join(
        [
            "<!-- seo:start -->",
            f"<title>{e(title)}</title>",
            f'<meta name="description" content="{e(description)}">',
            f'<link rel="canonical" href="{e(url)}">',
            f'<link rel="alternate" hreflang="fr" href="{e(site)}/">',
            f'<link rel="alternate" hreflang="en" href="{e(site)}/en/">',
            f'<link rel="alternate" hreflang="x-default" href="{e(site)}/">',
            '<meta property="og:type" content="profile">',
            f'<meta property="og:title" content="{e(title)}">',
            f'<meta property="og:description" content="{e(description)}">',
            f'<meta property="og:url" content="{e(url)}">',
            f'<meta property="og:image" content="{e(image_url)}">',
            f'<meta property="og:locale" content="{"fr_FR" if lang == "fr" else "en_US"}">',
            f'<meta property="profile:first_name" content="{e(profile.first_name)}">',
            f'<meta property="profile:last_name" content="{e(profile.last_name)}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{e(title)}">',
            f'<meta name="twitter:description" content="{e(description)}">',
            f'<meta name="twitter:image" content="{e(image_url)}">',
            f'<script type="application/ld+json">{_json_ld(structured)}</script>',
            "<!-- seo:end -->",
        ]
    )


def build_project_head(project, lang: str) -> str:
    from apps.core.i18n import translated
    from apps.core.services.uploads import asset_payload

    site = settings.SITE_URL
    title = f"{translated(project, 'title', lang)} — {'Projet' if lang == 'fr' else 'Project'}"
    description = (translated(project, "summary", lang) or translated(project, "context", lang) or "")[:170]
    url = site + PROJECT_URL[lang].format(slug=project.slug)
    image = asset_payload(project.cover)
    image_url = _absolute(image["src"]) if image else f"{site}/assets/img/og-default.png"
    structured = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": translated(project, "title", lang),
        "description": description,
        "url": url,
        "image": image_url,
        "inLanguage": lang,
        "keywords": [tech.name for tech in project.technologies.all()],
        "dateModified": project.updated_at.isoformat() if project.updated_at else None,
    }
    if project.repo_url:
        structured["codeRepository"] = project.repo_url
    e = escape
    alternates = [
        f'<link rel="alternate" hreflang="{code}" href="{e(site + PROJECT_URL[code].format(slug=project.slug))}">'
        for code in PROJECT_URL
    ]
    return "\n".join(
        [
            "<!-- seo:start -->",
            f"<title>{e(title)}</title>",
            f'<meta name="description" content="{e(description)}">',
            f'<link rel="canonical" href="{e(url)}">',
            *alternates,
            '<meta property="og:type" content="article">',
            f'<meta property="og:title" content="{e(title)}">',
            f'<meta property="og:description" content="{e(description)}">',
            f'<meta property="og:url" content="{e(url)}">',
            f'<meta property="og:image" content="{e(image_url)}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<script type="application/ld+json">{_json_ld(structured)}</script>',
            "<!-- seo:end -->",
        ]
    )


def build_simple_head(title: str) -> str:
    """Pages légales et 404 : titre seul, non indexées (elles restent suivies)."""
    return "\n".join(
        ["<!-- seo:start -->", f"<title>{escape(title)}</title>", '<meta name="robots" content="noindex, follow">', "<!-- seo:end -->"]
    )


def render_page(template: str, lang: str, head: str) -> str:
    """Copie de la page React avec la langue et le bloc SEO propres à une adresse."""
    html = HTML_LANG.sub(f'<html lang="{lang}"', template, count=1)
    return SEO_BLOCK.sub(lambda _m: head, html, count=1)


def write_project_pages(target: Path, template: str, projects) -> list[str]:
    written = []
    for lang, folder in PROJECT_FOLDERS.items():
        root = target / folder
        keep = set()
        for project in projects:
            if not SLUG_SAFE.match(project.slug):
                continue
            keep.add(project.slug)
            _atomic_write(root / project.slug / "index.html", render_page(template, lang, build_project_head(project, lang)))
            written.append(f"{folder}/{project.slug}/index.html")
        # Les projets dépubliés ou supprimés ne doivent plus avoir de page publique (Nginx renverra 404).
        if root.is_dir():
            for child in root.iterdir():
                if child.is_dir() and child.name not in keep and SLUG_SAFE.match(child.name):
                    shutil.rmtree(child)
    return written


def build_sitemap(projects=()) -> str:
    site = settings.SITE_URL
    today = date.today().isoformat()
    entries = []
    for project in projects:
        urls = {code: site + PROJECT_URL[code].format(slug=project.slug) for code in PROJECT_URL}
        alternates = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{c}" href="{escape(u)}"/>' for c, u in urls.items())
        lastmod = project.updated_at.date().isoformat() if project.updated_at else today
        for url in urls.values():
            entries.append(
                f"  <url>\n    <loc>{escape(url)}</loc>\n    <lastmod>{lastmod}</lastmod>\n"
                f"    <priority>0.7</priority>{alternates}\n  </url>"
            )
    for path, priority in [("/", "1.0"), ("/en/", "0.9")] + [(page, "0.2") for page in LEGAL_PAGES]:
        alternates = ""
        if path in ("/", "/en/"):
            alternates = (
                f'\n    <xhtml:link rel="alternate" hreflang="fr" href="{site}/"/>'
                f'\n    <xhtml:link rel="alternate" hreflang="en" href="{site}/en/"/>'
            )
        entries.append(
            f"  <url>\n    <loc>{escape(site + path)}</loc>\n    <lastmod>{today}</lastmod>\n"
            f"    <priority>{priority}</priority>{alternates}\n  </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )


def build_robots() -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        f"Disallow: /{settings.DASHBOARD_PREFIX}/\n"
        "Disallow: /api/\n\n"
        f"Sitemap: {settings.SITE_URL}/sitemap.xml\n"
    )


def regenerate(target_dir: Path | None = None) -> list[str]:
    from apps.core.models import SiteProfile
    from apps.projects.models import Project

    target = Path(target_dir or settings.FRONTEND_BUILD_DIR)
    template_path = target / TEMPLATE
    if not template_path.is_file():
        logger.warning("seo_template_missing path=%s (lancez « npm run build » dans frontend/)", template_path)
        return []
    template = template_path.read_text(encoding="utf-8")
    if not SEO_BLOCK.search(template):
        logger.warning("seo_block_missing page=%s", TEMPLATE)
        return []

    profile = SiteProfile.load()
    profile = SiteProfile.objects.prefetch_related("social_links").select_related("photo", "og_image").get(pk=profile.pk)
    written = []
    for lang, (relative, _) in PAGES.items():
        page = target / relative
        html = render_page(template, lang, build_head(profile, lang))
        if not page.exists() or page.read_text(encoding="utf-8") != html:
            _atomic_write(page, html)
        written.append(relative)
    for relative, lang, title in STATIC_PAGES:
        _atomic_write(target / relative, render_page(template, lang, build_simple_head(title)))
        written.append(relative)

    projects = list(
        Project.objects.filter(is_published=True).select_related("cover").prefetch_related("technologies")
    )
    written += write_project_pages(target, template, projects)
    _atomic_write(target / "sitemap.xml", build_sitemap(projects))
    _atomic_write(target / "robots.txt", build_robots())
    written += ["sitemap.xml", "robots.txt"]
    return written


def regenerate_quietly() -> None:
    try:
        regenerate()
    except Exception:  # le site doit continuer de fonctionner même si l'écriture échoue
        logger.exception("seo_regeneration_failed")

