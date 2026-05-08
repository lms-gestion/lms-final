#!/usr/bin/env bash
# ⚠️ DANGER : reset complet de la base de dev
# Utilise uniquement en local, jamais en prod.

set -e

if [[ "$NODE_ENV" == "production" ]]; then
  echo "❌ Refus d'exécuter en production"
  exit 1
fi

read -p "⚠️  Cela va DÉTRUIRE toutes les données de dev. Confirmer ? (yes/no) " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Annulé"
  exit 0
fi

echo "🗑  Drop du schema public..."
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "🔄 Re-application des migrations..."
pnpm db:migrate

echo "🔒 Re-application RLS..."
psql "$DATABASE_URL" -f infra/supabase/rls.sql

echo "🌱 Seed..."
pnpm db:seed

echo "✅ Base réinitialisée"
