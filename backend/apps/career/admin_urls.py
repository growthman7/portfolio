from rest_framework.routers import SimpleRouter

from .views import AdminAchievementViewSet, AdminCertificationViewSet, AdminEducationViewSet, AdminExperienceViewSet

router = SimpleRouter()
router.register("experiences", AdminExperienceViewSet, basename="admin-experience")
router.register("educations", AdminEducationViewSet, basename="admin-education")
router.register("certifications", AdminCertificationViewSet, basename="admin-certification")
router.register("achievements", AdminAchievementViewSet, basename="admin-achievement")
urlpatterns = router.urls
