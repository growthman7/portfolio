from django.db.models import Prefetch

from apps.core.viewsets import AdminModelViewSet, PublicReadOnlyViewSet

from . import serializers as s
from .models import Skill, SkillCategory


class PublicSkillCategoryViewSet(PublicReadOnlyViewSet):
    serializer_class = s.PublicSkillCategorySerializer

    def get_queryset(self):
        return (
            SkillCategory.objects.filter(skills__is_published=True)
            .distinct()
            .prefetch_related(Prefetch("skills", queryset=Skill.objects.order_by("display_order", "id")))
        )


class AdminSkillCategoryViewSet(AdminModelViewSet):
    serializer_class = s.AdminSkillCategorySerializer
    queryset = SkillCategory.objects.all()
    pagination_class = None


class AdminSkillViewSet(AdminModelViewSet):
    serializer_class = s.AdminSkillSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = Skill.objects.select_related("category")
        category = self.request.query_params.get("category", "")
        if category.isdigit():
            queryset = queryset.filter(category_id=int(category))
        return queryset
