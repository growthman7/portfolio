from django.urls import path

from .views import ContactCreateView, ContactTokenView

urlpatterns = [
    path("contact/", ContactCreateView.as_view(), name="public-contact"),
    path("contact/token/", ContactTokenView.as_view(), name="public-contact-token"),
]
