from django.urls import path, re_path
from rest_framework.parsers import MultiPartParser
from rest_framework.routers import SimpleRouter

from .views import AdminProfileViewSet, AdminSocialLinkViewSet

router = SimpleRouter()
router.register("social-links", AdminSocialLinkViewSet, basename="admin-social-link")

profile = AdminProfileViewSet.as_view({"get": "list", "patch": "partial_update"})
upload = {"parser_classes": [MultiPartParser]}
photo = AdminProfileViewSet.as_view({"post": "photo", "delete": "photo"}, **upload)
og_image = AdminProfileViewSet.as_view({"post": "og_image", "delete": "og_image"}, **upload)
cv = AdminProfileViewSet.as_view({"post": "cv", "delete": "cv"}, **upload)

urlpatterns = [
    path("profile/", profile, name="admin-profile"),
    path("profile/photo/", photo, name="admin-profile-photo"),
    path("profile/og-image/", og_image, name="admin-profile-og-image"),
    re_path(r"^profile/cv/(?P<lang>fr|en)/$", cv, name="admin-profile-cv"),
    *router.urls,
]
