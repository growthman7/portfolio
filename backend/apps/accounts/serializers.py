from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Mot de passe actuel incorrect."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    new_password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)


class AdminCreateSerializer(serializers.Serializer):
    """Nouvel administrateur : l'adresse e-mail sert d'identifiant de connexion."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)
    password_confirm = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if get_user_model().objects.filter(Q(email__iexact=value) | Q(username__iexact=value)).exists():
            raise serializers.ValidationError("Un compte utilise déjà cette adresse e-mail.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        candidate = get_user_model()(
            username=attrs["email"], email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"]
        )
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs
