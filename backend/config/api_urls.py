"""Routes de l'API REST v1 : publiques, authentification, administration."""
from django.urls import include, path

public = [
    path("", include("apps.core.urls")),
    path("", include("apps.skills.urls")),
    path("", include("apps.career.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.contact.urls")),
    path("", include("apps.accounts.urls")),
]

# Toutes ces routes exigent : session valide + rôle administrateur + permission sur le modèle.
admin = [
    path("", include("apps.core.admin_urls")),
    path("", include("apps.projects.admin_urls")),
    path("", include("apps.skills.admin_urls")),
    path("", include("apps.career.admin_urls")),
    path("", include("apps.contact.admin_urls")),
    path("", include("apps.audit.admin_urls")),
]

urlpatterns = [
    path("admin/", include(admin)),
    *public,
]
