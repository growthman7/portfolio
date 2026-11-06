from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.core.i18n import TranslatedField, bilingual, translated
from apps.core.serializer_mixins import SlugMixin
from apps.core.services.uploads import asset_payload

from .models import Category, Project, ProjectChallenge, ProjectImage, Technology

MAX_CHALLENGES = 12


def _image(asset, obj, base, lang, fallback=""):
    payload = asset_payload(asset)
    if payload:
        payload["alt"] = translated(obj, base, lang) or fallback
    return payload


# --------------------------------------------------------------------------- public
class PublicCategorySerializer(serializers.ModelSerializer):
    name = TranslatedField("name")

    class Meta:
        model = Category
        fields = ("slug", "name")


class PublicTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ("slug", "name")


class PublicProjectCardSerializer(serializers.ModelSerializer):
    title = TranslatedField("title")
    summary = TranslatedField("summary")
    category = PublicCategorySerializer(read_only=True)
    technologies = PublicTechnologySerializer(many=True, read_only=True)
    cover = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "slug", "title", "summary", "category", "technologies", "cover", "demo_url", "repo_url",
            "is_featured", "is_sample", "started_on",
        )

    def get_cover(self, obj):
        lang = self.context["lang"]
        return _image(obj.cover, obj, "cover_alt", lang, translated(obj, "title", lang))


class PublicProjectImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    caption = TranslatedField("caption")

    class Meta:
        model = ProjectImage
        fields = ("image", "caption")

    def get_image(self, obj):
        return _image(obj.asset, obj, "alt", self.context["lang"])


class PublicChallengeSerializer(serializers.ModelSerializer):
    challenge = TranslatedField("challenge")
    solution = TranslatedField("solution")

    class Meta:
        model = ProjectChallenge
        fields = ("challenge", "solution")


class PublicProjectDetailSerializer(PublicProjectCardSerializer):
    context = TranslatedField("context")
    problem = TranslatedField("problem")
    objectives = TranslatedField("objectives")
    features = TranslatedField("features")
    architecture = TranslatedField("architecture")
    results = TranslatedField("results")
    architecture_image = serializers.SerializerMethodField()
    images = PublicProjectImageSerializer(many=True, read_only=True)
    challenges = PublicChallengeSerializer(many=True, read_only=True)
    previous = serializers.SerializerMethodField()
    next = serializers.SerializerMethodField()

    class Meta(PublicProjectCardSerializer.Meta):
        fields = PublicProjectCardSerializer.Meta.fields + (
            "ended_on", "context", "problem", "objectives", "features", "architecture", "architecture_image",
            "images", "challenges", "results", "previous", "next",
        )

    def get_architecture_image(self, obj):
        return _image(obj.architecture_image, obj, "architecture_alt", self.context["lang"])

    def _neighbour(self, obj, offset):
        """Projets voisins dans l'ordre d'affichage de la galerie (navigation précédent / suivant)."""
        order = self.context.get("order") or []
        if obj.pk not in order:
            return None
        index = order.index(obj.pk) + offset
        if not 0 <= index < len(order):
            return None
        neighbour = self.context["neighbours"][order[index]]
        return {"slug": neighbour.slug, "title": translated(neighbour, "title", self.context["lang"])}

    def get_previous(self, obj):
        return self._neighbour(obj, -1)

    def get_next(self, obj):
        return self._neighbour(obj, 1)


# --------------------------------------------------------------------------- admin
class AdminCategorySerializer(SlugMixin, serializers.ModelSerializer):
    project_count = serializers.IntegerField(source="projects.count", read_only=True)

    class Meta:
        model = Category
        fields = ("id", *bilingual("name"), "slug", "display_order", "project_count", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"slug": {"required": False}}


class AdminTechnologySerializer(SlugMixin, serializers.ModelSerializer):
    slug_source = "name"

    class Meta:
        model = Technology
        fields = ("id", "name", "slug", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"slug": {"required": False}}


class AdminProjectImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProjectImage
        fields = ("id", "image", *bilingual("alt", "caption"), "display_order")
        read_only_fields = ("id", "image")

    def get_image(self, obj):
        return asset_payload(obj.asset)


class AdminChallengeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectChallenge
        fields = ("id", *bilingual("challenge", "solution"), "display_order")
        read_only_fields = ("id",)


class AdminProjectSerializer(SlugMixin, serializers.ModelSerializer):
    slug_source = "title_fr"
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    technologies = serializers.PrimaryKeyRelatedField(queryset=Technology.objects.all(), many=True, required=False)
    challenges = AdminChallengeSerializer(many=True, required=False)
    cover = serializers.SerializerMethodField()
    architecture_image = serializers.SerializerMethodField()
    images = AdminProjectImageSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = (
            "id", "slug",
            *bilingual("title", "summary", "context", "problem", "objectives", "features", "architecture",
                       "results", "cover_alt", "architecture_alt"),
            "category", "technologies", "challenges", "cover", "architecture_image", "images",
            "demo_url", "repo_url", "started_on", "ended_on",
            "is_featured", "is_sample", "is_published", "display_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "cover", "architecture_image", "images", "created_at", "updated_at")
        extra_kwargs = {"slug": {"required": False}}

    def get_cover(self, obj):
        return asset_payload(obj.cover)

    def get_architecture_image(self, obj):
        return asset_payload(obj.architecture_image)

    def validate_challenges(self, value):
        if len(value) > MAX_CHALLENGES:
            raise serializers.ValidationError(f"{MAX_CHALLENGES} paires maximum.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        started = attrs.get("started_on", getattr(self.instance, "started_on", None))
        ended = attrs.get("ended_on", getattr(self.instance, "ended_on", None))
        if started and ended and ended < started:
            raise serializers.ValidationError({"ended_on": "La date de fin doit suivre la date de début."})
        return attrs

    def _save_challenges(self, project, challenges):
        # La liste envoyée remplace entièrement la précédente.
        project.challenges.all().delete()
        ProjectChallenge.objects.bulk_create(
            ProjectChallenge(project=project, **{**data, "display_order": data.get("display_order", index)})
            for index, data in enumerate(challenges)
        )

    @transaction.atomic
    def create(self, validated_data):
        challenges = validated_data.pop("challenges", [])
        project = super().create(validated_data)
        self._save_challenges(project, challenges)
        return project

    @transaction.atomic
    def update(self, instance, validated_data):
        challenges = validated_data.pop("challenges", None)
        project = super().update(instance, validated_data)
        if challenges is not None:
            self._save_challenges(project, challenges)
        return project


class ReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False, max_length=500)
