from django.utils.text import slugify

from .validators.text import validate_no_control_chars


class SlugMixin:
    """Génère un slug unique à partir d'un champ source et refuse les caractères de contrôle."""

    slug_source = "name_fr"

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for value in attrs.values():
            if isinstance(value, str):
                validate_no_control_chars(value)
        if not attrs.get("slug") and not (self.instance and self.instance.slug):
            source = attrs.get(self.slug_source) or ""
            slug = slugify(source)[:50] or "element"
            base, index = slug, 2
            model = self.Meta.model
            while model.objects.filter(slug=slug).exists():
                slug, index = f"{base}-{index}", index + 1
            attrs["slug"] = slug
        return attrs
