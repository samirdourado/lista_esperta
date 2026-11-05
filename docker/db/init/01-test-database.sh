#!/bin/sh
# Runs once, on the first start of an empty volume.
# Creates the database used by the backend e2e tests in the same container.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE ${POSTGRES_DB}_test OWNER "$POSTGRES_USER";
EOSQL
