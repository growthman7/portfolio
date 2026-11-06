from django.urls import path

from .views import PublicProfileView, PublicSiteView

urlpatterns = [
    path("site/", PublicSiteView.as_view(), name="public-site"),
    path("profile/", PublicProfileView.as_view(), name="public-profile"),
]
