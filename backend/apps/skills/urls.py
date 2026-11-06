from rest_framework.routers import SimpleRouter

from .views import PublicSkillCategoryViewSet

router = SimpleRouter()
router.register("skills", PublicSkillCategoryViewSet, basename="public-skills")
urlpatterns = router.urls
