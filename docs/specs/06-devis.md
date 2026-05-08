# Spec produit — Module 06 : Devis

**Version** : 1.0
**Statut** : À implémenter en Sprint 8-9
**Dépendances** : Modules 01 (Auth), 02 (Équipe), 03 (Clients), 04 (Chantiers)
**Sprints concernés** : Sprint 8, Sprint 9

---

## 1. Objectif du module

Permettre la création de devis professionnels conformes à la réglementation française du BTP, avec édition fluide des lignes, calcul automatique des taxes, génération de PDF, envoi sécurisé au client, signature électronique simple, et conversion en facture une fois accepté.

Le module couvre :

- la **création / édition de devis** (depuis chantier, ex nihilo, par duplication d'un devis existant),
- l'**édition WYSIWYG des lignes** : description, quantité, unité, prix unitaire, taux de TVA, remise,
- le **calcul automatique** des totaux HT, TVA par taux, TTC, acompte demandé,
- la gestion des **conditions générales** et **mentions légales** propres au BTP,
- la **génération PDF** professionnelle avec en-tête personnalisé et pied de page conforme,
- l'**envoi par email** au client avec un lien de consultation publique,
- la **signature électronique simple** (clic sur "Accepter" + saisie nom/email + horodatage IP),
- les **statuts** : `brouillon`, `envoyé`, `consulté`, `accepté`, `refusé`, `expiré`,
- la **conversion devis → facture** avec préservation du lien et des montants,
- la **numérotation séquentielle** par organisation,
- les **relances automatiques** (J+7, J+15) si non répondu,
- la **réutilisation** : duplication, templates de devis (Phase 1 simple, Phase 4 avancée).

**Hors périmètre du module** :
- Signature électronique avancée (eIDAS qualifiée) — Phase 4.
- Catalogue d'articles/services centralisé avec stocks — Phase 4.
- Facturation automatique sur acceptation — Phase 4 (workflow optionnel).
- Variantes / options dans un devis — Phase 4.
- Multi-langue — Phase 5.

---

## 2. Modèle conceptuel

### 2.1 Entités

```
┌─────────────────────────┐
│  quotes (devis)         │
│  - reference DEVIS-...  │
│  - client_id            │
│  - chantier_id (opt)    │
│  - status               │
│  - issue_date           │
│  - expiry_date          │
│  - totals (HT/TVA/TTC)  │
│  - terms                │
└────────────┬────────────┘
             │ 1..n
             ▼
┌─────────────────────────┐
│  quote_lines            │
│  - position             │
│  - description          │
│  - quantity, unit       │
│  - unit_price_ht        │
│  - vat_rate             │
│  - discount_pct         │
└─────────────────────────┘
```

### 2.2 Champs principaux d'un devis

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | UUID |
| `organization_id` | UUID | ✅ | Multi-tenant |
| `agency_id` | UUID | ✅ | Agence émettrice |
| `reference` | TEXT | ✅ | "DEVIS-2026-0042" auto, séquence par organisation |
| `client_id` | UUID | ✅ | Client destinataire |
| `chantier_id` | UUID | ❌ | Chantier lié (optionnel : devis sans chantier OK) |
| `status` | TEXT | ✅ | Cf. workflow §2.4 |
| `issue_date` | DATE | ✅ | Date d'émission |
| `expiry_date` | DATE | ✅ | Date limite d'acceptation (default issue_date + 30j) |
| `subject` | TEXT | ✅ | Objet du devis ("Réfection plomberie Apt 12") |
| `intro_text` | TEXT | ❌ | Texte d'introduction libre |
| `payment_terms` | TEXT | ✅ | "Paiement à 30 jours" / "Acompte 30% à la commande" |
| `conditions_generales` | TEXT | ❌ | CGV personnalisées (si différentes des CGV organisation) |
| `acompte_pct` | NUMERIC(5,2) | ❌ | Pourcentage d'acompte demandé (ex : 30) |
| `acompte_amount_ht` | NUMERIC(12,2) | ❌ | Calculé |
| `total_ht` | NUMERIC(12,2) | ✅ | Calculé |
| `total_tva` | NUMERIC(12,2) | ✅ | Calculé |
| `total_ttc` | NUMERIC(12,2) | ✅ | Calculé |
| `total_discount` | NUMERIC(12,2) | ❌ | Total des remises lignes |
| `global_discount_pct` | NUMERIC(5,2) | ❌ | Remise globale après lignes |
| `pdf_url` | TEXT | ❌ | URL Supabase Storage du PDF généré |
| `public_token` | TEXT | ✅ | Token pour le lien de consultation publique |
| `viewed_at` | TIMESTAMPTZ | ❌ | Premier accès au lien public |
| `viewed_count` | INT | ✅ | Nombre de consultations |
| `accepted_at` | TIMESTAMPTZ | ❌ | Date d'acceptation client |
| `accepted_by_name` | TEXT | ❌ | Nom du signataire |
| `accepted_by_email` | TEXT | ❌ | Email du signataire |
| `accepted_ip` | INET | ❌ | IP de l'acceptation |
| `accepted_signature_url` | TEXT | ❌ | Image signature dessinée (si Phase 2) |
| `refused_at` | TIMESTAMPTZ | ❌ | Date refus |
| `refusal_reason` | TEXT | ❌ | Raison refus |
| `created_by` | UUID | ✅ | User émetteur |
| `created_at`, `updated_at` | TIMESTAMPTZ | ✅ | |

### 2.3 Champs principaux d'une ligne

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | |
| `quote_id` | UUID | ✅ | |
| `position` | INT | ✅ | Ordre d'affichage |
| `type` | TEXT | ✅ | `item` (ligne normale), `section` (titre de section), `subtotal` (sous-total auto), `note` (texte libre) |
| `description` | TEXT | ✅ | Description (multilignes possible) |
| `quantity` | NUMERIC(10,3) | ✅ pour `item` | |
| `unit` | TEXT | ✅ pour `item` | `u`, `h`, `ml`, `m²`, `m³`, `forfait`, `kg`, `j` |
| `unit_price_ht` | NUMERIC(10,2) | ✅ pour `item` | |
| `vat_rate` | NUMERIC(5,2) | ✅ pour `item` | 20.00, 10.00, 5.50, 0 |
| `discount_pct` | NUMERIC(5,2) | ❌ | Remise par ligne |
| `total_ht` | NUMERIC(12,2) | ✅ pour `item` | Calculé |

### 2.4 Workflow de statuts

```
                ┌──────────────┐
                │  brouillon   │ (création)
                └──────┬───────┘
                       │ Envoyer
                       ▼
                ┌──────────────┐
                │   envoyé     │
                └──────┬───────┘
                       │ Premier accès lien
                       ▼
                ┌──────────────┐
                │   consulté   │
                └──┬────────┬──┘
                   │        │
            Accepter      Refuser
                   │        │
                   ▼        ▼
            ┌──────────┐ ┌──────────┐
            │ accepté  │ │  refusé  │
            └──────────┘ └──────────┘

   Si pas d'action avant expiry_date :
                ┌──────────────┐
                │   expiré     │ (job auto)
                └──────────────┘
```

**Règles** :
- Un devis `brouillon` est éditable librement.
- Un devis `envoyé` ou plus n'est plus éditable (sauf désémission par owner pour corriger une erreur, avec audit).
- L'`expiré` peut être réactivé (nouvelle date d'expiration).
- Un devis `accepté` peut générer une facture (manuellement, pas auto).

