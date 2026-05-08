# Spec produit — Module 07 : Factures & Factur-X

**Version** : 1.0
**Statut** : À implémenter en Sprint 10-11
**Dépendances** : Modules 01 (Auth), 02 (Équipe), 03 (Clients), 04 (Chantiers), 06 (Devis)
**Sprints concernés** : Sprint 10, Sprint 11

---

## 1. Objectif du module

Module **financier critique** de l'application. Permet d'émettre des factures conformes à la réglementation française et européenne, avec génération native de Factur-X (PDF/A-3 + XML CII embarqué), suivi des paiements, gestion des avoirs, relances automatiques des impayés et export vers les logiciels comptables.

Le module couvre :

- la **création de factures** : standard, acompte, situation, solde, avoir.
- la **conformité Factur-X EN16931** dès la première facture émise.
- la **numérotation séquentielle légale** sans trou par organisation.
- la **génération PDF/A-3** archivable 10 ans.
- l'**envoi par email** avec lien public et tracking.
- la **saisie des paiements** (partiels et totaux) avec mise à jour automatique du statut.
- les **avoirs** (totaux ou partiels) avec lien vers facture d'origine.
- les **relances automatiques** (J+1, J+15, J+30) avec mise en demeure.
- le **calcul des pénalités de retard** et de l'indemnité forfaitaire 40 €.
- l'**export comptable** : Sage, EBP, Quadra, FEC (Fichier des Écritures Comptables).
- la **connexion Chorus Pro** pour les marchés publics (Phase 1 = export, Phase 4 = API).
- l'**import de factures fournisseurs** (factures reçues) avec extraction automatique.
- le **dashboard financier** : CA, encours, DSO, top payeurs.

**Hors périmètre du module** :
- Comptabilité analytique avancée (Phase 4).
- Multi-devises (Phase 4).
- Gestion des stocks et coûts revient (Phase 4).
- Plan comptable personnalisé (Phase 4).
- Émission via API Chorus Pro (Phase 4 — Phase 1 = export XML manuel).
- E-reporting B2C (obligation 2026 mais usage marginal pour LMS).

---

## 2. Modèle conceptuel

### 2.1 Schéma simplifié

```
┌────────────────────────┐
│  invoices              │
│  - reference FAC-...   │
│  - legal_sequence      │ ← séquence atomique, jamais réutilisée
│  - type                │ ← standard|avoir|acompte|situation|solde
│  - direction           │ ← sale|purchase
│  - client_id (sale)    │
│  - supplier_id (purch.)│
│  - quote_id            │ (lien devis)
│  - chantier_id         │
│  - parent_invoice_id   │ (avoir → facture d'origine)
│  - status              │
│  - issue_date          │
│  - due_date            │
│  - totals (HT/TVA/TTC) │
│  - paid_amount         │
│  - facturx_xml         │
│  - pdf_url             │
└────────────┬───────────┘
             │
   ┌─────────┼──────────┐
   │ 1..n    │ 1..n     │
   ▼         ▼          ▼
┌──────────┐ ┌──────┐ ┌─────────────┐
│ invoice_ │ │ pay- │ │ activity_   │
│ lines    │ │ ments│ │ logs        │
└──────────┘ └──────┘ └─────────────┘
```

