from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve

from apps.core.views import healthz


def api_not_found(request, exception=None):
    return JsonResponse({"detail": "Ressource introuvable."}, status=404)


urlpatterns = [
    path("api/v1/", include("config.api_urls")),
    re_path(r"^api/", api_not_found),
    path(f"{settings.DASHBOARD_PREFIX}/", include("apps.dashboard.urls")),
    path("healthz/", healthz),
]

if getattr(settings, "SERVE_FRONTEND", False):
    # Développement uniquement : en production, Nginx sert le frontend et les médias.
    # Sert le frontend React construit (frontend/dist) comme Nginx : fichier exact, sinon dossier/index.html,
    # sinon 404.html (la page React affiche alors « introuvable ») avec un vrai code 404.
    # Pour développer le frontend avec rechargement à chaud, préférez « npm run dev » (port 5173).
    def frontend(request, path=""):
        root = Path(settings.FRONTEND_BUILD_DIR)
        if path == "" or path.endswith("/"):
            path += "index.html"
        if (root / path).is_file():
            return serve(request, path, document_root=root)
        if (root / path / "index.html").is_file():
            return serve(request, f"{path}/index.html", document_root=root)
        if (root / "404.html").is_file():
            response = serve(request, "404.html", document_root=root)
            response.status_code = 404
            return response
        return JsonResponse(
            {"detail": "Frontend non construit : lancez « npm run build » dans frontend/ puis « python manage.py build_seo », "
                       "ou utilisez « npm run dev » (http://localhost:5173)."},
            status=404,
        )

    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
        re_path(r"^(?P<path>.*)$", frontend),
    ]

handler404 = "config.urls.not_found"
handler500 = "config.urls.server_error"


def not_found(request, exception=None):
    if request.path.startswith("/api/"):
        return api_not_found(request)
    from django.views.defaults import page_not_found

    return page_not_found(request, exception)


def server_error(request):
    # Aucun détail technique n'est exposé.
    return JsonResponse({"detail": "Une erreur interne est survenue."}, status=500)
