from rest_framework import viewsets

from apps.core.permissions import ADMIN_PERMISSION_CLASSES

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = ADMIN_PERMISSION_CLASSES
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related("actor")

    def get_queryset(self):
        queryset = super().get_queryset()
        action = self.request.query_params.get("action")
        if action in AuditLog.Action.values:
            queryset = queryset.filter(action=action)
        return queryset
