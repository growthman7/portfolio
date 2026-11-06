from rest_framework import serializers

from apps.core.validators.text import validate_no_control_chars

from .models import ContactMessage


class ContactCreateSerializer(serializers.ModelSerializer):
    # Champ piège invisible pour les humains : doit rester vide.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=200)
    form_token = serializers.CharField(write_only=True, max_length=500)
    consent = serializers.BooleanField(write_only=True)

    class Meta:
        model = ContactMessage
        fields = ("name", "email", "subject", "message", "language", "website", "form_token", "consent")
        extra_kwargs = {
            "name": {"min_length": 2},
            "subject": {"min_length": 3},
            "message": {"min_length": 10},
            "language": {"required": False},
        }

    def validate_language(self, value):
        return value if value in ("fr", "en") else "fr"

    def validate_consent(self, value):
        if value is not True:
            raise serializers.ValidationError("Votre accord est nécessaire pour traiter votre message.")
        return value

    def validate(self, attrs):
        for key in ("name", "subject", "message"):
            validate_no_control_chars(attrs.get(key, ""))
        return attrs


class AdminContactMessageSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ContactMessage
        fields = ("id", "name", "email", "subject", "message", "language", "status", "status_label", "created_at", "read_at")
        read_only_fields = ("id", "name", "email", "subject", "message", "language", "created_at", "read_at")
