from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"
    label = "core"
    verbose_name = "Cœur du portfolio"

    def ready(self) -> None:
        from . import signals  # noqa: F401
