# Spec produit — Module 10 : Paramètres & Administration

**Version** : 1.0
**Statut** : Module transversal, à implémenter progressivement (Sprint 1 fondations, Sprint 14 finalisation)
**Dépendances** : Tous les modules
**Sprints concernés** : 1, 14 (et incrémental sur tous)

---

## 1. Objectif du module

Module transversal qui regroupe l'ensemble des paramètres et écrans d'administration de la plateforme. Il s'agit moins d'un module fonctionnel "métier" que d'un hub de configuration qui supporte tous les autres modules.

Le module couvre :

- **Paramètres organisation** : informations légales, identité visuelle, custom domain, conditions générales par défaut.
- **Gestion des agences** : CRUD complet avec codes postaux, métiers, manager.
- **Gestion des membres** (vue admin transversale) : combine ce qui est dans 01 et 02.
- **Branding** : logo, couleurs, polices, templates documents.
- **Intégrations externes** : Google Places API, Resend, Stripe (Phase 2), Chorus Pro, comptables.
- **Plan comptable** (paramétrage des comptes pour export FEC).
- **Bibliothèque de tarifs** : MO, déplacements, matériel pré-paramétrés.
- **Templates emails et documents** : invitations, devis, factures, BI, relances, mentions légales.
- **Paramètres IA** : activation, cap, modèles (cf. module 09).
- **Sécurité & sessions** : politique MDP, MFA forcé, sessions actives, IP whitelist.
- **Exports et backups** : export complet RGPD, export CSV par type, plan de backup.
- **Journal d'audit consolidé** : recherche cross-modules.
- **Préférences utilisateur** (compte personnel) : notifications, langue, fuseau, interface.
- **Gestion abonnement et facturation** (Phase 4 quand commercialisation).

**Hors périmètre du module** :
- Configuration multi-tenant avancée (Phase 4).
- White-label complet pour autres entités holding (Phase 4).
- API publique avec gestion clés API (Phase 4).
- Webhooks sortants pour intégrations clients (Phase 4).

---

## 2. Architecture

### 2.1 Hiérarchie des paramètres

```
┌─────────────────────────────────────────────────────┐
│  Niveau 1 : Organisation                            │
│  Réglages globaux qui affectent toute l'organisation│
│  Stockés dans `organizations` + `organization_settings`│
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Niveau 2 : Agence                                  │
│  Spécifique à une agence (manager, codes postaux,   │
│  métiers, RIB local éventuel)                       │
│  Stockés dans `agencies`                            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Niveau 3 : Utilisateur                             │
│  Préférences personnelles                            │
│  Stockés dans `users.preferences`                   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Tables principales

| Table | Description |
|---|---|
| `organizations` | Entité tenant (cf. cadrage §4.1) |
| `organization_settings` | Configurations granulaires JSONB |
| `agencies` | Agences |
| `users.preferences` | Préférences utilisateur JSONB |
| `email_templates` | Templates personnalisables |
| `document_templates` | CGV, mentions, intros documents |
| `pricing_library` | Tarifs MO/matériel/déplacement |
| `accounting_settings` | Plan comptable + paramètres FEC |
| `integrations` | Clés API et configs intégrations tierces (chiffrées) |
| `activity_logs` | Journal d'audit (cf. cadrage §4.3) |

### 2.3 Structure JSONB `organization_settings`

```json
{
  "branding": {
    "primary_color": "#0F2644",
    "accent_color": "#F5A623",
    "cta_color": "#F97316",
    "font_family": "Inter",
    "logo_url": "...",
    "favicon_url": "..."
  },
  "documents": {
    "default_payment_terms_days": 30,
    "default_quote_validity_days": 30,
    "late_penalty_rate_pct": 18.0,
    "late_indemnity_eur": 40,
    "rc_pro_number": "...",
    "rc_pro_insurer": "...",
    "decennale_number": "...",
    "decennale_insurer": "...",
    "mediator_consumer": "Médiateur de la consommation : ..."
  },
  "kanban": {
    "auto_close_after_completion": false,
    "auto_archive_terminal_days": 30,
    "urgent_escalation_minutes": 30
  },
  "ai": {
    "enabled": true,
    "monthly_cap_eur": 100,
    "enabled_types": ["bc", "facture", "attestation", "photo", "text"]
  },
  "notifications": {
    "default_quote_reminders": true,
    "default_invoice_reminders": true,
    "send_reminder_at_hour": 8
  },
  "security": {
    "mfa_required_roles": ["owner", "admin", "accountant"],
    "session_timeout_minutes": 60,
    "remember_me_days": 30,
    "password_policy": {
      "min_length": 12,
      "require_uppercase": true,
      "require_number": true,
      "require_special": true
    }
  },
  "onboarding_state": {
    "completed_at": null,
    "current_step": 1
  }
}
```

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Acteur principal du module : configure tout, approuve les changements sensibles |
| **Chef d'agence (admin)** | Gère les paramètres de ses agences, ses templates locaux, ses membres |
| **Comptable (accountant)** | Configure plan comptable, exports, intégrations comptables |
| **Technicien (technician)** | Préférences personnelles uniquement (notifs, mot de passe, MFA, iCal) |
| **Lecture seule (viewer)** | Préférences personnelles uniquement |

---

## 4. Parcours utilisateur

### 4.1 Configuration initiale (post-onboarding)

L'onboarding wizard du module 01 couvre les paramètres minimum vitaux. Après le go-live, le gérant complète :

```
[Sidebar → Avatar → Paramètres]
   │
   ▼
