"""
Validation générique des requêtes d'API, avant toute logique métier :
- seules les méthodes HTTP attendues sont acceptées ;
- les écritures doivent annoncer un Content-Type JSON (ou multipart sur les routes de téléversement) ;
- la taille annoncée du corps est bornée.
La validation fine des données est faite par les serializers DRF.
"""
from django.conf import settings
from django.http import JsonResponse

ALLOWED_METHODS = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}
WRITE_METHODS = {"POST", "PUT", "PATCH"}
UPLOAD_SUFFIXES = ("/cover/", "/images/", "/photo/", "/cv/fr/", "/cv/en/", "/og-image/", "/architecture-image/")


class RequestValidationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        if request.method not in ALLOWED_METHODS:
            return JsonResponse({"detail": "Méthode non autorisée."}, status=405)

        if request.method in WRITE_METHODS:
            try:
                length = int(request.META.get("CONTENT_LENGTH") or 0)
            except ValueError:
                return JsonResponse({"detail": "Requête invalide."}, status=400)
            if length > settings.DATA_UPLOAD_MAX_MEMORY_SIZE:
                return JsonResponse({"detail": "Contenu trop volumineux."}, status=413)

            content_type = (request.content_type or "").lower()
            is_upload_route = request.path.endswith(UPLOAD_SUFFIXES)
            allowed = {"multipart/form-data"} if is_upload_route else {"application/json"}
            if length and content_type not in allowed:
                return JsonResponse({"detail": "Type de contenu non pris en charge."}, status=415)

        return self.get_response(request)