### 2.5 Taux de TVA français applicables

| Taux | Cas | Mention obligatoire ? |
|---|---|---|
| 20 % | Standard | Non |
| 10 % | Travaux d'amélioration / rénovation logement >2 ans | Oui : attestation TVA 10% du client |
| 5.5 % | Travaux d'amélioration énergétique (isolation, chaudière HP, etc.) | Oui : attestation TVA 5.5% |
| 0 % | Exonéré (rare en BTP) | Mention "Exonération TVA art. ..." |
| Franchise | Auto-entrepreneur sous seuil | "TVA non applicable, art. 293 B du CGI" |

L'app stocke les attestations client (PDF) dans `client.documents` et alerte si une ligne 10 % ou 5.5 % est créée sans attestation valide pour le client.

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue d'ensemble, modèles de CGV, validation des gros devis (Phase 4 workflow validation) |
| **Chef d'agence (admin)** | Création et envoi du quotidien, suivi taux acceptation |
| **Comptable (accountant)** | Suivi devis acceptés non facturés, conversion en factures |
| **Technicien (technician)** | Lecture du devis lié à un chantier qui lui est assigné |
| **Lecture seule (viewer)** | Audit |

**Persona externe** :

| Persona | Cas d'usage |
|---|---|
| **Destinataire du devis** | Reçoit un email, ouvre le lien public, consulte, accepte ou refuse, télécharge le PDF |

---

## 4. Parcours utilisateur

### 4.1 Création de devis depuis un chantier

