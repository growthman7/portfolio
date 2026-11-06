"""
Construit un aperçu autonome du frontend (sans backend) : copie de frontend/ et
déclaration du fichier de données de démonstration dans chaque page.

    python tools/build_preview.py <dossier_cible>
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "frontend"
PAGES = {
    "index.html": "preview/site.fr.json",
    "en/index.html": "../preview/site.en.json",
    "projet.html": "preview/site.fr.json",
    "en/projet.html": "../preview/site.en.json",
}


def main(target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(ROOT, target)
    for page, fixture in PAGES.items():
        path = target / page
        html = path.read_text(encoding="utf-8")
        meta = f'<meta name="pf-fixture" content="{fixture}">\n'
        path.write_text(html.replace('<meta name="color-scheme"', meta + '<meta name="color-scheme"', 1), encoding="utf-8")
    print(f"Aperçu construit dans {target}")


def artifact_entry(target: Path) -> None:
    """Version de la page d'accueil pour l'hébergement d'aperçu : le contenu sans <html>/<head>/<body>,
    l'hébergeur fournissant lui-même le squelette du document."""
    import re

    html = (target / "index.html").read_text(encoding="utf-8")
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    head = re.sub(r'<meta (charset|name="viewport")[^>]*>\n?', "", head)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    body = body.replace('href="en/"', 'href="en/index.html"')
    lang = '<script>document.documentElement.lang = "fr";</script>\n'
    (target / "index.html").write_text(lang + head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
    # Dans l'hébergement d'aperçu, la page d'accueil française est l'adresse racine (pas « index.html »).
    for name in ("projet.html", "mentions-legales.html", "confidentialite.html"):
        page = target / name
        page.write_text(page.read_text(encoding="utf-8").replace('href="index.html', 'href="./').replace('data-home="index.html"', 'data-home="./"'), encoding="utf-8")


if __name__ == "__main__":
    destination = Path(sys.argv[1]).resolve()
    main(destination)
    if "--artifact" in sys.argv:
        artifact_entry(destination)
