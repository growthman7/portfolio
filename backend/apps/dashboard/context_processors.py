from django.conf import settings


def dashboard(request):
    return {
        "DASHBOARD_PREFIX": settings.DASHBOARD_PREFIX,
        "PASSWORD_RESET_ENABLED": settings.PASSWORD_RESET_ENABLED,
    }
