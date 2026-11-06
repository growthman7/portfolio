#!/bin/sh
# Exécuté une seule fois à la création du volume PostgreSQL.
# Crée un rôle applicatif aux droits limités (principe du moindre privilège) :
# il lit et écrit les données mais ne peut ni créer, ni modifier, ni supprimer de tables.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO "$POSTGRES_USER";
CREATE ROLE "$APP_DB_USER" LOGIN PASSWORD '$APP_DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$APP_DB_USER";
GRANT USAGE ON SCHEMA public TO "$APP_DB_USER";
ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$APP_DB_USER";
ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "$APP_DB_USER";
SQL