### 2.2 Champs principaux d'une facture

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | |
| `organization_id` | UUID | ✅ | Multi-tenant |
| `agency_id` | UUID | ✅ | Agence émettrice |
| `reference` | TEXT | ✅ | "FAC-2026-0042" |
| `legal_sequence` | INT | ✅ | Numéro séquentiel sans trou (CONSTRAINT UNIQUE par org) |
| `type` | TEXT | ✅ | `standard`, `avoir`, `acompte`, `situation`, `solde`, `proforma` |
| `direction` | TEXT | ✅ | `sale` (émise) ou `purchase` (reçue d'un fournisseur) |
| `parent_invoice_id` | UUID | ❌ | Lien vers facture d'origine si avoir/situation/solde |
| `client_id` | UUID | ❌ | Si direction='sale' |
| `supplier_id` | UUID | ❌ | Si direction='purchase' |
| `quote_id` | UUID | ❌ | Devis source si applicable |
| `chantier_id` | UUID | ❌ | Chantier rattaché |
| `status` | TEXT | ✅ | Cf. workflow §2.4 |
| `issue_date` | DATE | ✅ | Date d'émission |
| `due_date` | DATE | ✅ | Date d'échéance |
| `paid_date` | DATE | ❌ | Date de règlement complet |
| `payment_method` | TEXT | ❌ | `virement`, `cheque`, `cb`, `especes`, `prelevement`, `traite` |
| `subject` | TEXT | ✅ | Objet |
| `intro_text` | TEXT | ❌ | |
| `total_ht` | NUMERIC(12,2) | ✅ | |
| `total_tva` | NUMERIC(12,2) | ✅ | |
| `total_ttc` | NUMERIC(12,2) | ✅ | |
| `paid_amount` | NUMERIC(12,2) | ✅ | Cumul des paiements |
| `remaining_amount` | NUMERIC(12,2) | calculé | total_ttc - paid_amount |
| `late_penalty_applied` | NUMERIC(10,2) | ❌ | Pénalités appliquées |
| `late_indemnity_40` | BOOLEAN | ❌ | Indemnité forfaitaire 40 € appliquée |
| `payment_terms` | TEXT | ✅ | Texte des conditions |
| `notes` | TEXT | ❌ | Notes internes |
| `client_notes` | TEXT | ❌ | Notes visibles client (sur PDF) |
| `pdf_url` | TEXT | ❌ | URL Supabase Storage du PDF/A-3 |
| `facturx_xml` | TEXT | ❌ | Contenu XML CII (lecture audit) |
| `chorus_pro_id` | TEXT | ❌ | N° dépôt Chorus Pro si applicable |
| `chorus_pro_status` | TEXT | ❌ | Statut depuis Chorus |
| `public_token` | TEXT | ✅ | Token pour lien public |
| `viewed_at` | TIMESTAMPTZ | ❌ | Premier accès lien |
| `metadata` | JSONB | ❌ | IA extraction details si import |
| `created_by` | UUID | ✅ | |
| `created_at`, `updated_at` | TIMESTAMPTZ | ✅ | |
| `cancelled_at` | TIMESTAMPTZ | ❌ | Si annulée par avoir |

### 2.3 Champs d'un paiement

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | |
| `organization_id` | UUID | |
| `invoice_id` | UUID | |
| `amount` | NUMERIC(12,2) | Montant TTC du paiement |
| `paid_at` | DATE | Date de paiement |
| `method` | TEXT | virement / cheque / cb / especes / prelevement |
| `reference` | TEXT | N° chèque, ID transaction, libellé virement |
| `bank_account` | TEXT | Compte bancaire concerné (pour rapprochement) |
| `notes` | TEXT | |
| `created_by` | UUID | |
| `created_at` | TIMESTAMPTZ | |

### 2.4 Workflow de statuts

```
                        ┌──────────────┐
                        │  brouillon   │
                        └──────┬───────┘
                               │ Émettre
                               ▼
                        ┌──────────────┐
                        │    émise     │ ← n° légal attribué, PDF/A-3 généré, immutable
                        └──────┬───────┘
                               │ Envoyer
                               ▼
                        ┌──────────────┐
                        │   envoyée    │
                        └──┬─────┬─────┘
                           │     │
                  Paiement partiel  Paiement total
                           │     │
                           ▼     ▼
              ┌────────────────────────┐  ┌──────────┐
              │ partiellement_payée    │  │  payée   │
              └────────────┬───────────┘  └──────────┘
                           │ Solde
                           ▼
                       ┌──────────┐
                       │  payée   │
                       └──────────┘

   Si due_date < today et statut ≠ payée :
                       ┌──────────┐
                       │ en_retard│ (calculé en temps réel, pas stocké)
                       └──────────┘

   Annulation = via avoir (jamais suppression)
                       ┌──────────┐
                       │ annulée  │ ← après émission d'un avoir total
                       └──────────┘
```

**Règles** :
- Une facture **brouillon** est éditable.
- Une facture **émise** (et au-delà) est **immutable** : on ne peut plus modifier les lignes, le client, les montants, etc. Seules les notes internes peuvent être modifiées.
- `en_retard` est un statut **calculé** en temps réel, pas stocké en DB. Une facture passée échue + non payée affiche le badge "En retard" mais reste en `envoyée` ou `partiellement_payée` au niveau du DB.
- L'annulation d'une facture émise se fait par **création d'un avoir total**, jamais par suppression.

### 2.5 Types de factures

| Type | Description | Particularités |
|---|---|---|
| `standard` | Facture classique | Cas le plus courant |
| `acompte` | Demande d'acompte (souvent à la signature) | Mention obligatoire "Cette facture est un acompte sur le devis n° X" |
| `situation` | Avancement de travaux | Mention "Facture de situation X% — cumul Y%". Soustraite du solde |
| `solde` | Facture finale après acomptes | Mention "Solde du devis n° X — déduction faite des acomptes" |
| `avoir` | Note de crédit | Lien `parent_invoice_id` obligatoire. Montants négatifs |
| `proforma` | Document préparatoire | Pas de séquence légale, pas de comptabilisation |

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue d'ensemble CA, validation paramètres comptables, accès export FEC |
| **Chef d'agence (admin)** | Création factures du quotidien, suivi encours, relances, gestion avoirs |
| **Comptable (accountant)** | Action principale du module : saisie paiements, rapprochements, exports comptables, suivi DSO |
| **Technicien (technician)** | Lecture des factures liées à ses chantiers (sans détails financiers globaux) |
| **Lecture seule (viewer)** | Audit |

**Persona externe** :

| Persona | Cas d'usage |
|---|---|
| **Destinataire facture** | Reçoit email, ouvre lien public, télécharge PDF/A-3, paie |

---

## 4. Conformité française et européenne

### 4.1 Mentions obligatoires (CGI art. 242 nonies A)

Présentes en clair sur le PDF :

**Identification émetteur** :
- Nom commercial + raison sociale.
- Adresse siège social.
- SIRET.
- Numéro de TVA intracommunautaire (si redevable).
- Forme juridique + capital social (si société).
- Numéro RCS + ville d'immatriculation.
- Code APE/NAF.
- Si artisan : "Artisan immatriculé au Répertoire des Métiers de [Département]".

**Identification destinataire** :
- Nom + adresse.
- SIRET (si professionnel).
- Numéro TVA intra (si pro et UE).

**Identification facture** :
- Date d'émission.
- Numéro unique séquentiel sans trou.
- Référence devis ou bon de commande si applicable.

**Détails prestation** :
- Désignation précise des services rendus / produits livrés.
- Date de prestation si différente de la date facture.
- Quantité, prix unitaire HT, total HT par ligne.
- Taux et montant de TVA pour chaque taux applicable.
- Total HT, total TVA par taux, total TTC.

**Conditions de règlement** :
- Date d'échéance.
- Conditions de paiement.
- **Taux de pénalité de retard** : minimum **3 fois le taux d'intérêt légal** (mention obligatoire même si non appliqué).
- **Indemnité forfaitaire de 40 €** pour frais de recouvrement (loi LME 2008).
- Escompte pour paiement anticipé (le cas échéant, ou mention "Pas d'escompte").

**Mentions spécifiques** :
- "TVA non applicable, art. 293 B du CGI" si franchise en base.
- "Autoliquidation" si applicable (sous-traitance BTP).
- "Exonération TVA, article XX" si applicable.
- Numéro RC Pro et décennale (recommandé pour BTP).
- Médiateur de la consommation (obligatoire factures à particuliers).

### 4.2 Numérotation séquentielle

**Règles légales** :
- Numérotation **continue, chronologique, sans trou**.
- Une fois attribuée, **pas de réutilisation** même si la facture est annulée.
- Format libre mais cohérent (pas de changement en cours d'année).
- Préfixe d'année autorisé : `FAC-2026-0001`, `FAC-2027-0001`.

**Implémentation** :
- Colonne `legal_sequence INT NOT NULL` avec contrainte `UNIQUE(organization_id, legal_sequence)`.
- Génération atomique en transaction Postgres :
  ```sql
  INSERT INTO invoices (organization_id, legal_sequence, ...)
  VALUES (
    $1,
    COALESCE((SELECT MAX(legal_sequence) FROM invoices WHERE organization_id = $1), 0) + 1,
    ...
  )
  ```
- Dans une transaction `SERIALIZABLE` pour éviter les races.
- Le numéro est attribué **uniquement à l'émission** (passage brouillon → émise), pas à la création.

**Réinitialisation annuelle** :
- Optionnelle, paramétrable par organisation.
- Si activée : `legal_sequence` reset à 1 chaque année, le `reference` change de préfixe.
- Tracking via colonne `legal_year INT` pour la contrainte unique : `UNIQUE(organization_id, legal_year, legal_sequence)`.

### 4.3 Conservation et archivage

- **10 ans minimum** (Code de commerce art. L123-22 + CGI art. 286).
- Stockage chiffré dans Supabase Storage (région EU).
- Backup quotidien.
- Pas de suppression possible (soft archive seulement).
- Pour répondre à un contrôle fiscal :
  - Export immédiat des factures d'une période.
  - Format conforme FEC (cf. §11.4).

### 4.4 Pénalités de retard (calcul)

Selon l'art. L441-10 du Code de commerce :
- Taux : minimum **3 × taux légal d'intérêt** publié au Journal Officiel.
- Pour 2026 (estimation) : taux légal ~6 %, donc minimum 18 %.
- Calcul : `pénalité = montant_ttc × taux × jours_retard / 365`.
- L'app calcule et **propose** d'appliquer (case à cocher), pas automatique.
- Indemnité forfaitaire **40 €** : applicable de plein droit dès le premier jour de retard, pour les factures B2B.

### 4.5 Loi facturation électronique (réforme 2026-2027)

**Calendrier officiel** (sous réserve d'évolutions) :
- **Septembre 2026** : obligation pour toutes les entreprises de **recevoir** des factures électroniques.
- **Septembre 2027** : obligation pour les ETI et PME d'**émettre** des factures électroniques.
- **Septembre 2027** : obligation pour les TPE.

**Format** :
- Factur-X (PDF/A-3 + XML CII), UBL, ou CII pur.
- Transit obligatoire via une **plateforme de dématérialisation** (PDP) ou le portail public Chorus Pro pour le secteur public.

**Implications LMS** :
- Émission Factur-X dès Phase 1 = anticipation conformité 2027.
- Réception : capacité d'importer des factures Factur-X reçues (Phase 1 partielle, Phase 2 complète).
- Connexion à une PDP : Phase 4 (selon évolution réglementaire). Pour Phase 1, dépôt manuel sur Chorus Pro accepté.

---

## 5. Factur-X — implémentation détaillée

### 5.1 Profil retenu : EN16931

Profils Factur-X (du plus simple au plus complet) :
- MINIMUM : 12 champs basiques.
- BASIC WL : sans lignes détaillées.
- BASIC : avec lignes détaillées.
- **EN16931** ← retenu : norme européenne complète, suffisant pour 99 % des cas B2B.
- EXTENDED : ajouts spécifiques (paiement multi-comptes, multi-devises) — surdimensionné pour LMS.

### 5.2 PDF/A-3

Format **PDF/A-3** (norme ISO 19005-3) = PDF d'archivage long terme avec capacité d'embarquer des fichiers (le XML).

**Caractéristiques** :
- Polices intégrées (pas de dépendance externe).
- Pas de JavaScript.
- Pas de lien externe non documenté.
- Métadonnées XMP conformes.
- Standard sur 10+ ans.

**Stack** :
- Génération PDF via `@react-pdf/renderer` (idem devis).
- Conversion PDF → PDF/A-3 via librairie spécialisée :
  - Option 1 : `pdf-lib` + post-traitement PDFBox via service tiers.
  - Option 2 : librairie commerciale (Aspose, iText) — coûteux mais robuste.
  - Option 3 : conversion via Inngest job utilisant Ghostscript serveur (`gs -dPDFA=3`).
- **Choix Phase 1** : Ghostscript dans un job Inngest (Docker container Linux).

### 5.3 XML CII embarqué

XML conforme **UN/CEFACT Cross Industry Invoice (CII)** avec extensions Factur-X profil EN16931.

**Génération** :
- Librairie `node-facturx` ou `easyfactur-x` (npm).
- Mapping de notre modèle `invoices` + `invoice_lines` vers le schéma CII.

**Champs critiques (codes BT-)** :
- BT-1 : numéro de facture
- BT-2 : date d'émission
- BT-3 : type de facture (380=standard, 381=avoir, 384=correctif)
- BT-5 : devise (EUR)
- BT-9 : date d'échéance
- BT-21..23 : lignes détaillées
- BT-31, BT-32 : SIRET émetteur, TVA intra
- BT-44 : nom client
- BT-47 : SIRET client
- BT-106..118 : totaux
- BT-122..127 : ventilation TVA par taux

**Validation** :
- Validation schéma XSD avant émission.
- Validation business rules EN16931 via librairie ou API tierce (validation Mercurial chorus-pro).
- Si erreur : émission bloquée, message clair à l'utilisateur.

**Embarquage** :
- Le XML est attaché au PDF/A-3 via `pdf-lib` :
  ```js
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  await pdfDoc.attach(xmlBuffer, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X CII — Profil EN16931',
    relationship: 'Alternative',
  });
  ```

### 5.4 Validation conformité

Avant chaque émission :
1. Validation des champs obligatoires.
2. Génération XML.
3. Validation XSD (schéma).
4. Validation règles métier EN16931 (calculs TVA cohérents, dates valides, etc.).
5. Si tout OK : génération PDF, conversion PDF/A-3, embarquement XML.
6. Test ouverture du PDF résultant pour vérifier que le XML est lisible.

**Tests automatisés** :
- Suite de tests unitaires sur des cas types (facture standard, acompte, avoir, multi-TVA, particulier sans SIRET, etc.).
- Validation par expert-comptable avant production.
- Tests sur outils tiers : Chorus Pro validation, FNFE-MPE Factur-X test tool.

---

## 6. Parcours utilisateur

### 6.1 Création de facture depuis un devis accepté

```
[Fiche devis (status=accepté) → bouton "💶 Générer la facture"]
   │
   ▼
[Modal : Type de facture]
   - Type :
       ○ Facture finale (totalité du devis)
       ○ Facture d'acompte (X% à saisir, défaut = acompte_pct du devis)
       ○ Facture de situation (X% du total, ex : 50%)
   - Date émission (défaut aujourd'hui)
   - Date échéance (calculée selon conditions client)
   - Lignes pré-remplies (modifiables avant émission)
   - Bouton "Continuer"
   │
   ▼
[Page Édition de facture en brouillon]
   - Identique à édition devis (cf. module 06)
   - Numéro légal : "(non attribué — sera FAC-2026-NNNN à l'émission)"
   - Bouton "📤 Émettre la facture" (au lieu de "Envoyer" dans devis)
```

### 6.2 Création ex nihilo

```
[Page Factures → "+ Nouvelle facture"]
   │
   ▼
[Modal court initial]
   - Type (radio)
   - Direction : Vente (à un client) | Achat (d'un fournisseur)
   - Si Vente : Client (autocomplete)
   - Si Achat : Fournisseur (autocomplete)
   - Bouton "Créer brouillon"
   │
   ▼
[Page Édition vide]
```

### 6.3 Émission (passage brouillon → émise)

```
[Édition facture brouillon → bouton "📤 Émettre"]
   │
   ▼
[Modal de validation finale]
   - Récapitulatif :
       • Client / Fournisseur
       • Total TTC
       • Date émission
       • Date échéance
   - Avertissement encadré :
     "⚠️ Une fois émise, cette facture ne pourra plus être modifiée.
      Le numéro légal [FAC-2026-NNNN+1] lui sera attribué de façon irréversible."
   - Vérifications légales (auto) :
       ✓ SIRET émetteur : valide
       ✓ Mentions obligatoires : présentes
       ✓ TVA cohérente : OK
       ✓ Validation Factur-X EN16931 : conforme
   - Si erreur : liste des problèmes à corriger.
   - Step-up auth : saisir mot de passe.
   - Bouton "Annuler"
   - Bouton "✓ Émettre"
   │
   ▼
[Backend (transaction SERIALIZABLE)]
   - Génération legal_sequence atomique
   - Update reference
   - Update status = 'émise'
   - Update issue_date = today
   - Génération XML CII
   - Validation XSD + business rules
   - Génération PDF
   - Conversion PDF → PDF/A-3 (Inngest job, ~3-10s)
   - Embarquement XML dans PDF/A-3
   - Upload vers Supabase Storage (chiffré)
   - Snapshot des données client/émetteur dans le facture (au cas où le client changerait après émission)
   - Activity log
   │
   ▼
[Toast + redirection fiche facture]
   - Bandeau : "Facture émise. Numéro FAC-2026-0042."
   - Boutons : "📧 Envoyer", "📥 Télécharger PDF/A-3", "🔗 Lien public"
```

### 6.4 Envoi au client

```
[Fiche facture émise → bouton "📧 Envoyer"]
   │
   ▼
[Modal d'envoi (similaire au devis)]
   - Destinataires (contact comptable du client de préférence, configurable)
   - Sujet pré-rempli
   - Message pré-rempli
   - Pièces jointes : PDF/A-3 + XML séparé (option) + relances suivies
   - Toggle relances auto J+1, J+15, J+30 (cf. §9.3)
   - Bouton "Envoyer"
   │
   ▼
[Backend]
   - Email Resend avec PDF en pièce jointe
   - Lien public dans email : https://app.lms.fr/i/{public_token}
   - Update sent_at
   - Update status = 'envoyée' (si avant)
   - Activity log
```

### 6.5 Réception côté client (lien public)

```
[Client ouvre /i/{public_token}]
   │
   ▼
[Page consultation publique]
   - Header organisation
   - Détails facture (lecture)
   - Bouton "📥 Télécharger PDF/A-3"
   - Encart "Comment payer ?"
       • RIB de l'émetteur
       • IBAN, BIC
       • Montant exact à régler
       • Mention "Veuillez préciser le numéro de facture FAC-2026-0042 lors du virement"
   - Bouton "📋 Copier le RIB"
   - Bouton "💳 Payer en ligne" (Phase 2-3 si Stripe activé)
```

### 6.6 Saisie d'un paiement

```
[Fiche facture (status=envoyée ou partiellement_payée) → bouton "💳 + Paiement"]
   │
   ▼
[Modal : Saisir un paiement]
   - Montant (défaut = `remaining_amount`)
   - Date de paiement (défaut aujourd'hui)
   - Mode de paiement (select)
   - Référence / N° chèque / ID virement
   - Compte bancaire encaisseur (select des comptes paramétrés)
   - Notes (optionnel)
   - Bouton "Annuler"
   - Bouton "✓ Enregistrer le paiement"
   │
   ▼
[Backend]
   - Insert dans payments
   - Update invoice.paid_amount += amount
   - Si paid_amount >= total_ttc → status = 'payée', paid_date = paid_at du dernier paiement
   - Si paid_amount > 0 et < total_ttc → status = 'partiellement_payée'
   - Activity log
   - Si client → recalcul du statut payeur (cf. module 03 §6)
   - Toast confirmation
```

### 6.7 Création d'un avoir

Cas d'usage : facture émise, mais erreur découverte (mauvais montant, prestation contestée, annulation).

```
[Fiche facture émise → ⋯ → "Créer un avoir"]
   │
   ▼
[Modal : Type d'avoir]
   - Type :
       ○ Avoir total (annule la facture en totalité)
       ○ Avoir partiel (montant à saisir ou lignes spécifiques)
   - Raison (texte libre, obligatoire — sera mentionné sur l'avoir)
   - Date émission (défaut aujourd'hui)
   - Bouton "Continuer"
   │
   ▼
[Page Édition d'avoir (en brouillon)]
   - Lignes pré-remplies en NÉGATIF (ou copie partielle pour avoir partiel)
   - Numéro légal séparé : "AVOIR-2026-NNNN" (séquence séparée des factures, paramétrable)
   - Texte automatique : "Avoir relatif à la facture FAC-2026-0042 du [date]"
   - Tout le reste identique à édition facture
   │
   ▼
[Émission avoir (idem facture)]
   │
   ▼
[Backend]
   - Insert avoir avec parent_invoice_id
   - Update facture origine :
       • Si avoir total : status = 'annulée'
       • Si avoir partiel : pas de changement de statut, mais total_due est ajusté côté reporting
   - Génération PDF/A-3 + XML CII (type 381 dans CII)
   - Activity log sur facture origine ET sur avoir
```

### 6.8 Relances impayés (côté utilisateur)

```
[Page Factures → filtre "En retard"]
   │
   ▼
[Liste des factures en retard]
   - Colonne "Jours retard"
   - Colonne "Dernière relance"
   - Multi-sélection
   │
   ▼
[Bouton bulk : "📧 Relancer X factures"]
   │
   ▼
[Modal : Envoyer relances]
   - Pour chaque facture sélectionnée :
       • Niveau de relance proposé (1ère / 2ᵉ / mise en demeure)
       • Pénalités calculées (à appliquer ?)
       • Indemnité 40 € (à appliquer ?)
   - Modèle d'email (préselectionné selon niveau)
   - Bouton "Envoyer X relances"
   │
   ▼
[Backend]
   - Pour chaque facture :
       • Génération email (template selon niveau)
       • Si pénalités cochées : ajustement total_ttc + génération facture complémentaire (ou ligne sur la prochaine facture, paramétrable)
       • Update last_reminder_at
       • Update reminder_count
   - Envoi via Resend
   - Activity log
```

### 6.9 Mise en demeure (J+30)

À J+30 d'impayé : la mise en demeure est un courrier formel, pré-requis avant action en justice.

```
[Bouton "Générer mise en demeure"]
   │
   ▼
[Génération PDF de mise en demeure]
   - Format courrier officiel (en-tête, coordonnées émetteur + destinataire)
   - Texte type :
     "Mise en demeure de payer
      Madame, Monsieur,
      Sauf erreur de notre part, vous restez nous devoir la somme de [montant] € TTC
      au titre de notre facture n° [ref] du [date], dont l'échéance était fixée au [due_date].
      Conformément à l'article L441-10 du Code de commerce et aux conditions générales
      de notre devis, des pénalités de retard de [taux]% par an, soit [pénalités] €,
      ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement, ont été
      appliquées et sont également à régler.
      Nous vous mettons en demeure de procéder au règlement intégral de cette somme,
      soit [total_avec_penalites] €, dans un délai de 8 jours à compter de la réception
      de la présente.
      À défaut, nous nous verrons contraints d'engager une procédure de recouvrement
      avec toutes les conséquences que cela implique (frais d'huissier, action judiciaire).
      Veuillez agréer..."
   - Bouton "📥 Télécharger PDF" (à imprimer et envoyer en LRAR)
   - Bouton "📧 Envoyer par email" (pas de valeur juridique pour LRAR mais utile en parallèle)
   - Bouton "📮 Envoyer en recommandé électronique" (Phase 4 via Docaposte / AR24)
   │
   ▼
[Update facture]
   - mise_en_demeure_sent_at
   - Notification interne au comptable
```

### 6.10 Export comptable (FEC, Sage, EBP)

```
[Page Factures → bouton "📤 Exporter"]
   │
   ▼
[Modal : Export comptable]
   - Format :
       ○ FEC (Fichier des Écritures Comptables) — format légal contrôle fiscal
       ○ Sage 100 (PNM)
       ○ EBP (XLS)
       ○ Quadra (TXT)
       ○ CSV générique
   - Période :
       • Date début + date fin
       • Préset : "Mois en cours", "Mois précédent", "Trimestre", "Année"
   - Filtres :
       • Direction : ventes / achats / les deux
       • Status : émise + payée + envoyée + partiellement / sans brouillon
       • Agence
   - Plan comptable (paramétré dans organisation) :
       • Comptes clients : 411xxx
       • Comptes fournisseurs : 401xxx
       • Comptes ventes : 706xxx, 707xxx
       • Comptes achats : 604xxx, 622xxx
       • TVA collectée : 44571
       • TVA déductible : 44566
   - Bouton "📥 Générer l'export"
   │
   ▼
[Job Inngest]
   - Génération du fichier
   - Email avec lien de téléchargement (expire dans 24h, lien signé)
   - Toast progression
```

**Format FEC** (norme DGFiP) :
- TXT, encoding UTF-8 ou ANSI.
- Séparateur `|` (pipe) ou tabulation.
- 18 colonnes obligatoires : JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib, PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise.
- 1 ligne d'en-tête + 1 ligne par écriture.

### 6.11 Import facture fournisseur

Pour les factures **reçues** (`direction='purchase'`).

```
[Page Factures → onglet "Achats" → bouton "📥 Importer une facture"]
   │
   ▼
[Drop zone PDF/JPG]
   │
   ▼
[Phase 1 : extraction regex sur nom de fichier + OCR basique]
[Phase 1 fin / Phase 2 : Claude API si activée (cf. module 09)]
   - Extraction : numéro, date, fournisseur, montants, TVA
   - Score de confiance par champ
   │
   ▼
[Modal : Valider les données extraites]
   - Champs pré-remplis avec indicateur de confiance (vert / orange / rouge)
   - Champs critiques à vérifier
   - Si fournisseur inconnu : bouton "Créer fournisseur" inline
   - Si chantier détecté : pré-sélection
   - Bouton "Enregistrer"
   │
   ▼
[Backend]
   - Insert invoice direction='purchase'
   - Status = 'enregistrée' (état spécifique pour les achats)
   - Stockage PDF original + métadonnées extraction
   - Activity log
```

---

## 7. Écrans détaillés

### 7.1 Page Liste des factures

**URL** : `/invoices`

**Onglets** : Ventes (sales) | Achats (purchases) | Avoirs | Brouillons

**Header** :
- Titre "💶 Factures".
- Cards stats globales (sur les ventes par défaut) :
  - CA mensuel.
  - Encours total impayé.
  - Factures en retard (rouge si > 0).
  - DSO (Days Sales Outstanding).
- Filtres :
  - Statut (multi-select).
  - Période (issue_date, due_date, paid_date — toggle).
  - Client / Fournisseur (autocomplete).
  - Agence.
  - Émetteur.
  - Montant min/max.
  - Recherche full-text (numéro, libellé, montant).
- Boutons :
  - "+ Nouvelle facture" (orange).
  - "📥 Importer" (achats uniquement).
  - "📤 Exporter".
  - "📧 Relancer en masse" (visible si en retard sélectionnés).

**Tableau** :

| Colonne | Contenu |
|---|---|
| ☐ | Sélection |
| Réf | FAC-2026-0042 |
| Type | Chip (standard, acompte, avoir...) |
| Statut | Chip coloré |
| Client / Fournisseur | Nom |
| Sujet | Tronqué |
| Émis le | Date |
| Échéance | Date + alerte si dépassée |
| HT | Montant |
| TTC | Montant |
| Payé | Montant + indicateur progressif (%) |
| Reste | Montant (rouge si retard) |
| Émetteur | Avatar |
| Actions | ⋯ menu |

**Tri par défaut** : émission desc.

**Pagination** : 25 / 50 / 100.

### 7.2 Page Édition de facture (brouillon)

Identique à édition devis (module 06 §5.2) avec différences :
- Header : "Facture brouillon" + indicateur "Numéro légal sera attribué à l'émission".
- Boutons : "💾 Brouillon", "👁 Aperçu PDF", "📤 Émettre la facture".
- Champ supplémentaire : "Type de facture" (standard / acompte / situation / solde).
- Si type = acompte/situation/solde : champ "Devis source" obligatoire avec lien.

### 7.3 Page Fiche facture (lecture, après émission)

**URL** : `/invoices/:id`

**Header** :
- Référence + statut + chip type.
- Boutons :
  - "📧 Envoyer" (si émise non encore envoyée).
  - "🔁 Renvoyer".
  - "💳 + Paiement".
  - "📥 PDF/A-3".
  - "📥 XML Factur-X".
  - "🔗 Lien public".
  - "⋯" : Créer avoir · Imprimer · Exporter · Notifier client.

**Cards stats** :
- Total TTC.
- Payé (avec barre de progression).
- Reste à payer (couleur selon statut).
- Date d'échéance + jours restants.

**Onglets** :
1. **📋 Détail** : récap lignes + totaux + conditions + mentions légales appliquées.
2. **💳 Paiements** : liste des paiements avec dates, montants, modes, références.
3. **📊 Activité** : timeline (créée, émise, envoyée, consultée X fois, paiements, relances).
4. **🔗 Liens** : devis source, chantier, avoirs liés, factures filles.
5. **📁 Documents** : PDF/A-3, XML, courriers de relance générés.
6. **📝 Notes** : internes (visibles team uniquement).

### 7.4 Modal "Saisir un paiement"

Cf. parcours 6.6.

### 7.5 Modal "Créer un avoir"

Cf. parcours 6.7.

### 7.6 Modal "Émettre la facture"

Cf. parcours 6.3.

### 7.7 Modal "Export comptable"

Cf. parcours 6.10.

### 7.8 Page Dashboard financier

**URL** : `/invoices/dashboard` ou intégré dans le dashboard global.

**Sections** :
- **CA dans le temps** (graphique courbe) : 12 derniers mois, comparaison N-1.
- **Encours par âge** (stacked bar) : <30j / 30-60j / 60-90j / >90j.
- **Top 10 clients par CA** (tableau).
- **Top 10 mauvais payeurs** (tableau avec DSO et nb retards).
- **Répartition par métier** (pie).
- **Factures à émettre** : devis acceptés non encore facturés.
- **Factures à relancer** : en retard avec proposition d'action en 1 clic.

### 7.9 Page consultation publique facture

Similaire à devis (module 06 §5.7). Différences :
- Pas de boutons "Accepter / Refuser".
- Encart paiement avec RIB et instructions.
- Bouton "Payer en ligne" si Stripe activé (Phase 2-3).

---

## 8. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste factures | ✅ tous | ✅ ses agences | ✅ tous | ✅ ses chantiers | ✅ tous (limité) |
| Voir détail facture | ✅ | ✅ | ✅ | ✅ (limité) | ✅ |
| Voir RIB / IBAN | ✅ | ✅ | ✅ | ❌ | ❌ |
| Voir notes internes | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Créer brouillon | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier brouillon | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Modifier facture émise | ❌ (seulement notes) | ❌ | ❌ (seulement notes) | ❌ | ❌ |
| Émettre | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Désémission (uniquement le jour même, owner) | ✅ jour même | ❌ | ❌ | ❌ | ❌ |
| Envoyer / renvoyer | ✅ | ✅ | ✅ | ❌ | ❌ |
| Saisir paiement | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier paiement | ✅ | ❌ | ✅ | ❌ | ❌ |
| Supprimer paiement | ✅ | ❌ | ✅ | ❌ | ❌ |
| Créer avoir | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Relancer | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mise en demeure | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export comptable | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export FEC complet | ✅ | ❌ | ✅ | ❌ | ❌ |
| Modifier paramètres comptables | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir dashboard financier | ✅ | ✅ ses agences | ✅ | ❌ | ✅ (limité) |

---

## 9. Workflows clés

### 9.1 Numérotation atomique sans trou

**Implémentation** :

```sql
-- Table dédiée pour la séquence (alternative à MAX+1)
CREATE TABLE invoice_sequences (
  organization_id UUID NOT NULL,
  legal_year INT NOT NULL,
  next_number INT NOT NULL DEFAULT 1,
  PRIMARY KEY (organization_id, legal_year)
);

-- Ou utilisation d'une fonction Postgres avec advisory lock :
CREATE FUNCTION next_invoice_number(p_org UUID, p_year INT) RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_org::text || p_year::text));
  SELECT COALESCE(MAX(legal_sequence), 0) + 1
    INTO next_num
    FROM invoices
   WHERE organization_id = p_org AND legal_year = p_year;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;
```

L'attribution se fait dans la même transaction que `UPDATE status='émise'`. En cas de rollback, le numéro n'est jamais consommé.

### 9.2 Calcul automatique du statut "en retard"

Pas stocké en DB. Calculé en lecture :
```sql
SELECT
  *,
  CASE
    WHEN status IN ('payée', 'annulée', 'brouillon') THEN status
    WHEN due_date < CURRENT_DATE AND remaining_amount > 0 THEN 'en_retard'
    ELSE status
  END AS effective_status
FROM invoices;
```

Dans une vue Postgres pour simplification côté client.

### 9.3 Relances automatiques

Job Inngest quotidien à 8h :

```
Pour chaque facture status='envoyée' OU 'partiellement_payée' AND remaining_amount > 0 :
   days_late = today - due_date
   IF days_late >= 1 AND last_reminder_at IS NULL :
      → Relance niveau 1 (cordiale)
   ELSE IF days_late >= 15 AND reminder_count = 1 :
      → Relance niveau 2 (ferme)
   ELSE IF days_late >= 30 AND reminder_count = 2 :
      → Mise en demeure (généré, pas envoyé auto par défaut, notification interne)
```

**Templates** :

Niveau 1 (J+1 après échéance) :
> Bonjour,
> Sauf erreur de notre part, le règlement de la facture [ref] arrivée à échéance le [date]
> ne nous est pas encore parvenu.
> Le règlement peut être effectué par virement à : [RIB].
> [ Consulter la facture ]
> Cordialement.

Niveau 2 (J+15) :
> Bonjour,
> Notre facture [ref] d'un montant de [montant] reste impayée à ce jour, malgré
> notre précédent rappel.
> Conformément à nos conditions, des pénalités de retard de [%]/an et une indemnité
> forfaitaire de 40 € sont applicables.
> Nous vous remercions de procéder au règlement sous 8 jours.
> [ Consulter la facture ]

Niveau 3 (J+30) : génération de la mise en demeure (cf. §6.9), notification interne, **pas d'envoi automatique par email** (action humaine requise pour l'envoi LRAR).

Toggle pour désactiver les relances automatiques au niveau de la facture (relance manuelle uniquement).

### 9.4 Auto-clôture chantier après paiement

Si toutes les factures d'un chantier sont `payée` :
- Notification : "Les factures du chantier [ref] sont toutes réglées. Marquer comme terminé et archivé ?"
- Action en 1 clic (paramétrable auto si `auto_close_after_payment=true` au niveau organisation).

### 9.5 Soumission Chorus Pro (Phase 1 manuel, Phase 4 API)

**Phase 1** :
- Pour les factures à destination d'un client `bailleur` ou `tertiaire public` (paramètre client `requires_chorus_pro=true`) :
- Au moment de l'émission, l'app génère :
  - Le PDF/A-3 + XML embarqué standard.
  - Un export XML pur (compatible Chorus Pro Mode 1) en additionnel.
- L'utilisateur télécharge le XML et le dépose manuellement sur Chorus Pro.
- Champ `chorus_pro_id` à saisir manuellement après dépôt pour suivi.

**Phase 4** :
- Connexion API Chorus Pro (avec certificat ou OAuth).
- Soumission automatique à l'émission.
- Polling du statut Chorus.

### 9.6 Recalcul automatique du statut payeur client

Cf. module 03 §6 — déclenché à chaque création/modif/suppression de paiement et à chaque passage en retard.

---

## 10. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Tentative d'émission sans SIRET émetteur | Bloqué : "SIRET émetteur manquant. Configurez vos paramètres organisation." |
| Tentative d'émission avec validation Factur-X échouée | Liste des champs invalides, bouton "Corriger automatiquement" si possible (ex : ajouter mention manquante) |
| Modification d'une facture émise | Action grisée + tooltip "Une facture émise ne peut pas être modifiée. Créez un avoir si nécessaire." |
| Suppression d'une facture émise | Bloqué (loi). Possibilité d'annuler par avoir. |
| Suppression d'un brouillon avec numéro déjà attribué | Si numéro attribué : bloqué, demander d'émettre ou de désémission ; si pas attribué : suppression OK |
| Désémission (rare, jour J seulement) | Owner uniquement, le jour de l'émission, raison obligatoire. Le numéro est conservé en table `cancelled_invoices` pour traçabilité (la séquence reste continue : on génère un avoir compensatoire). |
| Saisie de paiement supérieur au reste dû | Avertissement : "Montant supérieur au restant à payer. Voulez-vous saisir un trop-perçu ?" |
| Paiement antérieur à la date d'émission | Avertissement non bloquant |
| Avoir partiel > facture origine | Bloqué : "Le montant de l'avoir ne peut excéder le montant de la facture." |
| Création avoir sur facture déjà annulée | Bloqué : "Cette facture est déjà annulée par l'avoir [ref]." |
| Format CSV import non reconnu | Erreur : "Format non reconnu. Utilisez le modèle officiel." |
| Conversion PDF → PDF/A-3 échoue (Ghostscript) | Fallback : conserver PDF standard, notifier admin (anomalie) |
| Date de paiement future | Avertissement : "Date de paiement future. Confirmer ?" |
| Validation Factur-X partiellement OK (warnings) | Émission possible avec avertissements visibles. Audit log mentionne les warnings. |
| Client supprimé après émission | Snapshot des données client conservé sur la facture (legal). |
| Encodage caractères dans XML CII | Tous échappés selon XML 1.0. |
| Multiple paiements créés simultanément (race) | Transaction Postgres garantit cohérence du paid_amount. |

---

## 11. Critères d'acceptation

### 11.1 Création / édition
- ✅ Brouillon créable depuis devis ou ex nihilo.
- ✅ Auto-save toutes les 5s.
- ✅ Calculs HT/TVA/TTC en temps réel.
- ✅ Multi-TVA correctement ventilée.

### 11.2 Émission
- ✅ Numéro légal attribué atomiquement.
- ✅ Validation Factur-X EN16931 réussie avant émission.
- ✅ PDF/A-3 généré et embarqué avec XML.
- ✅ Une facture émise est immutable (sauf notes).
- ✅ Step-up auth obligatoire.

### 11.3 Conformité
- ✅ Toutes les mentions obligatoires présentes sur le PDF.
- ✅ Validation FNFE-MPE Factur-X (outil officiel) : 0 erreur.
- ✅ Test ouverture PDF/A-3 dans Adobe Reader : XML extractible.
- ✅ Numérotation séquentielle vérifiée (script qui scanne et signale tout trou).

### 11.4 Paiements
- ✅ Saisie paiement met à jour status correctement.
- ✅ Paiements partiels gérés (passage 'partiellement_payée').
- ✅ Statut payeur client recalculé.
- ✅ Suppression de paiement remet status à 'envoyée'.

### 11.5 Avoirs
- ✅ Avoir total annule la facture origine (status='annulée').
- ✅ Avoir partiel ajuste le total dû.
- ✅ Lien parent_invoice_id obligatoire.
- ✅ Numérotation séparée AVOIR-YYYY-NNNN.

### 11.6 Relances
- ✅ Job Inngest quotidien fonctionne.
- ✅ 3 niveaux de relance avec templates différents.
- ✅ Mise en demeure générée à J+30 (PDF prêt, envoi humain).
- ✅ Pénalités calculées correctement.
- ✅ Désactivation par facture possible.

### 11.7 Export comptable
- ✅ FEC conforme à la norme DGFiP.
- ✅ Sage / EBP / Quadra : formats reconnus par les logiciels destinataires.
- ✅ Plan comptable paramétrable.

### 11.8 Permissions
- ✅ Aucun rôle ne peut modifier une facture émise (sauf notes).
- ✅ Désémission limitée à owner + jour J.
- ✅ Technician ne voit pas les RIB.
- ✅ RLS bloque accès cross-organisation.

### 11.9 Performance
- ✅ Liste 5000 factures : < 2s.
- ✅ Génération PDF/A-3 : < 10s (job).
- ✅ Validation Factur-X : < 2s.
- ✅ Export FEC année complète : < 30s.

---

## 12. Métriques (PostHog)

### 12.1 Événements
- `invoice.created` (props: type, source=quote|chantier|exnihilo|import)
- `invoice.issued` (props: type, total_ttc, has_facturx, days_since_creation)
- `invoice.sent` (props: recipients_count)
- `invoice.viewed_by_client` (props: time_since_sent_hours)
- `invoice.payment_recorded` (props: amount, method, percent_paid)
- `invoice.paid_in_full` (props: days_to_payment)
- `invoice.late` (props: days_late)
- `invoice.reminder_sent` (props: level)
- `invoice.formal_notice_generated`
- `invoice.credit_note_created` (props: type=full|partial)
- `invoice.exported` (props: format)
- `invoice.facturx_validation_error` (props: error_codes)
- `invoice.purchase_imported` (props: source=manual|ai)

### 12.2 KPIs
- DSO (Days Sales Outstanding) : objectif < 45j pour syndics.
- Taux factures payées dans les délais (objectif > 75 %).
- Taux factures en retard > 30j (objectif < 5 %).
- Taux validation Factur-X au premier coup (objectif > 99 %).
- Délai moyen émission → paiement.
- CA mensuel.
- Taux d'utilisation des avoirs (KPI qualité).
- Adoption export FEC mensuel (par les comptables).

---

## 13. Points ouverts à arbitrer plus tard

- **Paiement en ligne Stripe** : lien direct dans facture pour paiement CB → Phase 2-3.
- **Prélèvement SEPA récurrent** : pour les contrats récurrents (maintenance) → Phase 4.
- **API Chorus Pro** : soumission automatique pour secteur public → Phase 4.
- **PDP (Plateforme de Dématérialisation Partenaire)** : connexion à une PDP officielle quand la liste sera publiée → suivi réglementaire.
- **e-reporting B2C** : envoi à la DGFiP pour les factures particuliers → Phase 4 si applicable LMS.
- **Multi-comptes bancaires** : assigner un compte par agence pour rapprochement → Phase 3.
- **Rapprochement bancaire automatisé** : connexion banque (Bridge / Budget Insight) pour matcher paiements → Phase 4.
- **Recouvrement** : connecteur huissier / société de recouvrement → Phase 4.
- **Relevés de compte client** : PDF de tous les en-cours d'un client → Phase 3.
- **Devises multiples** : pour clients internationaux → Phase 5.
- **Comptabilité analytique** : ventilation par chantier / projet / agence dans les exports → Phase 4.
- **Validation Factur-X par expert externe** : audit annuel de conformité → opérationnel.

---

*Fin de la spec module 07 — Factures & Factur-X.*
*Prochaine spec : 08-bons-intervention.md (bons signés papier/électronique, matériel utilisé, conversion en facture).*
