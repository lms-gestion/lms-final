# SETUP — Guide de démarrage local

Ce guide te permet de lancer **LMS Gestion** sur ton ordinateur, de A à Z.
Compte ~30-45 minutes la première fois.

---

## 1. Prérequis logiciels

| Outil | Version min | Installation |
|---|---|---|
| **Node.js** | 20.10+ | [nodejs.org](https://nodejs.org) (LTS) |
| **pnpm** | 9.12+ | `npm install -g pnpm@9.12.0` |
| **Git** | récent | [git-scm.com](https://git-scm.com) |
| **PostgreSQL client** (optionnel) | 14+ | pour `psql`, utile pour les RLS |

Vérification :
```bash
node --version    # doit afficher v20.10.0 ou plus
pnpm --version    # 9.12.0+
git --version
```

---

## 2. Récupérer le repo

Si pas déjà fait :
```bash
cd C:\Users\Shoks\Desktop
# Le projet est déjà dans lms-final/
cd lms-final
```

⚠️ **Avant le premier `pnpm install`** : supprime le dossier `node_modules` à la racine
(reliquat de l'Electron). Sous Windows, fais clic droit → Supprimer ou via PowerShell admin :
```powershell
Remove-Item -Recurse -Force node_modules
```

---

## 3. Installer les dépendances

```bash
pnpm install
```

Attendu : ~2-3 minutes pour la première fois. pnpm met les paquets en cache pour les fois suivantes.

Si erreur : voir `RUNBOOK.md` section "pnpm install échoue".

---

## 4. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un compte (Google ou email).
2. Clic **New project** :
   - Nom : `lms-gestion-dev`
   - Mot de passe DB : génère-le et **note-le précieusement**
   - **Région : Frankfurt (eu-central-1)** ← obligatoire pour RGPD
   - Plan : Free (suffisant pour le dev)
3. Attends ~2 minutes que le projet soit provisionné.
4. Copie les valeurs suivantes :
   - **Settings → API** :
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**⚠️ secret total**)
   - **Settings → Database → Connection string → URI** :
     - Remplace `[YOUR-PASSWORD]` par ton mot de passe → `DATABASE_URL`

---

## 5. Créer les autres comptes (peut être différé)

Tu peux skipper temporairement et y revenir quand tu en auras besoin.

| Service | Pourquoi | Quand le créer |
|---|---|---|
| [Resend](https://resend.com) | Envoi emails (invitations, magic links) | Avant de tester l'auth complet |
| [Anthropic](https://console.anthropic.com) | Claude API (extraction IA) | Avant Sprint 13 |
| [Sentry](https://sentry.io) | Monitoring erreurs | Avant la mise en prod |
| [PostHog](https://eu.posthog.com) | Analytics produit | Avant la mise en prod |

Pour le tout début, les 4 sont optionnels — l'app marche sans, juste avec quelques warnings.

---

## 6. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Ouvre `.env.local` dans ton éditeur et remplis **au minimum** :
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
- `SUPABASE_SERVICE_ROLE_KEY=eyJ...`
- `DATABASE_URL=postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres`

Laisse les autres vides pour l'instant si tu n'as pas encore les comptes.

---

## 7. Initialiser la base de données

### 7.1 Générer et appliquer les migrations

```bash
pnpm db:generate    # génère le SQL depuis schema.ts
pnpm db:migrate     # applique sur Supabase
```

Tu devrais voir : `✅ Migrations appliquées avec succès`.

### 7.2 Appliquer les politiques RLS (sécurité multi-tenant)

```bash
# Sous Windows (Git Bash ou PowerShell avec psql installé) :
psql "$env:DATABASE_URL" -f infra/supabase/rls.sql

# Si tu n'as pas psql, copie le contenu de infra/supabase/rls.sql et
# colle-le dans Supabase → SQL Editor → New query → Run.
```

### 7.3 Seed des données de démo (optionnel)

```bash
pnpm db:seed
```

Ça crée une organisation "La Maison des Services" avec 3 agences et les colonnes Kanban par défaut. Tu peux skip et tout configurer via l'onboarding wizard à la place.

### 7.4 Vérifier dans Drizzle Studio

```bash
pnpm db:studio
```

Ouvre [https://local.drizzle.studio](https://local.drizzle.studio) — tu vois toutes tes tables.

---

## 8. Lancer l'application

```bash
pnpm dev
```

L'app démarre sur **http://localhost:3000**.

Premier lancement :
- Tu es redirigé vers `/login`.
- **Crée ton compte** : il faut d'abord t'inscrire dans Supabase Auth.

### Pour créer le premier owner :

**Méthode A — depuis Supabase Studio** (le plus simple) :
1. Va dans Supabase → Authentication → Users → **Add user**.
2. Email : ton email personnel + mot de passe.
3. Décoche "Send email confirmation" (en local on simplifie).
4. Crée.
5. Va dans **SQL Editor** et colle :
   ```sql
   -- Récupère ton user_id et le slug d'organisation
   SELECT id FROM auth.users WHERE email = 'TON_EMAIL';
   SELECT id, slug FROM public.organizations LIMIT 5;

   -- Crée la membership owner (remplace les UUID)
   INSERT INTO public.memberships (user_id, organization_id, role)
   VALUES ('USER_UUID', 'ORG_UUID', 'owner');
   ```
6. Retour sur l'app : login → tu arrives sur le dashboard.

**Méthode B — via le wizard onboarding** :
1. Crée un user dans Supabase Auth comme ci-dessus.
2. Login dans l'app → tu es redirigé vers `/onboarding`.
3. Remplis le wizard 4 étapes — l'organisation et la membership sont créées automatiquement.

---

## 9. Tester que tout marche

```bash
pnpm typecheck     # 0 erreurs attendu
pnpm lint          # 0 erreurs attendu
pnpm test          # tests unitaires passent
pnpm test:e2e      # tests E2E (smoke tests)
```

---

## 10. Prochaines étapes

À ce stade :
- ✅ App qui tourne en local
- ✅ Auth fonctionnelle (login, magic link, reset password)
- ✅ Onboarding wizard complet
- ✅ Système d'invitations
- ✅ Dashboard placeholder
- ⏳ Modules métier à implémenter sprint après sprint (cf. `docs/CADRAGE-PHASE-1.md` §10 pour la roadmap)

Pour développer un module :
1. Lis sa spec dans `docs/specs/0X-nom.md`.
2. Crée les fichiers dans `apps/web/app/(app)/<module>/` et `apps/web/lib/trpc/routers/<module>.ts`.
3. Ajoute le router dans `apps/web/lib/trpc/root.ts`.
4. Test, commit, push.

---

## 11. Déploiement (à faire plus tard)

Quand tu seras prêt à mettre en ligne :
1. Push le repo sur GitHub.
2. Connecte le repo sur [Vercel](https://vercel.com).
3. Configure les mêmes variables d'environnement que `.env.local`.
4. Région : **CDG** (Paris) ou **FRA** (Frankfurt).
5. Deploy.

Le DNS du domaine `gestion.lamaisondesservices.fr` se configure dans Vercel → Settings → Domains.

---

## 12. Aide

- **Spec produit complète** : `docs/specs/`
- **Cadrage technique** : `docs/CADRAGE-PHASE-1.md`
- **Procédures incident** : `RUNBOOK.md`

En cas de blocage, vérifie d'abord le RUNBOOK avant de demander de l'aide.
