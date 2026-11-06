"""Nettoyage des fichiers et régénération du référencement après modification du contenu."""
import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import MediaAsset

logger = logging.getLogger("portfolio.requests")


@receiver(post_delete, sender=MediaAsset)
def delete_media_files(sender, instance, **kwargs):
    from .services.uploads import delete_asset_files

    transaction.on_commit(lambda: delete_asset_files(instance))


def _schedule_seo_refresh(**kwargs):
    from .services.seo import regenerate_quietly

    transaction.on_commit(regenerate_quietly)


def connect_seo_signals():
    from apps.core.models import SiteProfile
    from apps.projects.models import Project

    for model in (SiteProfile, Project):
        post_save.connect(_schedule_seo_refresh, sender=model, dispatch_uid=f"seo-save-{model.__name__}")
        post_delete.connect(_schedule_seo_refresh, sender=model, dispatch_uid=f"seo-delete-{model.__name__}")


connect_seo_signals()
