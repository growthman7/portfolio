"""Gestion des contenus bilingues (champs `<nom>_fr` / `<nom>_en`)."""
from django.conf import settings
from rest_framework import serializers


def get_request_language(request) -> str:
    if request is None:
        return settings.PORTFOLIO_LANGUAGES[0]
    lang = (request.query_params.get("lang") if hasattr(request, "query_params") else request.GET.get("lang")) or ""
    lang = lang.lower()[:2]
    return lang if lang in settings.PORTFOLIO_LANGUAGES else settings.PORTFOLIO_LANGUAGES[0]


def translated(obj, base: str, lang: str):
    """Renvoie la traduction demandée, ou le français si la traduction est vide."""
    value = getattr(obj, f"{base}_{lang}", None)
    if value in (None, "", []):
        value = getattr(obj, f"{base}_{settings.PORTFOLIO_LANGUAGES[0]}", "")
    return value


class TranslatedField(serializers.Field):
    def __init__(self, base: str, **kwargs):
        kwargs["source"] = "*"
        kwargs["read_only"] = True
        super().__init__(**kwargs)
        self.base = base

    def to_representation(self, obj):
        return translated(obj, self.base, self.context.get("lang", settings.PORTFOLIO_LANGUAGES[0]))


def bilingual(*bases: str) -> list[str]:
    """`bilingual("title")` -> ["title_fr", "title_en"] pour les serializers d'administration."""
    return [f"{base}_{lang}" for base in bases for lang in settings.PORTFOLIO_LANGUAGES]
