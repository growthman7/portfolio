from __future__ import annotations

from django.db import connection, transaction
from django.db.models import Prefetch
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.career.views import career_payload
from apps.projects.serializers import PublicCategorySerializer, PublicProjectCardSerializer
from apps.projects.views import published_projects
from apps.projects.models import Category
from apps.skills.models import Skill, SkillCategory
from apps.skills.serializers import PublicSkillCategorySerializer

from .i18n import get_request_language
from .models import SiteProfile, SocialLink
from .permissions import ADMIN_PERMISSION_CLASSES
from .serializers import AdminProfileSerializer, AdminSocialLinkSerializer, PublicProfileSerializer
from .services.uploads import delete_asset, ensure_valid, store_image, store_pdf
from .throttling import ScopedIpThrottle, UploadThrottle, UserBurstThrottle
from .viewsets import AdminModelViewSet


def csrf_failure(request, reason=""):
    """Réponse JSON neutre en cas d'échec CSRF (aucun détail interne)."""
    return JsonResponse({"detail": "Requête refusée (protection CSRF). Rechargez la page puis réessayez."}, status=403)


def healthz(request):
    """Sonde de disponibilité pour le conteneur : vérifie l'accès à la base."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok"})


def _profile():
    return SiteProfile.load()


class _PublicView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedIpThrottle,)
    throttle_scope = "public"

    def cached(self, data):
        return Response(data, headers={"Cache-Control": "public, max-age=60"})


class PublicProfileView(_PublicView):
    def get(self, request):
        profile = SiteProfile.load()
        profile = SiteProfile.objects.prefetch_related("social_links").select_related("photo", "cv_fr", "cv_en", "cv_alt").get(pk=profile.pk)
        return self.cached(PublicProfileSerializer(profile, context={"lang": get_request_language(request)}).data)


class PublicSiteView(_PublicView):
    """
    Tout le contenu public en une seule requête (profil, compétences, parcours, catégories, projets).
    Réduit le nombre d'allers-retours au chargement de la page.
    """

    def get(self, request):
        lang = get_request_language(request)
        context = {"lang": lang}
        base = SiteProfile.load()
        profile = SiteProfile.objects.prefetch_related("social_links").select_related("photo", "cv_fr", "cv_en", "cv_alt").get(pk=base.pk)
        skill_categories = (
            SkillCategory.objects.filter(skills__is_published=True)
            .distinct()
            .prefetch_related(Prefetch("skills", queryset=Skill.objects.order_by("display_order", "id")))
        )
        categories = Category.objects.filter(projects__is_published=True).distinct()
        return self.cached(
            {
                "lang": lang,
                "profile": PublicProfileSerializer(profile, context=context).data,
                "skills": PublicSkillCategorySerializer(skill_categories, many=True, context=context).data,
                "career": career_payload(lang),
                "categories": PublicCategorySerializer(categories, many=True, context=context).data,
                "projects": PublicProjectCardSerializer(published_projects(), many=True, context=context).data,
            }
        )


class AdminProfileViewSet(ViewSet):
    """Informations générales du portfolio (ressource unique) et fichiers associés."""

    permission_classes = ADMIN_PERMISSION_CLASSES
    parser_classes = (JSONParser,)
    queryset = SiteProfile.objects.all()  # requis par DjangoModelPermissions

    def get_throttles(self):
        if getattr(self, "action", None) in ("photo", "og_image", "cv", "cv_alt"):
            return [UserBurstThrottle(), UploadThrottle()]
        return super().get_throttles()

    def list(self, request):
        return Response(AdminProfileSerializer(_profile()).data)

    def partial_update(self, request, pk=None):
        profile = _profile()
        serializer = AdminProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record(request, AuditLog.Action.UPDATE, profile, fields=",".join(sorted(serializer.validated_data)))
        return Response(serializer.data)

    def _replace_asset(self, request, field: str, folder: str, kind: str = "image"):
        profile = _profile()
        old = getattr(profile, field)
        if request.method == "DELETE":
            setattr(profile, field, None)
            profile.save(update_fields=[field, "updated_at"])
            delete_asset(old)
            record(request, AuditLog.Action.UPDATE, profile, field=f"{field}_removed")
            return Response(status=status.HTTP_204_NO_CONTENT)
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": ["Aucun fichier reçu."]}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            asset = ensure_valid(store_pdf if kind == "pdf" else store_image, upload, folder)
            setattr(profile, field, asset)
            profile.save(update_fields=[field, "updated_at"])
            delete_asset(old)
            record(request, AuditLog.Action.UPLOAD, profile, field=field)
        return Response(AdminProfileSerializer(profile).data)

    @action(detail=False, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path="photo")
    def photo(self, request):
        return self._replace_asset(request, "photo", "profile")

    @action(detail=False, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path="og-image")
    def og_image(self, request):
        return self._replace_asset(request, "og_image", "og")

    @action(detail=False, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path=r"cv/(?P<lang>fr|en)")
    def cv(self, request, lang=None):
        return self._replace_asset(request, f"cv_{lang}", "cv", kind="pdf")

    @action(detail=False, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path="cv-alt")
    def cv_alt(self, request):
        return self._replace_asset(request, "cv_alt", "cv", kind="pdf")


class AdminSocialLinkViewSet(AdminModelViewSet):
    serializer_class = AdminSocialLinkSerializer
    queryset = SocialLink.objects.all()
    pagination_class = None
