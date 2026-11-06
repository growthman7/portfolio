from rest_framework.routers import SimpleRouter

from .views import AdminSkillCategoryViewSet, AdminSkillViewSet

router = SimpleRouter()
router.register("skill-categories", AdminSkillCategoryViewSet, basename="admin-skill-category")
router.register("skills", AdminSkillViewSet, basename="admin-skill")
urlpatterns = router.urls
