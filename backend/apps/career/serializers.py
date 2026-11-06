from django.db import transaction
from rest_framework import serializers

from apps.core.i18n import TranslatedField, bilingual
from apps.core.validators.text import validate_no_control_chars
from apps.projects.models import Technology
from apps.projects.serializers import PublicTechnologySerializer

from .models import Achievement, Certification, Education, Experience, Mission

MAX_MISSIONS = 20


# --------------------------------------------------------------------------- public
class PublicMissionSerializer(serializers.ModelSerializer):
    description = TranslatedField("description")

    class Meta:
        model = Mission
        fields = ("description",)


class PublicExperienceSerializer(serializers.ModelSerializer):
    title = TranslatedField("title")
    summary = TranslatedField("summary")
    missions = serializers.SerializerMethodField()
    technologies = serializers.SerializerMethodField()

    class Meta:
        model = Experience
        fields = ("kind", "title", "organization", "location", "start_date", "end_date", "summary", "missions", "technologies")

    def get_missions(self, obj):
        # Liste de chaînes ; le texte anglais retombe sur le français s'il est vide.
        data = PublicMissionSerializer(obj.missions.all(), many=True, context=self.context).data
        return [item["description"] for item in data if item["description"]]

    def get_technologies(self, obj):
        return [tech.name for tech in obj.technologies.all()]


class PublicEducationSerializer(serializers.ModelSerializer):
    degree = TranslatedField("degree")
    field = TranslatedField("field")
    description = TranslatedField("description")

    class Meta:
        model = Education
        fields = ("degree", "field", "institution", "location", "start_date", "end_date", "is_degree", "description")


class PublicCertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ("name", "issuer", "issued_on", "expires_on", "credential_id", "credential_url")


class PublicAchievementSerializer(serializers.ModelSerializer):
    title = TranslatedField("title")
    description = TranslatedField("description")

    class Meta:
        model = Achievement
        fields = ("title", "date", "description", "url")


# --------------------------------------------------------------------------- admin
class _CleanTextMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        for value in attrs.values():
            if isinstance(value, str):
                validate_no_control_chars(value)
        return attrs


class _DatesMixin:
    start_field = "start_date"
    end_field = "end_date"

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get(self.start_field, getattr(self.instance, self.start_field, None))
        end = attrs.get(self.end_field, getattr(self.instance, self.end_field, None))
        if start and end and end < start:
            raise serializers.ValidationError({self.end_field: "La date de fin doit suivre la date de début."})
        return attrs


class AdminMissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mission
        fields = ("id", *bilingual("description"), "display_order")
        read_only_fields = ("id",)


class AdminExperienceSerializer(_DatesMixin, _CleanTextMixin, serializers.ModelSerializer):
    missions = AdminMissionSerializer(many=True, required=False)
    technologies = serializers.PrimaryKeyRelatedField(queryset=Technology.objects.all(), many=True, required=False)

    class Meta:
        model = Experience
        fields = (
            "id", "kind", *bilingual("title", "summary"), "organization", "location", "start_date", "end_date",
            "technologies", "missions", "is_published", "display_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_missions(self, value):
        if len(value) > MAX_MISSIONS:
            raise serializers.ValidationError(f"{MAX_MISSIONS} missions maximum.")
        return value

    def _save_missions(self, experience, missions):
        # Remplacement complet : la liste envoyée devient la liste de référence.
        experience.missions.all().delete()
        Mission.objects.bulk_create(
            Mission(experience=experience, display_order=data.get("display_order", index), **{
                key: value for key, value in data.items() if key != "display_order"
            })
            for index, data in enumerate(missions)
        )

    @transaction.atomic
    def create(self, validated_data):
        missions = validated_data.pop("missions", [])
        experience = super().create(validated_data)
        self._save_missions(experience, missions)
        return experience

    @transaction.atomic
    def update(self, instance, validated_data):
        missions = validated_data.pop("missions", None)
        experience = super().update(instance, validated_data)
        if missions is not None:
            self._save_missions(experience, missions)
        return experience


class AdminEducationSerializer(_DatesMixin, _CleanTextMixin, serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = (
            "id", *bilingual("degree", "field", "description"), "institution", "location", "start_date", "end_date",
            "is_degree", "is_published", "display_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AdminCertificationSerializer(_DatesMixin, _CleanTextMixin, serializers.ModelSerializer):
    start_field = "issued_on"
    end_field = "expires_on"

    class Meta:
        model = Certification
        fields = (
            "id", "name", "issuer", "issued_on", "expires_on", "credential_id", "credential_url",
            "is_published", "display_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AdminAchievementSerializer(_CleanTextMixin, serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = (
            "id", *bilingual("title", "description"), "date", "url",
            "is_published", "display_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
