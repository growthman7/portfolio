from django.urls import path

from .views import PublicCareerView

urlpatterns = [path("career/", PublicCareerView.as_view(), name="public-career")]