```
[Fiche chantier → bouton "+ Devis"]
   │
   ▼
[Page Édition de devis (full page, pas modal car beaucoup de saisie)]
   - Pré-rempli :
       • Client (depuis chantier)
       • Chantier (lien préservé)
       • Lieu d'intervention (depuis chantier)
       • Sujet (depuis titre chantier)
       • Adresse intervention (depuis chantier)
       • Émetteur : utilisateur connecté
       • Date émission : aujourd'hui
       • Date expiration : aujourd'hui + 30j
   - Numéro de devis : DEVIS-2026-NNNN (généré à la sauvegarde brouillon)
   │
   ▼
[Section Lignes — éditeur WYSIWYG TanStack Table]
   - Ligne 1 : ajout par défaut, vide
   - Champs par ligne : description, quantité, unité, PU HT, TVA, remise, total
   - Boutons d'ajout :
       • "+ Ligne d'article"
       • "+ Section" (titre, ex : "PHASE 1 — Démolition")
       • "+ Sous-total" (calculé auto sur les items précédents jusqu'à la dernière section)
       • "+ Note" (texte libre intercalé)
   - Drag & drop pour réorganiser les lignes
   - Boutons par ligne : supprimer, dupliquer
   - Saisie au clavier : Tab pour naviguer, Enter pour ajouter une nouvelle ligne
   │
   ▼
[Section Totaux (sticky en bas)]
   - Sous-total HT : 1 234,56 €
   - Remise globale : 0 % [input]
   - Net HT : 1 234,56 €
   - TVA 20 % sur 1 100,00 € : 220,00 €
   - TVA 10 % sur 134,56 € : 13,46 €
   - TVA 5.5 % sur 0 € : 0,00 €
   - Total TTC : 1 468,02 €
   - Acompte demandé : 30 % [input] = 440,41 € TTC
   │
   ▼
[Section Conditions]
   - Texte d'introduction (textarea, pré-rempli depuis template organisation)
   - Conditions de paiement (select : "30 jours net", "À réception", "30% acompte + solde fin chantier")
   - CGV (textarea, pré-rempli, modifiable pour ce devis spécifique)
   │
   ▼
[Section Pièces jointes]
   - Ajouter PDF, photos (max 25 Mo)
   - Apparaîtront en annexe du PDF
   │
   ▼
[Boutons en haut de page]
   - "💾 Enregistrer brouillon" (sauvegarde sans envoyer)
   - "👁 Aperçu PDF" (génère et affiche le PDF inline)
   - "📧 Envoyer au client" (modal envoi email)
   - "⋯ Plus" : Dupliquer · Supprimer (si brouillon) · Voir historique
   │
   ▼
[Auto-save toutes les 5 secondes en cas d'édition]
   - Indicateur "Brouillon enregistré il y a 3s" en haut à droite
```

### 4.2 Création ex nihilo

```
[Page Devis → bouton "+ Nouveau devis"]
   │
   ▼
[Modal court : Choix initial]
   - Pour quel client ? (autocomplete + création inline)
   - Lié à un chantier existant ? (autocomplete des chantiers du client)
   - Bouton "Créer le devis"
   │
   ▼
[Page Édition vide, mais avec client choisi]
   (Reste identique au flow 4.1)
```

### 4.3 Envoi du devis au client

```
[Page Édition → bouton "📧 Envoyer au client"]
   │
   ▼
[Modal : Envoyer le devis]
   - Destinataire principal :
       • Auto-rempli : contact principal du client
       • Modifiable
       • Possibilité d'ajouter des CC (autres contacts du client)
   - Sujet email (pré-rempli) :
       "Votre devis [DEVIS-2026-0042] — La Maison des Services"
   - Message (pré-rempli, modifiable) :
       "Bonjour [Civilité Nom],
        Veuillez trouver ci-joint notre devis pour [sujet].
        Vous pouvez le consulter et le valider directement en ligne en cliquant sur le bouton ci-dessous.
        N'hésitez pas à revenir vers nous pour toute question.
        Cordialement,
        [Émetteur]"
   - Pièces jointes :
       • PDF du devis (toujours)
       • Pièces jointes additionnelles ajoutées plus tôt
       • Toggle "Joindre les CGV en PDF séparé"
   - Options :
       ☑ Demander un accusé de réception (Resend tracking)
       ☑ Activer les relances automatiques (J+7, J+15)
   - Bouton "Annuler"
   - Bouton "Envoyer maintenant"
   │
   ▼
[Backend]
   - Génération PDF final (template avec branding organisation)
   - Création/réutilisation public_token
   - Stockage PDF dans Supabase Storage
   - Update quote.status = 'envoyé'
   - Update quote.sent_at = now
   - Envoi email via Resend avec :
       • PDF en pièce jointe
       • Lien de consultation publique : https://app.lms.fr/q/{public_token}
   - Activity log
   - Notification interne (admin agence)
   │
   ▼
[Toast confirmation + redirection vers fiche devis (vue lecture)]
```

### 4.4 Réception et consultation côté client (lien public)

Aucune authentification requise pour le client. Token signé HMAC dans l'URL.

