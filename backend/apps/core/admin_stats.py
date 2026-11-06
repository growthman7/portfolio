"""Statistiques de la vue d'ensemble du dashboard (page React d'administration)."""
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.career.models import Achievement, Certification, Education, Experience
from apps.contact.models import ContactMessage
from apps.contact.serializers import AdminContactMessageSerializer
from apps.projects.models import Project
from apps.skills.models import Skill

from .permissions import IsPortfolioAdmin


class DashboardStatsView(APIView):
    permission_classes = (IsPortfolioAdmin,)

    def get(self, request):
        now = timezone.now()
        since = now - timedelta(days=30)
        week = now - timedelta(days=7)

        daily = dict(
            ContactMessage.objects.filter(created_at__gte=since)
            .annotate(day=TruncDate("created_at"))
            .values_list("day")
            .annotate(total=Count("id"))
            .values_list("day", "total")
        )
        timeline = []
        for offset in range(29, -1, -1):
            day = (now - timedelta(days=offset)).date()
            timeline.append({"date": day.isoformat(), "count": daily.get(day, 0)})

        logins = AuditLog.objects.filter(created_at__gte=week)
        return Response(
            {
                "projects": {
                    "total": Project.objects.count(),
                    "published": Project.objects.filter(is_published=True).count(),
                    "drafts": Project.objects.filter(is_published=False).count(),
                    "samples_published": Project.objects.filter(is_published=True, is_sample=True).count(),
                },
                "skills": {"total": Skill.objects.count(), "published": Skill.objects.filter(is_published=True).count()},
                "career": {
                    "experiences": Experience.objects.count(),
                    "educations": Education.objects.count(),
                    "certifications": Certification.objects.count(),
                    "achievements": Achievement.objects.count(),
                },
                "messages": {
                    "new": ContactMessage.objects.filter(status=ContactMessage.Status.NEW).count(),
                    "total": ContactMessage.objects.exclude(status=ContactMessage.Status.SPAM).count(),
                    "last_30_days": sum(item["count"] for item in timeline),
                    "timeline": timeline,
                    "latest": AdminContactMessageSerializer(ContactMessage.objects.all()[:5], many=True).data,
                },
                "security": {
                    "failed_logins_7d": logins.filter(action=AuditLog.Action.LOGIN_FAILED).count(),
                    "lockouts_7d": logins.filter(action=AuditLog.Action.LOGIN_LOCKED).count(),
                    "spam_blocked_7d": logins.filter(action=AuditLog.Action.CONTACT_SPAM).count(),
                    "last_login": request.user.last_login,
                },
                "recent_activity": AuditLogSerializer(AuditLog.objects.select_related("actor")[:10], many=True).data,
            }
        )