[Page Paramètres avec sidebar gauche listant les sections]
   - Sections (selon rôle) :
       • Mon compte (toujours)
       • Sécurité (toujours)
       • Préférences (toujours)
       • Mes notifications (toujours)
       • Liens iCal (tech)
       --- Réservé admins ---
       • Organisation
       • Agences
       • Membres et invitations
       • Branding
       • Templates documents
       • Templates emails
       • Bibliothèque tarifs
       • Plan comptable
       • Paramètres IA
       • Intégrations
       • Workflow et règles métier
       • Sécurité organisation
       • Exports et backups
       • Journal d'audit
       • Cache et données
   │
   ▼
[Section choisie → contenu à droite]
```

### 4.2 Modification d'une information légale (exemple : SIRET)

```
[Paramètres → Organisation → Identité légale]
   │
   ▼
[Formulaire pré-rempli]
   - Raison sociale
   - SIRET (avec validation INSEE)
   - N° TVA intra
   - Forme juridique
   - Capital social
   - RCS
   - APE/NAF
   - Adresse siège
   │
   ▼
[Modification de SIRET → step-up auth obligatoire]
   - Avertissement : "Le SIRET apparaît sur toutes les factures émises. Le modifier ne change pas les factures déjà émises (immutables)."
   - Saisie mot de passe + TOTP
   - Bouton "Confirmer le changement"
   │
   ▼
[Backend]
   - Validation SIRET via INSEE
   - Update organization
   - Activity log avec valeur avant/après
   - Email à tous les owners
```

### 4.3 Création d'une nouvelle agence

```
[Paramètres → Agences → "+ Nouvelle agence"]
   │
   ▼
[Modal : Nouvelle agence]
   - Nom * (ex : "Toulouse")
   - Code court * (3 lettres, ex : "TLS")
   - Adresse * (autocomplete)
   - Téléphone, Email
   - Manager (select des admins existants ou "À nommer")
   - Codes postaux desservis * (chips, autocomplete)
   - Métiers pratiqués * (multi-select)
   - Date d'ouverture
   - Statut : Actif / En préparation
   - Bouton "Créer"
   │
   ▼
[Backend]
   - Insert agencies
   - Activity log
   - Notification owners
   - Apparition immédiate dans tous les selects de l'app (realtime)
```

### 4.4 Personnalisation des templates emails

```
[Paramètres → Templates emails → "Devis envoyé"]
   │
   ▼
[Éditeur de template]
   - Aperçu temps réel à droite (rendu réel avec données factices)
   - Onglets variables disponibles : {{client_name}}, {{quote_ref}}, etc.
   - Champ Sujet (input, supporte variables).
   - Éditeur Body (rich text simple, supporte variables et HTML basique).
   - Footer fixe (mentions légales, désinscription).
   - Bouton "Envoyer un test" → envoie l'email à mon adresse pour vérifier.
   - Bouton "Restaurer le template par défaut".
   - Bouton "Enregistrer".
```

### 4.5 Mise à jour des CGV

```
[Paramètres → Templates documents → CGV]
   │
   ▼
[Éditeur Markdown / WYSIWYG]
   - Texte courant des CGV par défaut.
   - Édition.
   - Aperçu PDF temps réel.
   - Versioning :
       • Liste des versions précédentes (date, auteur).
       • Bouton "Restaurer une version".
   - Avertissement : "Les devis et factures émis conservent les CGV de leur date d'émission (snapshot)."
   - Step-up auth pour modification.
