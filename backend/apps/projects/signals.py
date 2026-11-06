from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Project, ProjectImage


@receiver(post_delete, sender=Project)
def delete_project_cover(sender, instance, **kwargs):
    from apps.core.models import MediaAsset

    MediaAsset.objects.filter(pk__in=[pk for pk in (instance.cover_id, instance.architecture_image_id) if pk]).delete()


@receiver(post_delete, sender=ProjectImage)
def delete_gallery_asset(sender, instance, **kwargs):
    from apps.core.models import MediaAsset

    MediaAsset.objects.filter(pk=instance.asset_id).delete()
