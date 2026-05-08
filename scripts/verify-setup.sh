#!/usr/bin/env bash
# Script de vérification rapide de l'environnement de développement
# Usage : bash scripts/verify-setup.sh

set -e

echo "🔍 Vérification de l'environnement LMS Gestion..."
echo ""

# Node version
NODE_VERSION=$(node --version 2>/dev/null || echo "absent")
echo "📦 Node     : $NODE_VERSION"
if [[ "$NODE_VERSION" != v20.* && "$NODE_VERSION" != v21.* && "$NODE_VERSION" != v22.* ]]; then
  echo "  ❌ Node 20+ requis (actuel: $NODE_VERSION)"
  exit 1
fi

# pnpm version
PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "absent")
echo "📦 pnpm     : $PNPM_VERSION"
if [[ "$PNPM_VERSION" == "absent" ]]; then
  echo "  ❌ pnpm requis : npm install -g pnpm@9.12.0"
  exit 1
fi

# Fichiers .env
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local manquant — copie .env.example puis rempli les valeurs"
  exit 1
fi
echo "🔐 .env.local : présent"

# Dépendances installées
if [[ ! -d node_modules ]] || [[ ! -d node_modules/.pnpm ]]; then
  echo "❌ Dépendances pas installées — lance 'pnpm install'"
  exit 1
fi
echo "📚 node_modules : OK"

# DATABASE_URL valide ?
if ! grep -q "^DATABASE_URL=postgresql" .env.local; then
  echo "⚠️  DATABASE_URL absent ou invalide dans .env.local"
fi

# Supabase URL renseigné ?
if ! grep -q "^NEXT_PUBLIC_SUPABASE_URL=https" .env.local; then
  echo "⚠️  NEXT_PUBLIC_SUPABASE_URL absent dans .env.local"
fi

echo ""
echo "✅ Environnement OK. Tu peux lancer : pnpm dev"
