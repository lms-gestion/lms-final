# LMS Gestion — SaaS

Application de gestion pour **La Maison des Services** et les futures entités du holding.

> Pour les détails fonctionnels, voir [docs/CADRAGE-PHASE-1.md](./docs/CADRAGE-PHASE-1.md) et le dossier [docs/specs/](./docs/specs/).

---

## Démarrage rapide

```bash
# 1. Installer Node 20.10+ et pnpm 9.12+
nvm use                # ou installer Node 20.10.0 manuellement
corepack enable
corepack prepare pnpm@9.12.0 --activate

# 2. Cloner et installer
pnpm install

# 3. Configurer l'environnement
cp .env.example .env.local
# … remplir les valeurs (voir SETUP.md pour le détail)

# 4. Initialiser la base de données
pnpm db:generate       # génère les migrations
pnpm db:migrate        # applique sur Supabase
pnpm db:seed           # données de démo

# 5. Lancer le dev
pnpm dev
```

L'app sera disponible sur http://localhost:3000

Pour la procédure complète (création projet Supabase, configuration des services tiers, etc.), voir **[SETUP.md](./SETUP.md)**.

En cas d'incident production, voir **[RUNBOOK.md](./RUNBOOK.md)**.

---

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript strict |
| UI | Tailwind CSS + shadcn/ui + Radix |
| API | tRPC + TanStack Query |
| DB | PostgreSQL (Supabase EU) + Drizzle ORM |
| Auth | Supabase Auth (email + magic link + MFA TOTP) |
| Storage | Supabase Storage (chiffré, EU) |
| Jobs | Inngest |
| Email | Resend |
| PDF | @react-pdf/renderer + Factur-X (EN16931) |
| AI | Anthropic Claude (sonnet-4-6 + haiku-4-5) |
| Monitoring | Sentry · PostHog (cloud EU) · Better Stack |
| Hosting | Vercel + Supabase EU |

---

## Structure du repo

```
lms-final/
├── apps/
│   └── web/              # Application Next.js principale
├── packages/
│   ├── db/               # Schéma Drizzle, migrations, seeds
│   ├── ui/               # Composants UI partagés
│   ├── ai/               # Wrappers Claude API + prompts
│   ├── shared/           # Types Zod, utils, constants
│   ├── migration/        # Scripts d'import Electron + Interfast
│   ├── emails/           # Templates Resend
│   ├── pdf/              # Templates PDF (devis, factures, BI)
│   └── facturx/          # Génération XML CII + embarquement PDF/A-3
├── infra/
│   └── supabase/         # Config Supabase, RLS policies
├── docs/                 # Spec produit complète (~700 pages)
├── electron-legacy/      # Ancienne version Electron (référence)
└── scripts/              # Scripts utilitaires
```

---

## Commandes principales

```bash
pnpm dev              # Dev server avec hot reload
pnpm build            # Build production
pnpm lint             # ESLint sur tout le repo
pnpm typecheck        # TypeScript check
pnpm test             # Tests unitaires (Vitest)
pnpm test:e2e         # Tests E2E (Playwright)
pnpm format           # Prettier --write
pnpm db:studio        # Drizzle Studio (GUI base de données)
pnpm db:generate      # Génère une migration depuis schema.ts
pnpm db:migrate       # Applique les migrations
pnpm db:seed          # Insère données de démo
```

---

## Versions

- v0.1.0 — Sprint 0 (bootstrap)
- v1.0.0 — Phase 1 complète (16 sprints) — go-live Montpellier prévu

---

## Licence

Propriétaire. La Maison des Services. Tous droits réservés.
