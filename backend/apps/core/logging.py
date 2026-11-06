"""Filtre de journalisation qui masque toute valeur ressemblant à un secret."""
import logging
import re

_SECRET_PATTERN = re.compile(
    r"(?i)(password|passwd|token|secret|csrf|session(?:id)?|authorization|cookie|api[_-]?key)"
    r"(\s*[=:]\s*)([^\s,;&]+)"
)


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover
            return True
        redacted = _SECRET_PATTERN.sub(r"\1\2[MASQUÉ]", message)
        if redacted != message:
            record.msg, record.args = redacted, ()
        return True
