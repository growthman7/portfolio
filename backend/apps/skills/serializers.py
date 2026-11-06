from rest_framework import serializers

from apps.core.i18n import TranslatedField, bilingual
from apps.core.serializer_mixins import SlugMixin

from .models import Skill, SkillCategory


class PublicSkillSerializer(serializers.ModelSerializer):
    level = serializers.CharField(read_only=True)

    class Meta:
        model = Skill
        fields = ("name", "level", "years")


class PublicSkillCategorySerializer(serializers.ModelSerializer):
    name = TranslatedField("name")
    skills = serializers.SerializerMethodField()

    class Meta:
        model = SkillCategory
        fields = ("kind", "slug", "name", "skills")

    def get_skills(self, obj):
        return PublicSkillSerializer([skill for skill in obj.skills.all() if skill.is_published], many=True).data


class AdminSkillCategorySerializer(SlugMixin, serializers.ModelSerializer):
    skill_count = serializers.IntegerField(source="skills.count", read_only=True)

    class Meta:
        model = SkillCategory
        fields = ("id", "kind", *bilingual("name"), "slug", "display_order", "skill_count", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"slug": {"required": False}}


class AdminSkillSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=SkillCategory.objects.all())

    class Meta:
        model = Skill
        fields = ("id", "category", "name", "level", "years", "is_published", "display_order", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"years": {"max_value": 60}}
