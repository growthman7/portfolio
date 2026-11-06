from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.services.uploads import delete_asset, ensure_valid, store_image
from apps.core.throttling import UploadThrottle, UserBurstThrottle
from apps.core.viewsets import AdminModelViewSet, PublicReadOnlyViewSet

from . import serializers as s
from .models import Category, Project, ProjectChallenge, ProjectImage, Technology


def published_projects():
    return (
        Project.objects.filter(is_published=True)
        .select_related("category", "cover", "architecture_image")
        .prefetch_related("skills")
    )


# --------------------------------------------------------------------------- public
class PublicCategoryViewSet(PublicReadOnlyViewSet):
    serializer_class = s.PublicCategorySerializer

    def get_queryset(self):
        return Category.objects.filter(projects__is_published=True).distinct()


class PublicProjectViewSet(PublicReadOnlyViewSet):
    lookup_field = "slug"

    def get_queryset(self):
        queryset = published_projects()
        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                Prefetch("images", queryset=ProjectImage.objects.select_related("asset")),
                Prefetch("challenges", queryset=ProjectChallenge.objects.order_by("display_order", "pk")),
            )
        category = self.request.query_params.get("category")
        if category:
            # Le filtre passe par l'ORM : la valeur est un paramètre lié, jamais concaténée en SQL.
            queryset = queryset.filter(category__slug=category[:60])
        return queryset

    def get_serializer_class(self):
        return s.PublicProjectDetailSerializer if self.action == "retrieve" else s.PublicProjectCardSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "retrieve":
            # Ordre de la galerie publique, pour les liens « projet précédent / suivant ».
            neighbours = {p.pk: p for p in Project.objects.filter(is_published=True).only("pk", "slug", "title_fr", "title_en")}
            context["neighbours"] = neighbours
            context["order"] = list(
                Project.objects.filter(is_published=True).order_by("display_order", "id").values_list("pk", flat=True)
            )
        return context


# --------------------------------------------------------------------------- admin
class AdminCategoryViewSet(AdminModelViewSet):
    serializer_class = s.AdminCategorySerializer
    queryset = Category.objects.all()
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.projects.exists():
            return Response(
                {"detail": "Cette catégorie contient des projets : déplacez-les avant de la supprimer."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class AdminTechnologyViewSet(AdminModelViewSet):
    serializer_class = s.AdminTechnologySerializer
    queryset = Technology.objects.all()
    pagination_class = None


class AdminProjectViewSet(AdminModelViewSet):
    serializer_class = s.AdminProjectSerializer

    def get_queryset(self):
        queryset = Project.objects.select_related("category", "cover", "architecture_image").prefetch_related(
            "skills", "challenges", Prefetch("images", queryset=ProjectImage.objects.select_related("asset"))
        )
        params = self.request.query_params
        if params.get("status") == "published":
            queryset = queryset.filter(is_published=True)
        elif params.get("status") == "draft":
            queryset = queryset.filter(is_published=False)
        if params.get("category", "").isdigit():
            queryset = queryset.filter(category_id=int(params["category"]))
        if params.get("search"):
            queryset = queryset.filter(title_fr__icontains=params["search"][:80])
        return queryset

    def get_throttles(self):
        if self.action in ("cover", "architecture_image", "add_image"):
            return [UserBurstThrottle(), UploadThrottle()]
        return super().get_throttles()

    def _single_image(self, request, field):
        """Téléverse ou retire une image unique rattachée au projet (couverture, schéma d'architecture)."""
        project = self.get_object()
        old = getattr(project, field)
        if request.method == "DELETE":
            setattr(project, field, None)
            project.save(update_fields=[field, "updated_at"])
            delete_asset(old)
            record(request, AuditLog.Action.UPDATE, project, field=f"{field}_removed")
            return Response(status=status.HTTP_204_NO_CONTENT)
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": ["Aucun fichier reçu."]}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            asset = ensure_valid(store_image, upload, "projects")
            setattr(project, field, asset)
            project.save(update_fields=[field, "updated_at"])
            delete_asset(old)
            record(request, AuditLog.Action.UPLOAD, project, field=field)
        return Response(self.get_serializer(project).data)

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path="cover")
    def cover(self, request, pk=None):
        return self._single_image(request, "cover")

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser], url_path="architecture-image")
    def architecture_image(self, request, pk=None):
        return self._single_image(request, "architecture_image")

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser], url_path="images")
    def add_image(self, request, pk=None):
        project = self.get_object()
        if project.images.count() >= settings.UPLOAD_LIMITS["images_per_project"]:
            return Response({"detail": "Nombre maximal d'images atteint pour ce projet."}, status=status.HTTP_400_BAD_REQUEST)
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"file": ["Aucun fichier reçu."]}, status=status.HTTP_400_BAD_REQUEST)
        meta = s.AdminProjectImageSerializer(data=request.data)
        meta.is_valid(raise_exception=True)
        with transaction.atomic():
            asset = ensure_valid(store_image, upload, "projects")
            image = meta.save(project=project, asset=asset, display_order=project.images.count())
            record(request, AuditLog.Action.UPLOAD, project, field="gallery_image", image_id=image.pk)
        return Response(s.AdminProjectImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"images/(?P<image_id>\d+)")
    def image_detail(self, request, pk=None, image_id=None):
        project = self.get_object()
        image = get_object_or_404(ProjectImage, pk=image_id, project=project)
        if request.method == "DELETE":
            record(request, AuditLog.Action.DELETE, project, field="gallery_image", image_id=image.pk)
            image.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = s.AdminProjectImageSerializer(image, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        serializer = s.ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        with transaction.atomic():
            projects = {p.pk: p for p in Project.objects.select_for_update().filter(pk__in=ids)}
            for order, project_id in enumerate(ids):
                if project_id in projects:
                    projects[project_id].display_order = order
            Project.objects.bulk_update(projects.values(), ["display_order"])
        record(request, AuditLog.Action.UPDATE, None, field="projects_reordered", count=len(projects))
        return Response({"updated": len(projects)})
