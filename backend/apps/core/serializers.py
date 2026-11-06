from __future__ import annotations

from rest_framework import serializers

from .i18n import TranslatedField, bilingual, translated
from .models import SiteProfile, SocialLink
from .services.uploads import asset_payload
from .validators.text import validate_no_control_chars, validate_single_line

EXPERTISE_MAX_ITEMS = 12


def _validate_expertise(value):
    if not isinstance(value, list) or len(value) > EXPERTISE_MAX_ITEMS:
        raise serializers.ValidationError(f"Liste de {EXPERTISE_MAX_ITEMS} éléments maximum attendue.")
    cleaned = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item) > 60:
            raise serializers.ValidationError("Chaque domaine doit être un texte de 1 à 60 caractères.")
        validate_single_line(item)
        cleaned.append(item.strip())
    return cleaned


# --------------------------------------------------------------------------- public
class PublicSocialLinkSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = SocialLink
        fields = ("platform", "url", "label")

    def get_label(self, obj) -> str:
        return obj.label or obj.get_platform_display()


class PublicProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    job_title = TranslatedField("job_title")
    tagline = TranslatedField("tagline")
    short_bio = TranslatedField("short_bio")
    about = TranslatedField("about")
    interests = TranslatedField("interests")
    vision = TranslatedField("vision")
    approach = TranslatedField("approach")
    ambitions = TranslatedField("ambitions")
    expertise = TranslatedField("expertise")
    signature = TranslatedField("signature")
    photo = serializers.SerializerMethodField()
    cv = serializers.SerializerMethodField()
    cv_alt = serializers.SerializerMethodField()
    social_links = serializers.SerializerMethodField()
    email = serializers.EmailField(source="email_public", read_only=True)
    phone = serializers.CharField(source="phone_public", read_only=True)

    class Meta:
        model = SiteProfile
        fields = (
            "first_name", "last_name", "full_name", "job_title", "tagline", "short_bio", "about",
            "interests", "vision", "approach", "ambitions", "expertise", "signature", "email", "phone", "location",
            "is_available", "photo", "cv", "cv_alt", "social_links", "updated_at",
        )

    def get_photo(self, obj):
        payload = asset_payload(obj.photo)
        if payload:
            payload["alt"] = translated(obj, "photo_alt", self.context["lang"]) or obj.full_name
        return payload

    def get_cv(self, obj):
        lang = self.context["lang"]
        asset = (obj.cv_en if lang == "en" else None) or obj.cv_fr or obj.cv_en
        return asset_payload(asset)

    def get_cv_alt(self, obj):
        """Second CV facultatif, avec son intitulé dans la langue demandée."""
        payload = asset_payload(obj.cv_alt)
        if payload:
            payload["label"] = translated(obj, "cv_alt_label", self.context["lang"])
        return payload

    def get_social_links(self, obj):
        links = [link for link in obj.social_links.all() if link.is_published]
        return PublicSocialLinkSerializer(links, many=True).data


# --------------------------------------------------------------------------- admin
class AdminSocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ("id", "platform", "url", "label", "is_published", "display_order", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def create(self, validated_data):
        validated_data["profile"] = SiteProfile.load()
        return super().create(validated_data)


class AdminProfileSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    cv_fr = serializers.SerializerMethodField()
    cv_en = serializers.SerializerMethodField()
    cv_alt = serializers.SerializerMethodField()
    og_image = serializers.SerializerMethodField()

    class Meta:
        model = SiteProfile
        fields = (
            "first_name", "last_name",
            *bilingual(
                "job_title", "tagline", "short_bio", "about", "interests", "vision", "approach", "ambitions",
                "expertise", "signature", "photo_alt", "seo_title", "seo_description", "cv_alt_label",
            ),
            "email_public", "phone_public", "location", "is_available", "photo", "cv_fr", "cv_en", "cv_alt", "og_image", "updated_at",
        )
        read_only_fields = ("updated_at",)

    def get_photo(self, obj):
        return asset_payload(obj.photo)

    def get_cv_fr(self, obj):
        return asset_payload(obj.cv_fr)

    def get_cv_en(self, obj):
        return asset_payload(obj.cv_en)

    def get_cv_alt(self, obj):
        return asset_payload(obj.cv_alt)

    def get_og_image(self, obj):
        return asset_payload(obj.og_image)

    def validate_expertise_fr(self, value):
        return _validate_expertise(value)

    def validate_expertise_en(self, value):
        return _validate_expertise(value)

    def validate(self, attrs):
        for value in attrs.values():
            if isinstance(value, str):
                validate_no_control_chars(value)
        return attrs
