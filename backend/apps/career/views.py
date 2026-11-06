from django.db.models import Prefetch
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.i18n import get_request_language
from apps.core.throttling import ScopedIpThrottle
from apps.core.viewsets import AdminModelViewSet

from . import serializers as s
from .models import Achievement, Certification, Education, Experience, Mission


def career_payload(lang: str) -> dict:
    context = {"lang": lang}
    experiences = (
        Experience.objects.filter(is_published=True)
        .prefetch_related(Prefetch("missions", queryset=Mission.objects.order_by("display_order", "id")), "technologies")
    )
    return {
        "experiences": s.PublicExperienceSerializer(experiences, many=True, context=context).data,
        "educations": s.PublicEducationSerializer(Education.objects.filter(is_published=True), many=True, context=context).data,
        "certifications": s.PublicCertificationSerializer(Certification.objects.filter(is_published=True), many=True).data,
        "achievements": s.PublicAchievementSerializer(Achievement.objects.filter(is_published=True), many=True, context=context).data,
    }


class PublicCareerView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (ScopedIpThrottle,)
    throttle_scope = "public"

    def get(self, request):
        return Response(career_payload(get_request_language(request)), headers={"Cache-Control": "public, max-age=60"})


class AdminExperienceViewSet(AdminModelViewSet):
    serializer_class = s.AdminExperienceSerializer
    queryset = Experience.objects.prefetch_related("missions", "technologies")


class AdminEducationViewSet(AdminModelViewSet):
    serializer_class = s.AdminEducationSerializer
    queryset = Education.objects.all()


class AdminCertificationViewSet(AdminModelViewSet):
    serializer_class = s.AdminCertificationSerializer
    queryset = Certification.objects.all()


class AdminAchievementViewSet(AdminModelViewSet):
    serializer_class = s.AdminAchievementSerializer
    queryset = Achievement.objects.all()