```
[Client reçoit l'email avec bouton "Consulter mon devis"]
   │
   ▼
[Lien : https://app.lms.fr/q/{public_token}]
   │
   ▼
[Page publique de consultation du devis]
   Layout : centré, max-width 900px, design propre, branding organisation visible.
   
   - Header avec logo organisation + nom commercial
   - Titre : "Devis [reference]"
   - Sous-titre : "[Sujet]" + date émission + date expiration
   
   - Encart "Pour [Client]" + adresse client
   
   - Tableau des lignes (lecture seule, formaté pour impression)
   - Totaux
   - Conditions de paiement
   - CGV en accordion expandable
   
   - Boutons d'action en bas (sticky) :
       • "📥 Télécharger le PDF"
       • "🖨 Imprimer"
       • "✓ Accepter ce devis" (vert, large)
       • "✕ Refuser ce devis" (gris, plus discret)
   
   - Si déjà accepté : bandeau vert "✓ Devis accepté le [date] par [nom]"
   - Si déjà refusé : bandeau rouge "Devis refusé le [date]"
   - Si expiré : bandeau orange "Ce devis a expiré le [date]. Contactez-nous pour le renouveler."
   
   - Footer : coordonnées entreprise (nom, SIRET, adresse, contact)
   │
   ▼
[Si premier accès]
   - Backend update quote.viewed_at + viewed_count++
   - Notification interne au commercial : "[Nom client] a consulté le devis [ref]"
```

### 4.5 Acceptation par le client

```
[Page consultation publique → clic "✓ Accepter ce devis"]
   │
   ▼
[Modal d'acceptation (étape 1 — identité)]
   - Texte légal :
     "En cliquant sur 'Accepter', vous reconnaissez avoir pris connaissance des conditions
      générales et confirmez votre accord avec ce devis pour le montant de [TTC] €.
      Cette acceptation a valeur de signature."
   - Champs :
       • Nom complet * (auto-rempli si client connu)
       • Email * (auto-rempli)
       • Société (optionnel)
       • Fonction (optionnel)
       • Téléphone (optionnel mais recommandé)
   - Checkbox obligatoire : "☐ J'ai lu et j'accepte les conditions générales"
   - Bouton "Annuler"
   - Bouton "✓ J'accepte le devis"
   │
   ▼
[Modal étape 2 — confirmation par email (anti-fraude)]
   - "Pour confirmer votre acceptation, nous vous avons envoyé un code à 6 chiffres à [email]."
   - 6 inputs pour le code
   - Bouton "Renvoyer le code" (cooldown 60s)
   - Bouton "Vérifier"
   │
   ▼
[Backend]
   - Vérification code (Redis 10 min TTL)
   - Update quote :
       • status = 'accepté'
       • accepted_at = now
       • accepted_by_name, accepted_by_email
       • accepted_ip = request IP
       • accepted_user_agent
   - Génération PDF "accepté" avec encart "ACCEPTÉ le [date]" + "Par [nom]" + IP + horodatage
   - Stockage du PDF accepté immutable dans Storage
   - Activity log
   - Notifications internes :
       • Email à l'émetteur du devis
       • Notif in-app "Devis [ref] accepté !"
   - Email de confirmation au client avec PDF accepté
   │
   ▼
[Page de remerciement]
   "Merci ! Votre devis a été accepté. Nous reviendrons vers vous prochainement pour planifier l'intervention.
    Une copie signée vous a été envoyée par email."
```

### 4.6 Refus par le client

```
[Page consultation publique → clic "✕ Refuser ce devis"]
   │
   ▼
[Modal : Refuser ce devis]
   - "Pourquoi refusez-vous ce devis ?"
   - Choix radio :
       ○ Prix trop élevé
       ○ Délai trop long
       ○ Travaux non prioritaires
       ○ Choix d'un autre prestataire
       ○ Autre
   - Commentaire optionnel
   - Bouton "Annuler" / "Confirmer le refus"
   │
   ▼
[Backend]
   - Update quote.status = 'refusé', refusal_reason
   - Notification commerciale immédiate
   - Activity log
   - Email à l'émetteur : "Devis refusé"
   │
   ▼
[Page de confirmation côté client]
   "Merci pour votre retour. Nous restons à votre disposition pour tout autre projet."
```

### 4.7 Conversion devis accepté en facture

```
[Fiche devis (status = accepté) → bouton "💶 Générer la facture"]
   │
   ▼
[Modal : Générer une facture depuis ce devis]
   - Type :
       ○ Facture finale (totalité)
       ○ Facture d'acompte (montant pré-rempli avec acompte_pct du devis)
       ○ Facture de situation (% à saisir)
   - Date de facture (default aujourd'hui)
   - Échéance (calculée selon conditions paiement client)
   - Lignes (héritées du devis, modifiables)
   - Bouton "Annuler"
   - Bouton "Générer la facture"
   │
   ▼
[Redirection vers Édition de facture (cf. module 07) avec données pré-remplies]
   - Lien `invoice.quote_id` créé
   - L'historique du devis montrera "Facture [ref] générée"
```

### 4.8 Duplication d'un devis

```
[Fiche devis → ⋯ → Dupliquer]
   │
   ▼
[Modal : Dupliquer ce devis]
   - Pour quel client ? (autocomplete, par défaut le même)
   - Lié à un chantier ? (autocomplete)
   - Garder le contenu :
       ☑ Lignes
       ☑ Conditions
       ☑ Pièces jointes
   - Date émission : aujourd'hui
   - Date expiration : +30 jours
   - Bouton "Dupliquer"
   │
   ▼
[Nouveau devis créé en brouillon, redirection édition]
```