```

### 4.6 Configuration plan comptable (pour export FEC)

```
[Paramètres → Plan comptable]
   │
   ▼
[Tableau des comptes]
   - Ventes :
       • 706000 — Prestations de services (par défaut)
       • Possibilité d'ajouter sous-comptes par métier (706100 Plomberie, 706200 Électricité…)
   - Achats :
       • 604000 — Achats matériel
       • 622000 — Sous-traitance
   - TVA collectée : 445710 (par défaut)
   - TVA déductible : 445660
   - Compte clients : 411000
   - Compte fournisseurs : 401000
   │
   ▼
[Bouton "Importer un plan comptable"] → CSV au format AFNOR.
[Bouton "Exporter mon plan comptable"] → CSV.
```

### 4.7 Activation de Stripe (Phase 2-3)

Pour Phase 1, la section apparaît mais grisée avec "Disponible Phase 2".

```
[Paramètres → Intégrations → Stripe]
   │
   ▼
[Phase 2 : workflow de connexion OAuth Stripe]
   - Bouton "Connecter mon compte Stripe"
   - Redirection vers OAuth Stripe
   - Retour avec stripe_account_id
   - Configuration :
       • Activer le paiement en ligne sur factures
       • Activer le prélèvement SEPA récurrent
       • Frais à la charge de qui (organisation par défaut)
   - Bouton "Tester un paiement"
```

### 4.8 Gestion des sessions actives

```
[Paramètres → Sécurité → Sessions actives]
   │
   ▼
