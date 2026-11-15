"""
Tâche périodique : une requête vers le serveur toutes les 10 minutes.

L'offre gratuite de Render met le service en veille après 15 minutes sans requête entrante ; un appel
régulier à sa propre adresse publique (/healthz/) le garde éveillé. Un simple fil d'arrière-plan suffit :
aucune dépendance, rien à planifier ailleurs.
"""
import logging
import threading
import urllib.request

from django.conf import settings

logger = logging.getLogger("portfolio.requests")
_started = threading.Event()


def ping(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            return response.status == 200
    except OSError as exc:
        logger.warning("keepalive_failed url=%s error=%s", url, exc)
        return False


def start() -> threading.Event | None:
    """
    Lance la boucle une seule fois par processus ; sans effet si KEEPALIVE_URL est vide.
    Renvoie l'événement qui l'arrête (utile aux tests).
    """
    url, every = settings.KEEPALIVE_URL, settings.KEEPALIVE_INTERVAL
    if not url.startswith("https://") or _started.is_set():
        return None
    _started.set()
    stop = threading.Event()

    def loop() -> None:
        # shortcut: un fil par worker Gunicorn (2 requêtes par période), à remplacer par un planificateur
        # externe (cron, Celery beat) si une tâche ne doit s'exécuter qu'une seule fois.
        while not stop.wait(every):
            ping(url)

    threading.Thread(target=loop, name="keepalive", daemon=True).start()
    return stop
