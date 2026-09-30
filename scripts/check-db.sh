#!/usr/bin/env bash
# Vérifie les migrations SQL sur un Postgres local jetable (sans Supabase).
# Usage : DATABASE_URL=postgres://user@localhost:5432/postgres scripts/check-db.sh
# La base indiquée doit être vide : le script crée une base temporaire à côté.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Définis DATABASE_URL (un Postgres local, jamais la base Supabase)}"

db="halma_check_$$"
psql "$DATABASE_URL" -qc "create database $db"
trap 'psql "$DATABASE_URL" -qc "drop database if exists $db"' EXIT
url="${DATABASE_URL%/*}/$db"

psql "$url" -q -v ON_ERROR_STOP=1 -f supabase/checks/auth-stub.sql
for migration in supabase/migrations/*.sql; do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$migration"
done
for check in supabase/checks/*-check.sql; do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$check"
done
