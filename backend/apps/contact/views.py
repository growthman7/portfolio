from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.net import request_ip_hash
from apps.core.permissions import ADMIN_PERMISSION_CLASSES
from apps.core.throttling import ContactDailyThrottle, ContactHourlyThrottle, ScopedIpThrottle
from apps.core.viewsets import EnforceCSRFMixin

from .models import ContactMessage
from .serializers import AdminContactMessageSerializer, ContactCreateSerializer
from .services import check_form_token, issue_form_token, notify_owner

SUCCESS = {"detail": "Merci, votre message a bien été envoyé."}


class ContactTokenView(APIView):
    """Délivre le jeton horodaté que le formulaire doit renvoyer (protection anti-robots)."""

    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedIpThrottle,)
    throttle_scope = "public"

    def get(self, request):
        return Response({"form_token": issue_form_token()}, headers={"Cache-Control": "no-store"})


class ContactCreateView(EnforceCSRFMixin, APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ContactHourlyThrottle, ContactDailyThrottle)

    def post(self, request):
        serializer = ContactCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Robot détecté : réponse identique à un succès (pour ne pas l'aider), rien n'est enregistré.
        if data.get("website") or not check_form_token(data["form_token"]):
            record(request, AuditLog.Action.CONTACT_SPAM, reason="honeypot" if data.get("website") else "token")
            return Response(SUCCESS, status=status.HTTP_201_CREATED)

        for key in ("website", "form_token", "consent"):
            data.pop(key, None)
        message = ContactMessage.objects.create(
            **data,
            ip_hash=request_ip_hash(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:200],
        )
        transaction.on_commit(lambda: notify_owner(message))
        return Response(SUCCESS, status=status.HTTP_201_CREATED)


class AdminContactMessageViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    permission_classes = ADMIN_PERMISSION_CLASSES
    serializer_class = AdminContactMessageSerializer

    def get_queryset(self):
        queryset = ContactMessage.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter in ContactMessage.Status.values:
            queryset = queryset.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(subject__icontains=search[:80]) | queryset.filter(email__icontains=search[:80])
        return queryset

    def retrieve(self, request, *args, **kwargs):
        message = self.get_object()
        if message.status == ContactMessage.Status.NEW:
            message.status = ContactMessage.Status.READ
            message.read_at = timezone.now()
            message.save(update_fields=["status", "read_at", "updated_at"])
        return Response(self.get_serializer(message).data)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status != ContactMessage.Status.NEW and instance.read_at is None:
            instance.read_at = timezone.now()
            instance.save(update_fields=["read_at"])
        record(self.request, AuditLog.Action.UPDATE, instance, status=instance.status)

    def perform_destroy(self, instance):
        record(self.request, AuditLog.Action.DELETE, instance)
        instance.delete()