[Liste des sessions actives de l'utilisateur connecté]
   - Pour chaque session :
       • Device (Windows / iPhone / iPad...)
       • Navigateur (Chrome 120 / Safari 17...)
       • Localisation approximative (depuis IP)
       • Dernière activité
       • IP
       • Marqueur "session actuelle" sur la session courante
       • Bouton "Révoquer" (sauf session courante)
   - Bouton "Révoquer toutes les autres sessions"
   - Bouton "Tout déconnecter (y compris la mienne)"
```

### 4.9 Export RGPD

```
[Paramètres → Mon compte → Mes données → "Exporter mes données"]
   │
   ▼
[Modal : Exporter vos données]
   - Description : "Conformément au RGPD, vous pouvez exporter toutes vos données personnelles."
   - Contenu de l'export :
       • Profil utilisateur
       • Historique d'activité
       • Logs de connexion
       • Préférences
       • Documents auxquels vous êtes lié
   - Format : ZIP contenant JSON + PDFs.
   - Bouton "Demander l'export"
   │
   ▼
[Job Inngest - 24h max pour traitement]
   - Génération ZIP chiffré
   - Lien de téléchargement signé envoyé par email
   - Lien expire dans 7 jours
   - Activity log
```

### 4.10 Suppression de compte (RGPD)

```
[Paramètres → Mon compte → Zone dangereuse → "Supprimer mon compte"]
   │
   ▼
[Modal de confirmation forte]
   - Avertissements multiples :
       • "Cette action est irréversible"
       • "Vos chantiers, factures et données seront anonymisées"
       • "Si vous êtes le seul owner, vous devez d'abord nommer un autre owner"
   - Saisie du mot "SUPPRIMER" en majuscules
   - Saisie mot de passe + TOTP
   - Bouton "Confirmer la suppression"
   │
   ▼
[Backend]
   - Anonymisation immédiate :
       • full_name = "Utilisateur supprimé"
       • email = "deleted-{user_id}@anonymized.local"
       • avatar_url = null
       • preferences = null
   - Suppression invitations en attente
   - Memberships désactivés
   - Sessions invalidées
   - Email de confirmation envoyé à l'ancien email
   - Logs anonymisés (user_id remplacé par hash dans logs >36 mois)
   - Activity log "Compte supprimé"
```

---

## 5. Écrans détaillés

### 5.1 Layout Paramètres

**URL** : `/settings/*`

**Layout** : 2 colonnes — sidebar gauche (sections) + content droite.

**Sidebar (selon rôle)** :
- Section "Mon compte" :
  - Profil
  - Sécurité (mot de passe + MFA)
  - Préférences
  - Notifications
  - iCal (techs)
  - Mes données (RGPD)
- Section "Organisation" (owner/admin) :
  - Identité légale
  - Branding
  - Agences
  - Membres et invitations
  - Templates documents
  - Templates emails
  - Bibliothèque tarifs
  - Plan comptable
  - Workflow et règles
  - Sécurité organisation
- Section "Plateforme" (owner/admin/accountant) :
  - Paramètres IA
  - Intégrations
  - Exports et backups
  - Journal d'audit
  - Cache et données
- Section "Abonnement" (owner, Phase 4) :
  - Plan
  - Facturation
  - Utilisation

### 5.2 Page Mon compte → Profil

**URL** : `/settings/profile`

**Champs** :
- Photo (drop zone, redimension auto).
- Prénom, Nom.
- Email (readonly, demande de changement → lien de validation).
- Téléphone.
- Rôle (readonly).
- Agences (readonly).
- Bouton "Enregistrer".

### 5.3 Page Mon compte → Sécurité

- Mot de passe (changement avec saisie ancien + nouveau).
- MFA (status + bouton activer/désactiver, gestion codes récupération).
- Sessions actives (cf. parcours 4.8).

### 5.4 Page Préférences

- Langue (FR par défaut, EN Phase 5).
- Fuseau horaire (Europe/Paris par défaut).
- Format date (DD/MM/YYYY par défaut).
- Densité interface (Compact / Confort).
- Thème (Clair / Sombre Phase 2).
- Page d'accueil par défaut (Kanban / Dashboard / Dernier vu).

### 5.5 Page Notifications

Pour chaque type d'événement, l'utilisateur peut choisir :
- Email : ✅ / ❌
- In-app : ✅ / ❌
- Push (Phase 2) : ✅ / ❌

Types :
- Nouveau chantier assigné.
- Modification chantier.
- Urgence sur ma agence.
- Devis accepté / refusé.
- Facture payée.
- Facture impayée (retard).
- BI signé.
- BI refusé.
- Mention dans une note.
- Récap quotidien (8h).
- Récap hebdo (lundi 8h).

### 5.6 Page Organisation → Identité légale

**Sections** :
- Identité (raison sociale, SIRET, TVA, forme, capital, RCS, APE).
- Adresse siège.
- Coordonnées (téléphone, email, site web).
- Mentions BTP (RC Pro, décennale, médiateur).
- Documents légaux uploadables (KBIS, attestation TVA, attestation décennale).

### 5.7 Page Organisation → Branding

- Upload logo (PNG/SVG, max 2 Mo).
- Upload favicon.
- Couleurs (color pickers).
- Police (3 choix : Inter, Roboto, Montserrat).
- Aperçu temps réel sur un PDF factice.
- Bouton "Générer une charte exemple".

### 5.8 Page Organisation → Agences

Tableau des agences avec actions CRUD. Cf. parcours 4.3.

### 5.9 Page Organisation → Membres et invitations

Cf. module 02 §5.4.

### 5.10 Page Templates emails

Liste de tous les templates avec édition. Cf. parcours 4.4.

Templates disponibles :
- Invitation
- Bienvenue
- Reset password
- Magic link
- MFA activée
- Mot de passe modifié
- Nouvelle connexion
- Devis envoyé / relance 1 / relance 2
- Devis accepté (côté client)
- Devis refusé (interne)
- Facture émise
- Facture relance 1 / 2 / mise en demeure
- Facture payée (côté client)
- BI envoyé pour signature à distance
- BI signé (interne)
- BI refusé (interne)
- Récap quotidien
- Rapport mensuel

### 5.11 Page Templates documents

Sous-onglets :
- CGV (versionné).
- Mentions légales factures.
- Mentions légales devis.
- Texte d'introduction devis (par défaut).
- Texte d'introduction facture.
- Encart fin de document.
- Mise en demeure.

Édition Markdown / WYSIWYG, aperçu PDF.

### 5.12 Page Bibliothèque tarifs

Tableau éditable :
- Catégorie (Main d'œuvre / Déplacement / Matériel).
- Code (ex : MO_PLOMB).
- Libellé.
- Unité.
- Prix unitaire HT.
- TVA défaut.
- Métier associé (filtrage).
- Bouton "+ Ajouter une ligne".
- Import / Export CSV.

### 5.13 Page Plan comptable

Cf. parcours 4.6.

### 5.14 Page Workflow et règles métier

Toggles paramétrables :
- Auto-bascule chantier en "terminé" quand toutes interventions terminées.
- Auto-archivage chantiers terminés à J+30.
- Escalade urgences non assignées (délai en minutes).
- Relances devis automatiques.
- Relances factures automatiques.
- Création auto BI à clôture intervention.
- Demande validation owner pour devis > X €.
- Heure d'envoi des récaps quotidiens.

### 5.15 Page Paramètres IA

Cf. module 09 §8.3.

### 5.16 Page Intégrations

Pour chaque intégration : statut connecté / non connecté + bouton connect/disconnect.

| Intégration | Status Phase 1 |
|---|---|
| Google Places API | Configurable (clé API) |
| OpenStreetMap (alternative) | Activé par défaut |
| Resend (email) | Configuré au setup |
| Anthropic Claude API | Toggle |
| Sentry | Lecture seule (admin platform) |
| PostHog | Lecture seule |
| Stripe | Phase 2 |
| Chorus Pro | Phase 4 (export manuel Phase 1) |
| Google Calendar (sync) | Phase 4 |
| Outlook Calendar | Phase 4 |
| Sage / EBP | Export uniquement Phase 1 |

### 5.17 Page Sécurité organisation

- Politique mot de passe (longueur min, exigences).
- MFA forcé par rôle.
- Durée session.
- Whitelist IP (Phase 4).
- Logs de connexion récents.
- Tentatives de connexion échouées récentes.

### 5.18 Page Exports et backups

- Exports manuels :
  - Tous les chantiers (CSV).
  - Tous les clients.
  - Toutes les factures.
  - Toutes les données (ZIP JSON, format LMS Gestion natif).
- Export RGPD (cf. parcours 4.9).
- Backups :
  - Status des backups Supabase quotidiens.
  - Dernière sauvegarde réussie.
  - Bouton "Lancer un backup manuel".
  - Téléchargement d'une snapshot DB (owner uniquement, step-up auth, format compressé chiffré).

### 5.19 Page Journal d'audit

Recherche full-text dans `activity_logs` :
- Filtres : type d'entité, action, utilisateur, période.
- Pagination.
- Export CSV de la recherche.
- Tooltip sur chaque ligne avec diff before/after.
- Conservation 24 mois (purge auto pour RGPD).

### 5.20 Page Cache et données

Pour le user :
- Vider le cache local (localStorage app).
- Forcer un rechargement.

Pour l'admin :
- Statistiques de la base : nombre d'entités, taille storage.
- Réinitialiser toutes les données (réservé owner, multi-confirmation, irréversible).
- Anonymiser les données anciennes (>36 mois) — RGPD.

---

## 6. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Modifier son profil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier son mot de passe | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activer / désactiver sa MFA | ✅ (sauf si forcée) | ✅ (sauf si forcée) | ✅ (sauf si forcée) | ✅ | ✅ |
| Voir ses sessions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier ses préférences | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configurer ses notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exporter ses données | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supprimer son compte | ✅ (sauf seul owner) | ✅ | ✅ | ✅ | ✅ |
| Modifier identité organisation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier branding | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gérer agences (CRUD) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gérer membres | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Modifier templates emails | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier templates documents (CGV) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier bibliothèque tarifs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier plan comptable | ✅ | ❌ | ✅ | ❌ | ❌ |
| Modifier workflows/règles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier paramètres IA | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configurer intégrations | ✅ | ❌ | ✅ (compta) | ❌ | ❌ |
| Modifier politique sécurité | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir journal d'audit | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Lancer export complet | ✅ | ❌ | ✅ | ❌ | ❌ |
| Réinitialiser données | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 7. Workflows clés

### 7.1 Step-up auth pour actions sensibles

Demande de re-authentification (mot de passe + MFA si activée) pour :
- Modification SIRET, raison sociale.
- Modification politique sécurité.
- Forçage MFA pour les techniciens.
- Désactivation MFA personnelle.
- Création / désactivation owner.
- Réinitialisation de toutes les données.
- Export complet de la base.
- Suppression de compte.
- Modification CGV (versionnée).

### 7.2 Versioning des CGV et templates

Tout document `legal_documents` (CGV, mentions, etc.) est versionné :
- Historique conservé.
- Snapshot pris à chaque émission de devis/facture (mention `cgv_version_snapshot`).
- Changements ne s'appliquent **que** aux nouveaux documents.

### 7.3 Notification équipe à modification critique

Quand un paramètre critique change, notification à tous les owners :
- Modification SIRET / TVA.
- Modification mentions légales.
- Modification politique sécurité.
- Création/suppression d'agence.
- Promotion/démotion membre owner.
- Réinitialisation de données.

---

## 8. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Modification SIRET sans validation INSEE | Bloqué |
| Suppression dernier owner | Bloqué : "Au moins un owner doit exister" |
| Modification email organisation | Validation par lien envoyé sur l'ancien email + le nouveau |
| Reset complet quand factures émises | Bloqué (légal) : seule l'anonymisation est possible |
| Modification CGV sur devis en cours | Pas d'effet rétroactif |
| Désactivation MFA sur owner | Step-up auth + email d'alerte |
| Custom domain DNS pas configuré | Bandeau "DNS non vérifié" + instructions |
| Cap IA modifié pendant une extraction en cours | Pas d'interruption en cours, applicable au prochain |
| Suppression d'une agence avec chantiers | Bloqué : "X chantiers actifs liés à cette agence" |
| Suppression d'un compte qui est référent dans une fiche | Anonymisation + lien remplacé par "Utilisateur supprimé" |
| Storage limit atteint | Bandeau d'alerte au gérant + invitation à archiver |
| Custom domain déjà utilisé par autre org | Bloqué : "Ce domaine est déjà utilisé" |
| Politique mot de passe durcie | Existing users invités à changer au prochain login |

---

## 9. Critères d'acceptation

### 9.1 Paramètres organisation
- ✅ CRUD agences fonctionne.
- ✅ Modification SIRET avec validation INSEE.
- ✅ Branding modifiable et appliqué globalement.
- ✅ Custom domain configurable avec instructions DNS claires.

### 9.2 Templates
- ✅ Tous les templates emails listés et éditables.
- ✅ Versioning CGV fonctionnel.
- ✅ Aperçu temps réel sur PDF factice.
- ✅ Variables remplacées correctement à l'envoi.

### 9.3 Bibliothèque tarifs
- ✅ Import/export CSV.
- ✅ Suggestions dans les BI.

### 9.4 Sécurité
- ✅ Sessions actives listées et révocables.
- ✅ Step-up auth obligatoire pour actions sensibles.
- ✅ Politique mot de passe respectée.
- ✅ Logs de connexion accessibles.

### 9.5 RGPD
- ✅ Export complet utilisateur fonctionne.
- ✅ Suppression compte anonymise correctement.
- ✅ Conservation logs limitée à 24 mois.

### 9.6 Permissions
- ✅ Sections invisibles selon rôle.
- ✅ Actions impossibles correctement bloquées.

### 9.7 Performance
- ✅ Page Paramètres charge en < 1s.
- ✅ Aperçu PDF temps réel fluide.
- ✅ Recherche journal d'audit < 500 ms.

---

## 10. Métriques (PostHog)

### 10.1 Événements
- `settings.viewed` (props: section)
- `settings.organization_updated` (props: field)
- `settings.agency_created`
- `settings.agency_updated`
- `settings.email_template_modified` (props: template_id)
- `settings.cgv_version_published`
- `settings.session_revoked`
- `settings.data_export_requested`
- `settings.account_deleted`
- `settings.integration_connected` (props: integration)
- `settings.password_policy_changed`

### 10.2 KPIs
- Adoption des templates personnalisés : % d'orgs ayant modifié au moins 1 template.
- Adoption MFA chez rôles non-obligatoires.
- Délai moyen onboarding → première facture émise.
- Taux d'orgs avec custom domain configuré.

---

## 11. Points ouverts à arbitrer plus tard

- **Custom domain SSL automatique** : actuellement Vercel gère, à confirmer pour multi-tenant Phase 4.
- **Tableau de bord usage / quotas par organisation** : Phase 4 commercialisation.
- **API publique avec gestion clés API** : Phase 4.
- **Webhooks sortants** : pour intégrations clients (Phase 4).
- **Multi-langue de l'interface** : Phase 5.
- **Thème sombre complet** : Phase 2.
- **Export Excel paramétré** : pour les comptables qui veulent un format custom (Phase 3).
- **Whitelist IP / 2FA WebAuthn** : sécurité avancée Phase 4.
- **Rotation automatique des secrets API** : Phase 4.
- **Mode "lecture seule"** d'une organisation (gel temporaire) : Phase 4.

---

*Fin de la spec module 10 — Paramètres & Administration.*
*Prochaine spec : 11-notifications-audit.md (système de notifications in-app + email + push, journal d'audit consolidé).*