### 4.9 Relances automatiques

Job Inngest quotidien à 9h :

```
Pour chaque devis en status='envoyé' ou 'consulté' :
   - Si days_since_sent == 7 ET pas encore relancé → envoi relance 1
   - Si days_since_sent == 15 ET pas encore relancé 2 → envoi relance 2
   - Si days_since_sent >= expiry_days → status='expiré' + email récap interne
```

**Templates relances** :

Relance 1 (J+7) :
> Bonjour,
> Avez-vous eu l'occasion d'étudier notre devis [ref] ?
> Nous restons à votre disposition pour toute question ou ajustement.
> [ Consulter le devis ]

Relance 2 (J+15) :
> Bonjour,
> Sauf erreur de notre part, nous n'avons pas reçu votre validation pour le devis [ref].
> Le devis expire le [date]. Au-delà, les conditions tarifaires pourraient être révisées.
> [ Consulter le devis ]

Désactivable au cas par cas (toggle dans modal d'envoi).

---

## 5. Écrans détaillés

### 5.1 Page Liste des devis

**URL** : `/quotes`

**Layout** : Header + tableau filtré.

**Header** :
- Titre "📄 Devis" + total.
- Filtres :
  - Statut (multi-select).
  - Période (issue_date).
  - Client (autocomplete).
  - Agence (multi).
  - Émetteur (multi).
  - Montant min/max.
  - Recherche full-text.
- Boutons :
  - "+ Nouveau devis" (orange).
  - "📤 Exporter".

**Tableau** :

| Colonne | Contenu |
|---|---|
| ☐ | Sélection |
| Réf | DEVIS-2026-0042 |
| Statut | Chip coloré (brouillon, envoyé, consulté, accepté, refusé, expiré) |
| Client | Nom + chip type |
| Sujet | Tronqué |
| Émis le | Date + jours depuis |
| Expire le | Date + alerte si <7j |
| Total TTC | Montant |
| Émetteur | Avatar + nom |
| Vu | Compteur consultations |
| Actions | ⋯ menu |

**Tri** : par défaut date émission desc. Tous les colonnes triables.
**Pagination** : 25 / 50 / 100.

**Cards stats en haut** :
- Devis envoyés ce mois.
- Taux d'acceptation (12 derniers mois).
- Montant en attente d'acceptation.
- Délai moyen acceptation.

### 5.2 Page Édition de devis

**URL** : `/quotes/new` ou `/quotes/:id/edit`
**Layout** : full page, pas de modal.

**Header sticky** :
- Référence devis (ou "Nouveau devis" si pas encore enregistré).
- Statut (chip).
- Indicateur auto-save.
- Boutons d'action (cf. parcours 4.1).
- Bouton "✕ Quitter" (avec confirmation si non sauvegardé).

**Body** :
- Section "Informations" (collapse possible) :
  - Client (avec lien fiche).
  - Chantier lié (avec lien fiche).
  - Sujet *.
  - Date émission, date expiration.
  - Émetteur (lecture seule).
- Section "Lignes" (cf. §5.4 éditeur WYSIWYG).
- Section "Totaux" (sticky bottom).
- Section "Conditions" (collapse).
- Section "Pièces jointes" (collapse).

### 5.3 Page Fiche devis (lecture)

**URL** : `/quotes/:id`
**Layout** : full page lecture, pas modal (vu volume info).

**Header** :
- Réf + statut.
- Boutons :
  - Si brouillon : "✏️ Reprendre l'édition".
  - Si envoyé/consulté : "🔁 Renvoyer", "❌ Annuler l'envoi" (owner uniquement).
  - Si accepté : "💶 Générer la facture", "📥 PDF accepté".
  - Toujours : "📥 PDF", "📋 Dupliquer", "📜 Historique".

**Cards stats en haut** :
- Statut + date.
- Total TTC.
- Date d'expiration.
- Nb consultations (avec hover : timeline des accès).

**Onglets** :
1. **📋 Détail** : récapitulatif lignes + totaux + conditions.
2. **📊 Activité** : timeline (créé, envoyé, consulté X fois, accepté/refusé, factures liées).
3. **📁 Pièces jointes** : PDF original, PDF accepté, annexes.
4. **🔗 Conversion** : factures liées à ce devis.

### 5.4 Éditeur de lignes WYSIWYG

**Implémentation** : TanStack Table + cell editing.

**UI** :

```
┌─┬────┬──────────────────────────┬─────┬──────┬──────────┬───────┬──────────┬────┐
│≡│ #  │ Description              │ Qté │ Unit │ PU HT    │ TVA   │ Total HT │ ⋯  │
├─┼────┼──────────────────────────┼─────┼──────┼──────────┼───────┼──────────┼────┤
│≡│ 1  │ ▼ PHASE 1 — Préparation                                                │
├─┼────┼──────────────────────────┼─────┼──────┼──────────┼───────┼──────────┼────┤
│≡│ 2  │ Démontage du radiateur   │ 1   │ u    │  120,00€ │ 20%   │  120,00€ │ ⋯  │
│≡│ 3  │ Curage tuyauterie        │ 4   │ ml   │   25,00€ │ 20%   │  100,00€ │ ⋯  │
├─┼────┼──────────────────────────┼─────┼──────┼──────────┼───────┼──────────┼────┤
│ │    │ Sous-total Phase 1       │     │      │          │       │  220,00€ │    │
├─┼────┼──────────────────────────┼─────┼──────┼──────────┼───────┼──────────┼────┤
│≡│ 4  │ ▼ PHASE 2 — Installation                                               │
├─┼────┼──────────────────────────┼─────┼──────┼──────────┼───────┼──────────┼────┤
│≡│ 5  │ Pose nouveau radiateur   │ 1   │ u    │  450,00€ │ 10%   │  450,00€ │ ⋯  │
│≡│ 6  │ Note: ATTESTATION TVA 10% requise pour ce client                       │
├─┴────┴──────────────────────────┴─────┴──────┴──────────┴───────┴──────────┴────┤
│ + Ligne d'article  + Section  + Sous-total  + Note                             │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Glisser-déposer pour réorganiser via la poignée gauche `≡`.
- Tab navigue entre les cellules d'une ligne.
- Enter à la fin d'une ligne ajoute une nouvelle ligne d'article.
- Ctrl+D duplique la ligne sélectionnée.
- Suppr supprime la ligne sélectionnée (avec confirmation).
- Description supporte multiline (Shift+Enter).
- Validation en temps réel (PU négatif refusé, quantité numérique).
- Auto-calcul Total HT = Qté × PU × (1 - remise/100).

### 5.5 Éditeur PDF — Aperçu

**Bouton "👁 Aperçu PDF"** :
- Génération inline (sans persister tant que pas envoyé).
- Affichage dans iframe.
- Boutons "Télécharger" et "Fermer".

### 5.6 Modal "Envoyer le devis"

Cf. parcours 4.3.

### 5.7 Page consultation publique

Cf. parcours 4.4.
**URL** : `/q/:public_token`

**Particularités** :
- Aucune navigation sidebar (page autonome).
- Branding organisation prioritaire (logo + couleurs custom si configuré).
- Footer avec mentions légales obligatoires de l'émetteur.
- Optimisée mobile.
- Pas de tracker tiers (RGPD).
- Logs d'accès stockés (date, IP, user-agent).

### 5.8 Modal acceptation et refus

Cf. parcours 4.5 et 4.6.

---

## 6. Génération PDF

### 6.1 Stack
- `@react-pdf/renderer` pour la mise en page.
- Composants React → PDF.
- Polices : Inter ou la police du branding organisation.
- Génération côté serveur (Next.js API route ou Inngest job pour les gros documents).

### 6.2 Structure du PDF

**Page 1 — En-tête + sommaire** :
- Logo organisation (haut gauche).
- Coordonnées émetteur (haut droite) : nom, adresse, SIRET, TVA, contact.
- Bandeau coloré charte.
- Titre : "DEVIS N° DEVIS-2026-0042".
- Date d'émission, date d'expiration.
- Encart "Émis pour : [Client]" + adresse.
- Encart "Lieu d'intervention : [Adresse chantier]".
- Sujet du devis.
- Texte d'introduction.

**Pages suivantes — Lignes** :
- Tableau des lignes avec sections, sous-totaux.
- Pagination automatique.
- Header de tableau répété sur chaque page.

**Page finale — Totaux + conditions** :
- Récapitulatif HT / TVA / TTC.
- Acompte demandé.
- Conditions de paiement.
- CGV (texte intégral).
- Encart "Bon pour accord" + ligne "Date : ____ Signature : ____" (pour signature manuelle si client préfère).
- Mentions obligatoires en footer (cf. §6.4).

**Pages annexes** : pièces jointes converties en PDF.

### 6.3 Branding personnalisé

Configurable par organisation dans Paramètres :
- Logo (haut).
- Couleur primaire (bandeau, totaux).
- Police (3 choix par défaut).
- Texte d'introduction par défaut.
- Texte de conclusion.
- CGV par défaut.
- Pied de page avec coordonnées.

### 6.4 Mentions obligatoires (BTP)

Présentes en footer ou page finale :
- Nom + raison sociale + statut juridique.
- Adresse siège social.
- SIRET.
- Numéro TVA intracommunautaire (si redevable TVA).
- Code APE/NAF.
- Numéro RCS.
- Capital social (si société).
- Si artisan : "Artisan immatriculé au Répertoire des Métiers de [Département]".
- Garanties professionnelles : RC Pro et décennale (numéro contrat + assureur).
- Médiateur de la consommation (obligatoire pour particuliers depuis 2016).
- Mention "Devis gratuit, sauf si étude technique poussée requise".
- Date limite d'acceptation.
- TVA applicable (mention "TVA non applicable, art. 293 B du CGI" si franchise).

### 6.5 Signature électronique simple

Sur le PDF "accepté" généré après acceptation client :
- Encart vert en haut "✓ DEVIS ACCEPTÉ".
- Nom signataire.
- Email.
- Adresse IP.
- Date + heure ISO 8601.
- Hash SHA-256 du PDF original (pour intégrité).

C'est une **signature électronique simple** au sens eIDAS — suffisante pour des montants courants. Pour une signature électronique avancée ou qualifiée (>50k€ ou clients très exigeants) : Phase 4 avec un fournisseur type Yousign / DocuSign.

---

## 7. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste devis | ✅ tous | ✅ ses agences | ✅ tous | ✅ ceux liés à ses chantiers | ✅ tous (lecture) |
| Voir détail devis | ✅ | ✅ | ✅ | ✅ (limité) | ✅ |
| Créer devis | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier brouillon | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Modifier devis envoyé | ❌ (interdit, intégrité) | ❌ | ❌ | ❌ | ❌ |
| Désémettre / annuler envoi | ✅ | ❌ | ❌ | ❌ | ❌ |
| Envoyer devis | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Renvoyer (relance manuelle) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Voir PDF accepté | ✅ | ✅ | ✅ | ✅ | ✅ |
| Convertir en facture | ✅ | ✅ | ✅ | ❌ | ❌ |
| Dupliquer | ✅ | ✅ | ✅ | ❌ | ❌ |
| Supprimer brouillon | ✅ | ✅ ses agences | ✅ | ❌ | ❌ |
| Modifier CGV organisation | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Workflows clés

### 8.1 Vérification attestation TVA réduite

Si une ligne avec TVA 10 % ou 5.5 % est créée :
- Vérification : le client a-t-il un document type "Attestation TVA 10%" en cours de validité (pas plus de 1 an) ?
- Si non : avertissement non bloquant en haut de l'éditeur :
  > ⚠️ Ce client n'a pas d'attestation TVA 10 % à jour. Une attestation est obligatoire pour les travaux de rénovation. [Demander au client] [Joindre une attestation]
- Si l'utilisateur ignore : devis créé mais alerte conservée jusqu'à régularisation.

### 8.2 Calcul automatique de l'acompte

Si `acompte_pct` est saisi :
- `acompte_amount_ht = total_ht × acompte_pct / 100`
- Affiché dans les totaux.
- Inscrit en clair dans le PDF : "Acompte de 30% à la signature : 440,41 € TTC".

### 8.3 Numérotation séquentielle

- Format paramétrable par organisation : `DEVIS-{YYYY}-{NNNN}` ou autre.
- Séquence par organisation (peut-être par agence si activé en paramètre).
- Atomique en DB (pas de duplication).
- Pas de trou : si un brouillon est supprimé, son numéro reste réservé (statut "annulé") pour la traçabilité.
- En réalité, on génère le numéro à l'envoi (status passe de brouillon → envoyé), pas à la création. Le brouillon a un identifiant interne mais pas encore de numéro légal.

### 8.4 Expiration automatique

Job Inngest quotidien à 6h :
- Pour chaque devis `envoyé` ou `consulté` avec `expiry_date < today` :
  - `status = 'expiré'`
  - Notification interne : "X devis ont expiré aujourd'hui".
  - Email récap quotidien à l'admin agence.

### 8.5 Conversion lots devis → facture

Pour les comptables qui veulent grouper :

```
[Liste devis → filtre status=accepté + non encore facturés]
   │
   ▼
[Multi-sélection 3 devis]
   │
   ▼
[Bouton "Générer 3 factures"]
   │
   ▼
[Confirmation + paramètres]
   - Date facture (commune ou par devis)
   - Pour chacun : type (finale / acompte / situation)
   - Bouton "Générer"
   │
   ▼
[Backend job Inngest]
   - Création des 3 factures en parallèle
   - Notification "3 factures créées"
```

---

## 9. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Création devis sans aucune ligne | Bloqué à l'envoi : "Ajoutez au moins une ligne avant d'envoyer." |
| Total négatif (remise globale > 100%) | Validation bloque la saisie |
| Devis envoyé puis client absent (jamais consulté) | Relances auto + expiration auto |
| Client click "Accepter" 2 fois (race condition) | Idempotent : 2ᵉ clic affiche "Déjà accepté" |
| Token public deviné (très improbable) | Vérification HMAC, sinon 404 |
| Lien public ouvert après expiration | Page : "Ce devis a expiré. Contactez-nous pour une nouvelle proposition." |
| Devis lié à un chantier supprimé | Devis reste, lien orphelin marqué dans l'UI |
| Devis lié à un client archivé | Création nouvelle facture bloquée tant que client pas réactivé |
| TVA 10 % sans attestation | Avertissement non bloquant à la création, consigné dans audit |
| Modification après acceptation | Bloqué : "Ce devis a été accepté, il ne peut plus être modifié. Pour ajuster, créez un avenant ou un nouveau devis." |
| 2 utilisateurs éditent le même brouillon | Last-write-wins + warning "Ce devis a été modifié par [user] il y a quelques secondes" |
| PDF generation timeout (gros devis) | Fallback Inngest job + notification "Votre PDF est en cours de génération" |
| Email rejeté par destinataire (bounce) | Notification interne "Email non délivré, vérifier l'adresse" |
| Caractères spéciaux dans description (apostrophes typographiques etc.) | Echappés correctement dans le PDF |

---

## 10. Critères d'acceptation

### 10.1 Édition
- ✅ Création brouillon en < 30s.
- ✅ Auto-save toutes les 5s.
- ✅ Drag & drop lignes fluide.
- ✅ Calcul totaux temps réel.
- ✅ Sections + sous-totaux fonctionnent.
- ✅ Multi-TVA correctement ventilé.

### 10.2 Envoi
- ✅ PDF généré conforme aux mentions légales.
- ✅ Email reçu avec lien fonctionnel et PDF en pièce jointe.
- ✅ Lien public accessible sans login.
- ✅ Statut passe à 'envoyé'.
- ✅ Numéro légal attribué uniquement à l'envoi.

### 10.3 Consultation publique
- ✅ Page mobile-friendly.
- ✅ Branding organisation correct.
- ✅ Stats consultation enregistrées.
- ✅ Notification interne au premier accès.

### 10.4 Acceptation / refus
- ✅ Acceptation 2-step (saisie + code email) fonctionne.
- ✅ PDF accepté généré et archivé.
- ✅ IP et horodatage enregistrés.
- ✅ Notifications internes immédiates.

### 10.5 Conversion en facture
- ✅ Lignes héritées correctement.
- ✅ Lien `invoice.quote_id` créé.
- ✅ Acompte ou facture finale selon choix.
- ✅ Possibilité de modifier la facture avant émission.

### 10.6 Numérotation
- ✅ Séquence sans trou par année.
- ✅ Pas de doublon possible (contrainte DB).
- ✅ Format respecté.

### 10.7 Permissions et RLS
- ✅ Un viewer ne peut pas créer.
- ✅ Un admin de Perpignan ne voit pas les devis exclusivement Montpellier.
- ✅ Token public non devinable (32 bytes random).

### 10.8 Performance
- ✅ Liste 1000 devis : < 1.5s.
- ✅ Génération PDF 30 lignes : < 3s.
- ✅ Auto-save n'impacte pas la frappe.

---

## 11. Métriques (PostHog)

### 11.1 Événements
- `quote.created` (props: source=chantier|ex_nihilo|duplicate, line_count_initial)
- `quote.line_added` (props: line_type)
- `quote.line_removed`
- `quote.line_reordered`
- `quote.preview_generated`
- `quote.sent` (props: line_count, total_ttc, has_acompte, recipients_count)
- `quote.viewed_by_client` (props: device, time_since_sent_hours)
- `quote.accepted` (props: time_since_sent_hours, acceptance_method)
- `quote.refused` (props: reason, time_since_sent_hours)
- `quote.expired` (props: was_viewed)
- `quote.duplicated`
- `quote.converted_to_invoice` (props: invoice_type)
- `quote.relance_sent` (props: relance_number)

### 11.2 KPIs
- Taux d'acceptation global et par segment client / métier (objectif > 50 %).
- Délai moyen envoi → acceptation (objectif < 7j pour syndics).
- Taux de consultation des devis envoyés (objectif > 80 %).
- Taux de devis acceptés non facturés à J+30 (KPI alerte).
- Montant total devis envoyés / mois (CA potentiel).
- Adoption des sections / sous-totaux (qualité documents).

---

## 12. Points ouverts à arbitrer plus tard

- **Catalogue d'articles centralisé** : prix unitaires standardisés, mise à jour annuelle (Phase 4).
- **Templates de devis par métier** : "Fuite radiateur", "Tableau électrique" pré-remplis (Phase 4).
- **Variantes / options dans un devis** : "Option A : peinture acrylique 2400€ / Option B : peinture haut de gamme 3200€" (Phase 4).
- **Devis multi-pages avec page de garde personnalisée** : pour les très gros devis (Phase 4).
- **Workflow d'approbation interne** : devis > 5000€ doivent être validés par un admin avant envoi (Phase 4).
- **Signature électronique avancée** : Yousign / DocuSign pour les très gros montants (Phase 4).
- **Devis en plusieurs langues** : Phase 5.
- **Tracking d'ouverture précis** : pixel email, savoir quel device, combien de temps lu (Phase 4).
- **Suggestion de prix par IA** : "Pour un chantier similaire, le prix moyen est de X" (Phase 5).

---

*Fin de la spec module 06 — Devis.*
*Prochaine spec : 07-factures-facturx.md (factures conformes Factur-X EN16931, séquence légale, paiements, relances impayés, export comptable).*
