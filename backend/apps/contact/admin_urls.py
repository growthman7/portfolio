from rest_framework.routers import SimpleRouter

from .views import AdminContactMessageViewSet

router = SimpleRouter()
router.register("messages", AdminContactMessageViewSet, basename="admin-message")
urlpatterns = router.urls
