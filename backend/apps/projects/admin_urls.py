from rest_framework.routers import SimpleRouter

from .views import AdminCategoryViewSet, AdminProjectViewSet, AdminTechnologyViewSet

router = SimpleRouter()
router.register("categories", AdminCategoryViewSet, basename="admin-category")
router.register("technologies", AdminTechnologyViewSet, basename="admin-technology")
router.register("projects", AdminProjectViewSet, basename="admin-project")
urlpatterns = router.urls
