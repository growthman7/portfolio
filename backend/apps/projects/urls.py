from rest_framework.routers import SimpleRouter

from .views import PublicCategoryViewSet, PublicProjectViewSet

router = SimpleRouter()
router.register("categories", PublicCategoryViewSet, basename="public-category")
router.register("projects", PublicProjectViewSet, basename="public-project")
urlpatterns = router.urls
