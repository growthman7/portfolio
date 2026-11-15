from django.urls import path

from . import views

urlpatterns = [
    path("admins/", views.AdminListCreateView.as_view(), name="admin-admins"),
    path("admins/<int:pk>/", views.AdminDeleteView.as_view(), name="admin-admin-detail"),
]
