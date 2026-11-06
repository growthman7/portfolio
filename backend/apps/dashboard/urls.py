from django.urls import path

from . import views

urlpatterns = [
    path("", views.app_view, name="dashboard"),
    path("connexion/", views.login_view, name="dashboard-login"),
    path("reinitialisation/", views.password_reset_view, name="dashboard-password-reset-request"),
    path("reinitialisation/<str:uidb64>/<str:token>/", views.password_reset_view, name="dashboard-password-reset"),
]
