# Changelog

Toutes les évolutions notables sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
versioning [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Non publié] — Sprint 0 — 2026-05-06

### Ajouté
- Architecture complète du monorepo SaaS (apps/web, packages/db, ui, ai, shared, emails, pdf, facturx, migration).
- Schéma Drizzle complet (~30 tables, multi-tenant ready, indexes optimisés).
- Politiques RLS Postgres pour isolation multi-tenant.
- App Next.js 14 avec layouts, providers, middleware auth.
- Module 01 — Auth & Onboarding implémenté (login, magic link, reset password, MFA TOTP, invitations, onboarding wizard 4 étapes).
- tRPC routers : auth, onboarding, invitations, members, agencies.
- Composants shadcn/ui de base (Button, Input, Label, Card, Checkbox, Textarea).
- CI GitHub Actions (lint, typecheck, test, build, e2e).
- Setup Sentry + PostHog + Resend + Anthropic.
- Spec produit complète (~700 pages sur 12 modules).
- Cadrage technique avec 12 décisions actées.
- Documentation : SETUP.md, RUNBOOK.md, README.md.

### Choix techniques
- Next.js 14 App Router + TypeScript strict.
- Supabase EU (Frankfurt) + Drizzle ORM.
- Tailwind CSS + Radix UI primitives.
- @react-pdf/renderer + facturx-js pour Factur-X EN16931.
- Anthropic Claude Sonnet 4.6 pour l'IA d'extraction.
- Inngest pour les jobs en arrière-plan.
- Hébergement cible : Vercel (frontend) + Supabase (data + storage).
