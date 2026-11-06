from rest_framework.routers import SimpleRouter

from .views import AuditLogViewSet

router = SimpleRouter()
router.register("audit-log", AuditLogViewSet, basename="admin-audit-log")
urlpatterns = router.urls
