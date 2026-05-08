# Cadrage technique — Phase 1
## LMS Gestion SaaS — La Maison des Services

**Auteur** : Cadrage initial
**Date** : Mai 2026
**Version** : 0.1
**Périmètre** : Phase 1 uniquement — bascule de la version Electron vers une web app SaaS multi-utilisateurs pour La Maison des Services.

---

## 1. Objectifs de la Phase 1

À la fin de la Phase 1, l'entreprise doit pouvoir abandonner Interfast et la version Electron locale, et basculer ses 3 agences (Montpellier, Perpignan, Aix-Marseille) sur la nouvelle plateforme.

Les objectifs concrets :

- Application web SaaS accessible depuis n'importe quel navigateur, installable en PWA sur ordinateur et téléphone.
- Authentification réelle, multi-utilisateurs, avec rôles granulaires (gérant, chef d'agence, comptable, technicien, lecture seule).
- Multi-agences natif, isolation des données par agence pour les techniciens, vue globale pour le gérant.
- Tous les modules existants opérationnels (Kanban chantiers, fiche chantier, clients, équipe, factures, planning).
- Modules vides actuels développés : **Devis**, **Bons d'intervention**.
- **Génération de PDF** professionnels pour devis, factures, bons (avec mentions légales).
- **Conformité Factur-X** prête (PDF/A-3 + XML embarqué) pour anticiper l'obligation 2026/2027.
- Import IA conservé en simulation, **avec un branchement Claude API en option** sur la fin de phase pour valider l'amélioration de fidélité.
- **Architecture multi-tenant en place** dès le début (même si LMS est seul tenant), pour éviter une refonte à la phase 4.
- Migration des données depuis l'export Interfast et le fichier `lms-data.json` Electron.
- RGPD compliant : hébergement EU, journal d'audit, export et suppression des données utilisateur.
- Backups automatiques quotidiens + restauration testée.

**Hors périmètre Phase 1** (reportés à la suite) :
- App mobile React Native (Phase 2).
- Saisie vocale et IA "rapport technicien" (Phase 3).
- Multi-tenant pour les autres entités du holding (Phase 4).
- Intégrations tierces complexes (compta avancée, CRM, calendriers externes).

---

## 2. Stack technique

### 2.1 Choix structurants

| Couche | Choix | Justification |
|---|---|---|
| **Framework** | Next.js 14 (App Router) + TypeScript | Full-stack en un repo, Server Components, déploiement natif Vercel, écosystème très large. |
| **Style** | Tailwind CSS + shadcn/ui | Productivité maximale, le CSS actuel se transpose facilement, composants accessibles prêts à l'emploi. |
| **API interne** | tRPC | Type-safe end-to-end entre web et backend, zéro boilerplate, parfait pour une équipe restreinte. |
| **API mobile** | REST `/api/v1/*` (à ouvrir Phase 2) | Standard universel, le mobile React Native consommera la même couche service. |
| **DB** | PostgreSQL via **Supabase** (région EU, Frankfurt ou Paris) | Postgres managé, RLS pour multi-tenancy, Auth + Storage inclus, RGPD OK. |
| **ORM** | Drizzle ORM | Performant, type-safe, génère du SQL lisible, plus léger que Prisma. |
| **Auth** | Supabase Auth | Email/password, magic link, MFA TOTP, OAuth (Google/Microsoft pour SSO entreprise plus tard). |
| **Storage fichiers** | Supabase Storage (S3-compatible) | Photos, PDFs, attachments. Migrable vers Cloudflare R2 plus tard si volume. |
| **PDF** | `@react-pdf/renderer` + `facturx-js` | Composant React pour la mise en page, librairie dédiée pour embarquer le XML Factur-X. |
| **Email** | Resend | DX excellente, templates en React, prix raisonnable. |
| **Background jobs** | Inngest | Type-safe, triggers cron + événements, tableau de bord intégré. |
| **Monitoring erreurs** | Sentry | Standard de fait, source maps, alertes, integrations. |
| **Analytics produit** | PostHog (cloud EU) | Funnels, feature flags, session replay. |
| **Logs** | Better Stack (ex-Logtail) | Recherche full-text, alertes, RGPD compliant. |
| **Hébergement web** | Vercel (région Paris/Francfort) | Déploiement instantané, preview par PR, edge cache. À court terme suffit ; migration Scaleway possible si besoin de souveraineté plus stricte. |
| **CI/CD** | GitHub Actions + previews Vercel | Standard, gratuit jusqu'à un certain volume. |

### 2.2 Stack secondaire

- **Tests** : Vitest (unitaires), Playwright (E2E), Testing Library (composants).
- **Lint/Format** : ESLint + Prettier + tsc strict mode.
- **Repo** : monorepo pnpm + Turborepo.
- **Env management** : dotenv-vault ou Doppler pour les secrets.
- **Date/heure** : date-fns avec locale fr-FR.
- **Validation** : Zod (schémas partagés API + UI).
- **Tableaux/grilles** : TanStack Table.
- **Drag & drop** : @dnd-kit (remplace le HTML5 DnD natif actuel, plus robuste).
- **Notifications UI** : sonner (toasts modernes).
- **Cartes/géoloc** : MapLibre GL + tuiles OpenStreetMap (gratuit, sans clé) — alternative à Google Maps pour la carte. Conserver Google Places API uniquement pour l'autocomplete d'adresses.

### 2.3 Pourquoi Supabase et pas autre chose

- Postgres pur, donc portable. Si un jour Supabase ne convient plus, on extrait le schéma et on le pose ailleurs.
- RLS (Row-Level Security) natif, indispensable pour le multi-tenant sans refaire toute l'auth côté app.
- Auth + Storage + Realtime inclus = 3 services en moins à gérer.
- Hébergement EU disponible.
- Free tier généreux pour le dev, ~25 €/mois en Pro pour démarrer la prod.

---

## 3. Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│  Navigateur (PWA installable)                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 App Router (React Server Components + Client) │  │
│  │  shadcn/ui + Tailwind                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ tRPC (HTTPS)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend Next.js (Vercel, région CDG ou FRA)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Routes  │ │  Server  │ │  tRPC    │ │  Webhooks│           │
│  │  RSC     │ │  Actions │ │  Routers │ │  Stripe  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│         │           │           │                               │
│         ▼           ▼           ▼                               │
│  ┌──────────────────────────────────────────────┐               │
│  │  Service Layer (logique métier, partagée)    │               │
│  │  - chantiers, factures, devis, interventions │               │
│  │  - PDF generation (facturx)                  │               │
│  │  - AI orchestration (Claude API)             │               │
│  └──────────────────────────────────────────────┘               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Drizzle │  │ Supabase │  │ Inngest  │  │  Resend  │        │
│  │  ORM     │  │ Storage  │  │ Jobs     │  │  Email   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘        │
└───────┼──────────────┼─────────────┼────────────────────────────┘
        ▼              ▼             ▼
┌──────────────┐  ┌──────────┐  ┌──────────────┐
│  Postgres    │  │ S3 EU    │  │ Job queue    │
│  (Supabase)  │  │ (storage)│  │ (Inngest)    │
│  + RLS       │  │          │  │              │
└──────────────┘  └──────────┘  └──────────────┘
```

---

## 4. Schéma de données (multi-tenant ready)

Toutes les tables métier portent une colonne `organization_id` (UUID, FK → `organizations.id`).
La RLS Postgres garantit que les requêtes ne retournent que les lignes de l'organisation de l'utilisateur connecté.

### 4.1 Tables core (multi-tenant)

```sql
-- Organisations (LMS pour Phase 1, autres entités holding plus tard)
organizations (
  id UUID PK,
  slug TEXT UNIQUE,              -- "lms", "lamaisondesservices"
  name TEXT,                     -- "La Maison des Services"
  legal_name TEXT,               -- raison sociale
  siret TEXT,
  tva_intra TEXT,
  address JSONB,
  logo_url TEXT,
  brand_color TEXT,              -- pour le white-label phase 4
  custom_domain TEXT NULL,       -- gestion.lamaisondesservices.fr
  settings JSONB,                -- config libre par organisation
  created_at, updated_at
)

-- Comptes utilisateur (lié à auth.users de Supabase)
users (
  id UUID PK = auth.users.id,
  email TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferences JSONB,
  last_login_at TIMESTAMPTZ,
  created_at, updated_at
)

-- Adhésion d'un user à une organisation (un user peut être dans plusieurs)
memberships (
  id UUID PK,
  user_id UUID FK,
  organization_id UUID FK,
  role TEXT,                     -- 'owner','admin','accountant','technician','viewer'
  agency_ids UUID[],             -- agences accessibles (NULL = toutes)
  is_active BOOLEAN DEFAULT true,
  invited_by UUID FK,
  created_at, updated_at,
  UNIQUE(user_id, organization_id)
)

-- Agences d'une organisation
agencies (
  id UUID PK,
  organization_id UUID FK,
  name TEXT,                     -- "Montpellier"
  code TEXT,                     -- "MTP"
  address JSONB,
  phone TEXT,
  email TEXT,
  manager_id UUID FK NULL,       -- responsable (membership)
  postal_codes TEXT[],           -- ['34', '34000-34300'] pour matching auto
  metiers TEXT[],                -- métiers pratiqués
  status TEXT,                   -- 'active', 'opening_soon', 'closed'
  opening_date DATE,
  created_at, updated_at
)
```

### 4.2 Tables métier

```sql
-- Clients (syndics, bailleurs, copros, etc.)
clients (
  id UUID PK,
  organization_id UUID FK,
  name TEXT,                     -- raison sociale ou nom
  type TEXT,                     -- 'syndic','bailleur','assurance','tertiaire','hotel','particulier'
  legal_form TEXT,               -- SAS, SARL, association...
  siret TEXT,
  tva_intra TEXT,
  primary_contact_id UUID FK NULL,
  default_agency_id UUID FK NULL,
  payment_terms_days INT DEFAULT 30,
  notes TEXT,
  tags TEXT[],
  created_by UUID FK,
  created_at, updated_at,
  archived_at TIMESTAMPTZ NULL
)

-- Contacts (multiples par client)
contacts (
  id UUID PK,
  organization_id UUID FK,
  client_id UUID FK,
  full_name TEXT,
  role TEXT,                     -- "Gestionnaire", "Comptable"
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN,
  created_at, updated_at
)

-- Techniciens (lien membership)
technicians (
  id UUID PK,
  organization_id UUID FK,
  membership_id UUID FK NULL,    -- s'il a un compte (sinon technicien externe)
  agency_id UUID FK,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  trades TEXT[],                 -- ['plomberie','électricité']
  qualifications JSONB,          -- habilitations électriques, CACES, etc.
  vehicle TEXT,
  hire_date DATE,
  hourly_cost NUMERIC(10,2),     -- coût interne (calcul de marge)
  status TEXT,                   -- 'active','inactive'
  notes TEXT,
  created_at, updated_at
)

-- Fournisseurs
suppliers (
  id UUID PK,
  organization_id UUID FK,
  name TEXT,
  type TEXT,                     -- 'donneur_ordre' (Foncia, etc.) ou 'matériel'
  siret TEXT,
  email TEXT,
  phone TEXT,
  preferred_payment_method TEXT,
  notes TEXT,
  created_at, updated_at
)

-- Chantiers
chantiers (
  id UUID PK,
  organization_id UUID FK,
  reference TEXT,                -- "CH-2026-0001" généré automatiquement
  client_id UUID FK,
  agency_id UUID FK,
  metier TEXT,                   -- "plomberie"
  priority TEXT,                 -- 'normal','haute','urgence'
  status TEXT,                   -- ID de colonne du kanban (configurable)
  title TEXT,
  description TEXT,
  address JSONB,                 -- {street, city, postal, lat, lng, place_id}
  tenant_name TEXT,              -- "locataire" affiché
  tenant_phone TEXT,
  supplier_id UUID FK NULL,
  supplier_reference TEXT,       -- BC-FONCIA-2026-318
  assigned_technician_id UUID FK NULL,
  scheduled_date DATE,
  notes TEXT,
  metadata JSONB,                -- champs custom selon métier
  created_by UUID FK,
  created_at, updated_at,
  closed_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL
)

-- Colonnes Kanban personnalisables par organisation
chantier_columns (
  id UUID PK,
  organization_id UUID FK,
  agency_id UUID FK NULL,        -- NULL = toutes les agences
  position INT,
  key TEXT,                      -- 'nouveau', 'planifie', 'en_cours', 'termine', etc.
  label TEXT,                    -- "Nouveau"
  emoji TEXT,
  color TEXT,
  bg_color TEXT,
  border_color TEXT,
  is_initial BOOLEAN,            -- statut par défaut
  is_terminal BOOLEAN,           -- statut "fermé"
  created_at, updated_at
)

-- Interventions (planning d'un chantier)
interventions (
  id UUID PK,
  organization_id UUID FK,
  chantier_id UUID FK,
  technician_id UUID FK,
  type TEXT,                     -- 'diagnostic','reparation','controle','urgence','travaux'
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  status TEXT,                   -- 'planifiée','en_cours','terminée','annulée'
  arrived_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  notes TEXT,
  signature_url TEXT NULL,       -- signature client (Phase 2)
  geolocation JSONB NULL,        -- où le tech a pointé arrivée/départ
  created_at, updated_at
)

-- Documents attachés à un chantier
documents (
  id UUID PK,
  organization_id UUID FK,
  chantier_id UUID FK NULL,
  intervention_id UUID FK NULL,
  invoice_id UUID FK NULL,
  quote_id UUID FK NULL,
  type TEXT,                     -- 'photo','pdf','doc','xls','attestation','bc','facture'
  category TEXT,                 -- 'avant','apres','justif','admin'
  file_name TEXT,
  storage_key TEXT,              -- chemin dans Supabase Storage
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID FK,
  uploaded_at TIMESTAMPTZ,
  metadata JSONB                 -- exif photo, OCR result, AI analysis
)

-- Devis
quotes (
  id UUID PK,
  organization_id UUID FK,
  agency_id UUID FK,
  reference TEXT,                -- "DEVIS-2026-0001"
  client_id UUID FK,
  chantier_id UUID FK NULL,
  status TEXT,                   -- 'brouillon','envoyé','accepté','refusé','expiré'
  issue_date DATE,
  expiry_date DATE,
  subject TEXT,
  intro_text TEXT,
  payment_terms TEXT,
  conditions TEXT,
  total_ht NUMERIC(12,2),
  total_tva NUMERIC(12,2),
  total_ttc NUMERIC(12,2),
  pdf_url TEXT NULL,
  signed_at TIMESTAMPTZ NULL,
  signed_by_name TEXT NULL,
  created_by UUID FK,
  created_at, updated_at
)

quote_lines (
  id UUID PK,
  quote_id UUID FK,
  position INT,
  description TEXT,
  quantity NUMERIC(10,3),
  unit TEXT,                     -- 'u','h','ml','m²','m³','forfait'
  unit_price_ht NUMERIC(10,2),
  vat_rate NUMERIC(5,2),         -- 20.00, 10.00, 5.50
  discount_pct NUMERIC(5,2),
  total_ht NUMERIC(12,2)
)

-- Bons d'intervention
intervention_orders (
  id UUID PK,
  organization_id UUID FK,
  reference TEXT,                -- "BI-2026-0001"
  chantier_id UUID FK,
  intervention_id UUID FK NULL,
  technician_id UUID FK,
  status TEXT,                   -- 'à_faire','signé','refusé'
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  work_description TEXT,
  materials_used JSONB,          -- [{name, qty, unit_price}]
  client_remark TEXT,
  client_signature_url TEXT NULL,
  technician_signature_url TEXT NULL,
  pdf_url TEXT NULL,
  created_at, updated_at
)

-- Factures
invoices (
  id UUID PK,
  organization_id UUID FK,
  agency_id UUID FK,
  reference TEXT,                -- "FAC-2026-0001" séquence légale
  legal_sequence INT,            -- numéro séquentiel sans trou (obligation FR)
  client_id UUID FK NULL,
  chantier_id UUID FK NULL,
  quote_id UUID FK NULL,         -- facture issue d'un devis
  type TEXT,                     -- 'standard','avoir','acompte','solde'
  direction TEXT,                -- 'sale' (à un client) ou 'purchase' (d'un fournisseur)
  supplier_id UUID FK NULL,      -- si direction='purchase'
  status TEXT,                   -- 'brouillon','émise','envoyée','payée','en_retard','annulée'
  issue_date DATE,
  due_date DATE,
  paid_date DATE NULL,
  payment_method TEXT NULL,
  subject TEXT,
  total_ht NUMERIC(12,2),
  total_tva NUMERIC(12,2),
  total_ttc NUMERIC(12,2),
  paid_amount NUMERIC(12,2),
  pdf_url TEXT NULL,
  facturx_xml TEXT NULL,         -- contenu XML Factur-X
  chorus_pro_id TEXT NULL,       -- si transmise à Chorus Pro
  late_penalty_applied BOOLEAN,
  notes TEXT,
  metadata JSONB,                -- IA extraction details si import
  created_by UUID FK,
  created_at, updated_at
)

invoice_lines (
  id UUID PK,
  invoice_id UUID FK,
  position INT,
  description TEXT,
  quantity NUMERIC(10,3),
  unit TEXT,
  unit_price_ht NUMERIC(10,2),
  vat_rate NUMERIC(5,2),
  discount_pct NUMERIC(5,2),
  total_ht NUMERIC(12,2)
)

-- Paiements (un règlement peut couvrir plusieurs factures partiellement)
payments (
  id UUID PK,
  organization_id UUID FK,
  invoice_id UUID FK,
  amount NUMERIC(12,2),
  paid_at DATE,
  method TEXT,                   -- 'virement','chèque','cb','espèces','prélèvement'
  reference TEXT,
  notes TEXT,
  created_by UUID FK,
  created_at
)
```

### 4.3 Tables transverses

```sql
-- Journal d'audit (qui a fait quoi)
activity_logs (
  id UUID PK,
  organization_id UUID FK,
  user_id UUID FK NULL,
  entity_type TEXT,              -- 'chantier','invoice','client'...
  entity_id UUID,
  action TEXT,                   -- 'create','update','delete','status_change','export'
  changes JSONB,                 -- diff avant/après pour update
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ
)

-- Imports IA (historique + traçabilité)
ai_imports (
  id UUID PK,
  organization_id UUID FK,
  user_id UUID FK,
  source_type TEXT,              -- 'file','text','voice'
  source_files JSONB,            -- liste storage_keys
  raw_input TEXT,                -- texte saisi
  ai_provider TEXT,              -- 'claude-sonnet-4.5','rule-based'
  ai_model TEXT,
  tokens_used INT,
  cost_eur NUMERIC(10,4),
  result_type TEXT,              -- 'new_chantier','update_chantier','classify','extract_invoice'
  result_payload JSONB,          -- ce que l'IA a extrait
  confidence_scores JSONB,       -- score par champ
  user_action TEXT,              -- 'accepted','modified','rejected'
  user_corrections JSONB,        -- ce que l'utilisateur a corrigé (pour amélioration future)
  created_chantier_id UUID FK NULL,
  created_invoice_id UUID FK NULL,
  created_at TIMESTAMPTZ
)

-- Notifications utilisateur
notifications (
  id UUID PK,
  organization_id UUID FK,
  user_id UUID FK,
  type TEXT,                     -- 'urgence','facture_retard','intervention_today'
  title TEXT,
  body TEXT,
  link TEXT,                     -- URL relative
  is_read BOOLEAN,
  created_at, read_at
)

-- Invitations utilisateur (avant qu'ils acceptent)
invitations (
  id UUID PK,
  organization_id UUID FK,
  email TEXT,
  role TEXT,
  agency_ids UUID[],
  invited_by UUID FK,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ NULL,
  created_at
)
```

### 4.4 Indexation et conventions

- Index composites sur `(organization_id, status)` et `(organization_id, agency_id)` pour les listes filtrées.
- Index full-text sur `chantiers(title, description, reference)` et `clients(name)` pour la recherche globale.
- Soft delete via `archived_at` sur les entités importantes (jamais de DELETE physique des chantiers/factures pour conformité).
- Tous les `created_at`/`updated_at` en UTC. Affichage converti en `Europe/Paris` côté UI.

---

## 5. Authentification et rôles

### 5.1 Rôles définis

| Rôle | Description | Périmètre |
|---|---|---|
| `owner` | Gérant, fondateur | Toute l'organisation, toutes agences, paramètres, facturation, suppression |
| `admin` | Chef d'agence ou responsable régional | Une ou plusieurs agences spécifiques (`agency_ids`), pas de paramètres globaux |
| `accountant` | Comptable | Toute l'organisation en lecture, factures en écriture, export comptable |
| `technician` | Technicien terrain | Ses chantiers assignés + ses interventions, photos, bons d'intervention |
| `viewer` | Lecture seule (audit, ponctuel) | Toute l'organisation en lecture |

### 5.2 Implémentation

- Supabase Auth gère le login (email/password + magic link + MFA TOTP optionnel mais recommandé pour `owner` et `admin`).
- Table `memberships` lie `user` ↔ `organization` ↔ `role` ↔ `agency_ids`.
- Les helpers Postgres lisent le JWT pour récupérer `organization_id` actif et le rôle.
- Politiques RLS sur chaque table métier :

```sql
-- Exemple sur chantiers
CREATE POLICY "chantiers_select" ON chantiers FOR SELECT
  USING (
    organization_id = current_org_id()
    AND (
      -- owner, admin global, accountant, viewer voient tout
      current_user_role() IN ('owner', 'admin_global', 'accountant', 'viewer')
      -- admin d'agence ne voit que ses agences
      OR (current_user_role() = 'admin' AND agency_id = ANY(current_user_agencies()))
      -- technician ne voit que les chantiers où il est assigné
      OR (current_user_role() = 'technician' AND assigned_technician_id = current_technician_id())
    )
  );
```

### 5.3 Authentification multi-facteur

- TOTP recommandé pour les rôles `owner`, `admin`, `accountant`.
- Supabase Auth supporte nativement MFA TOTP.
- Politique `step-up auth` pour les actions sensibles (suppression de chantier, export massif, modification facture émise).

### 5.4 Sessions

- Refresh token rotation activé.
- Expiration session : 7 jours (configurable).
- Déconnexion automatique après 60 min d'inactivité côté UI (configurable par organisation).

---

## 6. Génération PDF et Factur-X

### 6.1 Documents à générer

| Document | Format | Mentions obligatoires | Signature électronique |
|---|---|---|---|
| Devis | PDF/A | Coordonnées émetteur, validité, conditions, mentions légales BTP | Optionnelle (cachet société) |
| Bon d'intervention | PDF/A | Description travaux, durée, matériel | Tech + client (Phase 2) |
| Facture | **PDF/A-3 + XML CII** (Factur-X) | SIRET, TVA intra, séquence légale, échéance, pénalités, indemnité 40 € | Optionnelle (cachet) |

### 6.2 Conformité française pour les factures

Mentions obligatoires (CGI art. 242 nonies A) :
- Date de la facture, numéro unique avec séquence sans trou (`legal_sequence`).
- Nom + adresse + SIRET émetteur.
- Nom + adresse client (+ SIRET si pro).
- Désignation précise des biens/services.
- Date de prestation si différente.
- Prix HT par ligne.
- Taux de TVA et montant.
- Total HT, total TVA, total TTC.
- Conditions de règlement (délai, mode).
- Taux de pénalité de retard (3 fois le taux légal minimum).
- Indemnité forfaitaire pour frais de recouvrement (40 €).
- Mention "TVA non applicable, art. 293 B du CGI" si franchise.

### 6.3 Factur-X concrètement

Factur-X = un PDF/A-3 dans lequel est embarqué un fichier XML au format CII (Cross Industry Invoice) UN/CEFACT. Le PDF reste lisible humainement, le XML est lisible par les logiciels de compta.

Pipeline :
1. Générer le PDF via `@react-pdf/renderer` avec un composant `<Invoice />`.
2. Convertir en PDF/A-3 (compatibilité archivage long terme).
3. Construire le XML CII via `facturx-js` ou similaire (profil **EN16931** minimum).
4. Embarquer le XML comme attachment dans le PDF/A-3.
5. Signer numériquement le PDF (option, mais recommandé).

À partir de **septembre 2026**, toutes les entreprises françaises devront pouvoir **recevoir** des factures électroniques. À partir de septembre 2027, les ETI/PME devront en **émettre**. Anticiper en Phase 1 = ne pas avoir à refaire.

### 6.4 Templates PDF

Conserver visuellement la charte graphique actuelle (bleu marine + or). En-tête avec logo, pied avec mentions légales. Variables : nom client, adresse, lignes, totaux, RIB, conditions.

---

## 7. Stratégie d'import IA en Phase 1

L'IA "vraie" arrive en Phase 3 (rapports techniciens). En Phase 1, on :

1. Conserve le moteur regex existant comme **fallback** rapide et gratuit.
2. Branche **Claude API (claude-sonnet-4-6)** comme option premium activable par organisation, avec :
   - Vision sur photos de BC, factures, attestations.
   - Schéma de sortie en JSON strict (tool use).
   - Score de confiance par champ extrait.
   - Stockage de l'extraction dans `ai_imports` pour traçabilité.
3. Toujours laisser l'utilisateur valider/corriger avant création de l'entité.
4. Loguer chaque correction utilisateur pour préparer le fine-tuning Phase 3.

Coût estimé : ~0,02 € par BC analysé, ~0,05 € par facture avec photo.

---

## 8. Migration des données existantes

### 8.1 Sources

1. **Fichier `lms-data.json`** de la version Electron actuelle (`%APPDATA%\lms-gestion\lms-data.json`).
2. **Export Interfast** : depuis l'interface Interfast → exports CSV des clients, devis, factures, chantiers (formats à confirmer selon offre).

### 8.2 Stratégie

Script Node.js TypeScript dans `packages/migration/` :
- `import-electron.ts` — lit le JSON local, mappe les structures, insère via Drizzle.
- `import-interfast.ts` — lit les CSV Interfast, mappe.
- Mode `--dry-run` qui produit un rapport (X clients seraient créés, Y doublons détectés, Z erreurs).
- Mode `--commit` qui exécute réellement.
- Détection des doublons : fuzzy match sur nom client + SIRET, ref chantier, numéro facture.
- Génération d'un rapport de migration détaillé (CSV) à archiver.

### 8.3 Stratégie de coexistence

- Pendant 1 mois après go-live : Interfast reste accessible en lecture seule.
- Les chantiers en cours dans Interfast finissent dans Interfast.
- Les nouveaux chantiers démarrent uniquement dans LMS Gestion.
- Au bout de 1 mois : extraction définitive des chantiers Interfast clos en archive PDF.

---

## 9. Organisation du repo

Monorepo pnpm + Turborepo :

```
lms-gestion/
├── apps/
│   ├── web/                    # Next.js 14 — l'app principale
│   │   ├── app/                # App Router
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   └── mobile/                 # React Native + Expo (Phase 2, dossier prévu)
├── packages/
│   ├── db/                     # Drizzle schema + migrations + seeds
│   ├── ui/                     # shadcn/ui customisé
│   ├── pdf/                    # Templates PDF + Factur-X generator
│   ├── ai/                     # Claude API client + prompts
│   ├── shared/                 # Types Zod, utils, constants
│   └── migration/              # Scripts d'import Electron/Interfast
├── infra/
│   ├── supabase/               # config, migrations RLS
│   └── docker/                 # docker-compose dev
├── docs/                       # Documentation interne (ce fichier inclus)
├── .github/workflows/          # CI
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 10. Roadmap détaillée Phase 1

Phase 1 = **14 sprints de 1 semaine** (3-4 mois). Hypothèse : 1 dev senior full-stack + 1 dev junior à mi-temps + designer freelance ponctuel.

### Sprint 0 — Setup (1 semaine)
- Créer repo monorepo, configurer pnpm + Turborepo + ESLint + Prettier + tsc strict.
- Init Next.js 14 + Tailwind + shadcn/ui.
- Init Supabase project (région EU), config Auth.
- Setup Drizzle ORM, scripts de migration.
- Configurer Vercel (preview deployments).
- Setup Sentry, PostHog, Resend.
- Page d'accueil minimale avec login.

### Sprint 1-2 — Auth + Multi-tenant + Layout (2 semaines)
- Tables `organizations`, `users`, `memberships`, `agencies`.
- Inscription/connexion via Supabase Auth.
- Onboarding : créer son organisation, choisir agence(s).
- Layout général : sidebar, topbar, navigation pages.
- Système d'invitation utilisateur par email.
- Politiques RLS de base.
- Switch d'organisation si user en a plusieurs.

### Sprint 3-4 — Clients + Équipe + Fournisseurs (2 semaines)
- CRUD complet clients avec contacts multiples.
- CRUD techniciens, lien membership.
- CRUD fournisseurs.
- Recherche globale (Ctrl+K) avec résultats cross-entités.
- Tags, archivage, export CSV.

### Sprint 5-6 — Chantiers + Kanban + Fiche (2 semaines)
- Tables `chantiers`, `chantier_columns`.
- Kanban avec drag & drop @dnd-kit (plus robuste que l'actuel).
- Fiche chantier en panneau latéral (conserver l'UX actuelle).
- Filtres : agence, métier, priorité, technicien, période.
- Documents attachés (upload Supabase Storage).
- Recherche full-text.

### Sprint 7 — Interventions + Planning (1 semaine)
- Table `interventions`.
- Modal de planification.
- Planning hebdomadaire par agence + par technicien.
- Détection conflits horaires.
- Export iCal (pour synchro avec Google/Outlook côté tech).

### Sprint 8-9 — Devis (2 semaines)
- Table `quotes` + `quote_lines`.
- Édition WYSIWYG des lignes (TanStack Table editable).
- Calcul TVA multi-taux.
- Conditions générales personnalisables par organisation.
- Génération PDF (template `@react-pdf/renderer`).
- Envoi par email (Resend) avec lien de consultation.
- Conversion devis → bon d'intervention → facture.

### Sprint 10-11 — Factures + Factur-X (2 semaines)
- Table `invoices` + `invoice_lines` + `payments`.
- Génération séquence légale sans trou.
- Toutes mentions obligatoires.
- Génération PDF + XML Factur-X embarqué.
- Validation conforme EN16931 (vérif XML).
- Échéances et relances automatiques (job Inngest).
- Statuts : brouillon → émise → envoyée → payée / en retard.
- Avoirs et factures d'acompte.
- Export comptable CSV (Sage, EBP).

### Sprint 12 — Bons d'intervention (1 semaine)
- Table `intervention_orders`.
- Génération PDF.
- Saisie matériel utilisé.
- Préparation signature (Phase 2 mobile).

### Sprint 13 — Import IA + Migration (1 semaine)
- Migration des données depuis `lms-data.json` et exports Interfast.
- Branchement Claude API en option (vision + extraction structurée).
- Page "Imports récents" avec historique.

### Sprint 14 — Polish + Pré-prod + Documentation (1 semaine)
- Tests E2E Playwright sur les parcours critiques.
- Audit RGPD : registre traitement, page mentions légales, consentement cookies, droit à l'oubli.
- Backup auto + procédure de restauration testée.
- PWA manifest et icônes.
- Documentation utilisateur (vidéos courtes).
- Beta interne avec 1 agence pilote (Montpellier).

### Buffer
Prévoir 2 semaines de buffer pour les imprévus → **total réaliste : 16 semaines (~4 mois)**.

---

## 11. Sécurité et conformité

### 11.1 Sécurité technique
- HTTPS partout (Vercel auto).
- CSP stricte, pas d'inline JS.
- Headers : HSTS, X-Frame-Options, Referrer-Policy.
- Validation Zod sur 100 % des inputs côté serveur.
- Rate limiting sur les endpoints auth (Upstash Redis).
- Audit des dépendances (`pnpm audit` + Dependabot).
- Secrets jamais commités (Doppler/dotenv-vault).
- Backup chiffré quotidien Supabase + test restauration mensuel.

### 11.2 RGPD
- Hébergement EU (Supabase Frankfurt, Vercel Paris).
- DPA signé avec Supabase, Vercel, Resend.
- Registre des traitements à jour.
- Mention légale + politique de confidentialité.
- Consent management cookies (banner).
- Droit à l'oubli : endpoint d'export + suppression utilisateur (anonymisation des chantiers, conservation 10 ans pour conformité fiscale).
- Notification de violation : procédure documentée.

### 11.3 Obligations métier
- Conservation factures 10 ans minimum.
- Numérotation séquentielle sans trou (vérifié par contrainte DB).
- Pas de modification d'une facture émise (verrouillage + génération d'avoir).

---

## 12. Coûts d'exploitation estimés (Phase 1, démarrage)

| Service | Coût mensuel | Note |
|---|---|---|
| Supabase Pro | ~28 € | Postgres + Auth + 100 Go storage |
| Vercel Pro | ~22 € | Si dépasse Hobby (recommandé pour la prod) |
| Resend | ~17 € | 50k emails/mois |
| Sentry Team | ~26 € | Erreurs + perf |
| PostHog | gratuit puis ~45 € | Au-delà de 1M events |
| Inngest | gratuit puis ~25 € | Free jusqu'à 50k steps |
| Claude API | ~50-200 € | Selon volume d'imports IA |
| Domaine | ~12 €/an | |
| **Total** | **~150-350 €/mois** | Quasi linéaire jusqu'à ~50 utilisateurs |

À comparer à Interfast : ~30-60 € × 10 utilisateurs = 300-600 €/mois en stable.
**Le break-even pure infra arrive vite.** Reste le coût de dev (one-shot).

---

## 13. Décisions actées

Décisions tranchées le 6 mai 2026, à appliquer en Sprint 0.

### 13.1 Hébergement → Vercel + Supabase EU (Frankfurt)
Vercel pour l'app Next.js (région CDG/FRA), Supabase Pro région EU pour Postgres + Auth + Storage. DPA signés avec les deux. Procédure de migration d'urgence vers Scaleway documentée comme assurance, non déclenchée par anticipation.

### 13.2 Domaine → `gestion.lamaisondesservices.fr`
Sous-domaine du site existant. Configuration DNS : CNAME vers `cname.vercel-dns.com`. SSL automatique via Vercel. Pour les futures entités holding (Phase 4) : système de `custom_domain` par organisation déjà prévu dans la table `organizations`.

### 13.3 Branding → Charte actuelle conservée
Tokens de design extraits : `--blue-primary: #0F2644`, `--gold: #F5A623`, `--orange-cta: #F97316`. Stockés dans `packages/ui/src/tokens.ts` et exposés en CSS variables. Architecture white-label ready (Phase 4 : tokens par organisation).

### 13.4 MFA TOTP
| Rôle | MFA |
|---|---|
| owner | **Obligatoire** |
| admin | **Obligatoire** |
| accountant | **Obligatoire** |
| technician | Recommandé (non bloquant) |
| viewer | Recommandé |

Implémentation via Supabase Auth MFA. Step-up auth requis pour suppressions, exports, modifs de factures émises.

### 13.5 Coexistence Interfast → 3 mois
- Mois 1 (S0 → S+4) : double saisie pilote Montpellier, validation continue.
- Mois 2 (S+4 → S+8) : LMS seul en saisie, Interfast en consultation. Perpignan rejoint en S+2, Aix en S+4.
- Mois 3 (S+8 → S+12) : Interfast en archive seule. Extraction PDF des chantiers clos pour archivage local.
- Fin de mois 3 : résiliation Interfast.

### 13.6 Factur-X → Full conformité dès Phase 1, profil EN16931
PDF/A-3 + XML CII embarqué selon la norme EN16931 (profil intermédiaire). Validation par expert-comptable avant production. Tests sur factures réelles. Anticipation de l'obligation 2026 (réception) et 2027 (émission ETI/PME).

### 13.7 Claude API → Activable en option dès Sprint 13
- Activable/désactivable par organisation depuis les paramètres.
- Cap budgétaire mensuel paramétrable (défaut 100 €/mois).
- Modèle utilisé : `claude-sonnet-4-6`.
- Toutes les extractions logguées dans `ai_imports` avec scores de confiance et corrections utilisateur.
- Validation utilisateur systématique avant création d'entité.
- Fallback regex automatique si Claude API indisponible ou cap atteint.

### 13.8 Équipe → 1 dev senior + designer freelance + PO
| Rôle | Profil | Engagement | Budget |
|---|---|---|---|
| Dev senior full-stack | 5-8 ans XP TS / Next.js / Postgres / SaaS B2B | Temps plein 4 mois | 25-40 k€ (freelance) ou ~30 k€ pro-rata (CDI) |
| Designer UX freelance | UX/UI SaaS pro, ergo écrans complexes | Ponctuel 2-3 sprints | 3-5 k€ |
| Product owner | Toi-même (connaissance métier) | ~10 h/semaine | — |

Budget total Phase 1 : **30-50 k€** hors salaires permanents.

### 13.9 Calendrier → 16 semaines max, scope ajustable
Deadline ferme : **Semaine 16** = go-live Montpellier.
Sprint review hebdo (vendredi). Rétro toutes les 2 semaines.
Ordre de coupe en cas de retard :
1. Bons d'intervention complets (version simplifiée OK)
2. Import IA Claude (regex suffit en V1)
3. Export comptable avancé (CSV simple OK)

**Non négociables** : conformité Factur-X, migration Interfast, multi-tenant ready, RLS, backups.

### 13.10 Agence pilote → Montpellier
- **S0 (go-live)** : Montpellier seule, double saisie Interfast.
- **S+2** : Perpignan rejoint après premiers correctifs.
- **S+4** : Aix-Marseille rejoint, app stabilisée.

### 13.11 Stripe → Reporté en Phase 2-3
Pas d'implémentation paiement en ligne en Phase 1. Modèle B2B virement à 30 jours conservé. Structure de données `payments` prête à accueillir Stripe sans refacto.

### 13.12 SMS → Reporté en Phase 2
Phase 1 : Resend pour tous les emails transactionnels (factures, relances, rappels intervention). Phase 2 : intégration OVH SMS ou Twilio pour rappels client J-1 et heure d'arrivée technicien (~30-50 €/mois estimés pour le volume LMS).

---

## 13bis. Synthèse opérationnelle des décisions

| # | Décision | Choix |
|---|---|---|
| 1 | Hébergement | Vercel + Supabase EU |
| 2 | Domaine | gestion.lamaisondesservices.fr |
| 3 | Branding | Charte actuelle |
| 4 | MFA | Obligatoire owner/admin/accountant |
| 5 | Coexistence Interfast | 3 mois |
| 6 | Factur-X | Full Phase 1, profil EN16931 |
| 7 | Claude API | Option Sprint 13, cap 100 €/mois |
| 8 | Équipe | 1 dev senior + designer freelance + PO |
| 9 | Calendrier | 16 semaines max, scope ajustable |
| 10 | Pilote | Montpellier S0, Perpignan S+2, Aix S+4 |
| 11 | Stripe | Reporté Phase 2-3 |
| 12 | SMS | Reporté Phase 2 |

---

## 14. Risques identifiés et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration données Interfast incomplète | Moyenne | Élevé | Dry-run obligatoire, rapport de réconciliation, période coexistence 1 mois minimum |
| Génération Factur-X non conforme à l'audit | Faible | Élevé | Validation par expert-comptable avant production, tests sur factures réelles |
| Adoption utilisateurs faible (résistance changement) | Moyenne | Élevé | Formation, agence pilote, écoute retours, parcours plus rapides que Interfast sur les actions clés |
| Coûts Claude API explosent | Faible | Moyen | Caps par organisation, monitoring quotidien, fallback regex |
| Faille RLS multi-tenant | Faible | Critique | Tests automatisés des policies, audit externe, principe defense in depth |
| Perte de données | Très faible | Critique | Backup quotidien Supabase + replica + test restauration mensuel |
| Vendor lock-in Supabase | Faible | Moyen | Postgres pur, schéma documenté, scripts d'export prêts |

---

## 15. Indicateurs de succès Phase 1

Critères de validation pour clôturer la Phase 1 et passer à la Phase 2 :

- 100 % des utilisateurs des 3 agences ont un compte actif.
- Création d'un chantier en moins de **30 secondes** (vs ~1 minute Interfast).
- Génération facture conforme Factur-X validée par un audit comptable.
- 0 incident sécurité, 0 perte de donnée sur 30 jours de prod.
- Disponibilité > 99,5 % sur 30 jours.
- NPS interne > 30 après 1 mois (questionnaire utilisateurs).
- Coût mensuel < 400 € pour 15 utilisateurs.
- Backup restauration testée avec succès.

---

## 16. Annexes à produire ensuite

Documents complémentaires à créer une fois ce cadrage validé :
- `ARCHITECTURE-DETAILLEE.md` — diagrammes par module, contrats tRPC.
- `RGPD.md` — registre, DPA, procédures.
- `MIGRATION-INTERFAST.md` — mapping détaillé champ par champ.
- `PROMPTS-IA.md` — bibliothèque de prompts Claude par cas d'usage.
- `RUNBOOK.md` — procédures incidents, restauration, on-call.
- `STYLE-GUIDE.md` — UI/UX, composants, tokens.

---

*Fin du document de cadrage Phase 1. À valider avec l'équipe avant Sprint 0.*
