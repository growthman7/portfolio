from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    name = "apps.projects"
    label = "projects"
    verbose_name = "Projets"

    def ready(self) -> None:
        from . import signals  # noqa: F401
