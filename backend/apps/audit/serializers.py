from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source="actor.get_username", default=None, read_only=True)
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = ("id", "created_at", "action", "action_label", "actor", "target_type", "target_id", "target_label", "metadata")
        read_only_fields = fields
