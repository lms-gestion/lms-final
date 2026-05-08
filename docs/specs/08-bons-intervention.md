# Spec produit — Module 08 : Bons d'intervention

**Version** : 1.0
**Statut** : À implémenter en Sprint 12
**Dépendances** : Modules 01 (Auth), 02 (Équipe), 04 (Chantiers), 05 (Interventions), 07 (Factures)
**Sprint concerné** : Sprint 12

---

## 1. Objectif du module

Le bon d'intervention (BI) est le document opérationnel rempli sur le terrain à la fin d'une intervention. Il atteste de la prestation réalisée, du matériel utilisé, du temps passé, et reçoit la signature du client. C'est la pièce justificative principale entre le devis et la facture pour les interventions de maintenance ou de SAV.

Le module couvre :

- la **création d'un bon d'intervention** (depuis une intervention terminée, depuis la fiche chantier, ou ex nihilo).
- la **saisie du contenu** : description des travaux réalisés, matériel utilisé, temps réel passé, photos avant/après, remarques du client.
- la **signature client** : Phase 1 = encart imprimable ou PDF émis avec emplacement signature ; Phase 1 fin = signature dessinée à l'écran sur tablette ou ordinateur ; Phase 2 = signature mobile native.
- la **génération PDF** professionnelle.
- la **conversion en facture** : 1 BI peut donner lieu à 1 facture (ou plusieurs, ou s'agréger avec d'autres BI dans une facture mensuelle).
- la **gestion des refus** : client refuse de signer → motif, escalade.
- la **relance** : BI non signé sous X jours.
- les **statuts** : `brouillon`, `prêt_à_signer`, `signé`, `refusé`, `expiré`, `facturé`.
- l'**impression directe** depuis l'app (pour les techs qui préfèrent papier en attendant Phase 2).

**Hors périmètre du module** :
- Signature électronique avancée eIDAS qualifiée (Phase 4 si besoin pour gros marchés).
- Mode totalement hors-ligne sur mobile (Phase 2 avec sync).
- Génération automatique de factures groupées multi-BI mensuelles (Phase 3).
- OCR de bon papier signé scanné a posteriori (Phase 3 IA).
- Templates de BI personnalisés (Phase 4).

---

## 2. Modèle conceptuel

### 2.1 Différence entre Devis, BI et Facture

| Document | Quand | Émis par | Pour | Valeur |
|---|---|---|---|---|
| **Devis** | Avant travaux | L'entreprise | Le client | Engagement commercial |
| **Bon d'intervention** | Après travaux | L'entreprise (technicien) | Le client (signature) | Preuve de réalisation, base de facturation |
| **Facture** | Après BI signé (en général) | L'entreprise | Le client | Document comptable légal |

Un BI peut exister sans devis préalable (intervention d'urgence, contrat de maintenance, dépannage simple).

### 2.2 Schéma simplifié

```
┌─────────────────────────────┐
│  intervention_orders (BI)   │
│  - reference BI-2026-...    │
│  - chantier_id              │
│  - intervention_id (opt)    │
│  - technician_id            │
│  - status                   │
│  - work_description         │
│  - materials JSONB          │
│  - arrival/departure times  │
│  - signatures               │
│  - pdf_url                  │
└────────────┬────────────────┘
             │ 1..n
             ▼
┌──────────────────────────┐
│  intervention_order_lines│ (matériel et prestations)
│  - description           │
│  - quantity, unit        │
│  - unit_price_ht         │
│  - vat_rate              │
└──────────────────────────┘
```

### 2.3 Champs principaux d'un BI

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | |
| `organization_id` | UUID | ✅ | |
| `agency_id` | UUID | ✅ | |
| `reference` | TEXT | ✅ | "BI-2026-0042" auto |
| `chantier_id` | UUID | ✅ | Chantier rattaché |
| `intervention_id` | UUID | ❌ | Intervention rattachée (1 BI = 1 intervention en général) |
| `technician_id` | UUID | ✅ | Tech intervenant |
| `status` | TEXT | ✅ | Cf. workflow §2.4 |
| `intervention_date` | DATE | ✅ | Date d'intervention |
| `arrival_time` | TIMESTAMPTZ | ❌ | Heure d'arrivée réelle |
| `departure_time` | TIMESTAMPTZ | ❌ | Heure de départ réelle |
| `actual_duration_minutes` | INT | ❌ | Calculé |
| `work_description` | TEXT | ✅ | Description des travaux réalisés |
| `materials` | JSONB | ❌ | Liste matériel utilisé (modèle structuré phase 1, structure libre Phase 1 fin) |
| `additional_notes` | TEXT | ❌ | Remarques techniques |
| `client_remark` | TEXT | ❌ | Remarques laissées par le client |
| `next_action` | TEXT | ❌ | Action de suivi à prévoir |
| `requires_revisit` | BOOLEAN | ❌ | Nouvelle intervention requise |
| `client_satisfied` | BOOLEAN | ❌ | Client satisfait de la prestation (Phase 2 mobile : étoile rating) |
| `client_signature_url` | TEXT | ❌ | URL Storage de l'image signature (PNG transparent) |
| `client_signature_name` | TEXT | ❌ | Nom du signataire client |
| `client_signature_role` | TEXT | ❌ | Rôle (locataire, gardien, gestionnaire...) |
| `client_signature_at` | TIMESTAMPTZ | ❌ | Horodatage signature |
| `client_signature_ip` | INET | ❌ | IP au moment de la signature |
| `technician_signature_url` | TEXT | ❌ | Signature tech |
| `technician_signature_at` | TIMESTAMPTZ | ❌ | |
| `refusal_reason` | TEXT | ❌ | Si refusé |
| `refusal_explanation` | TEXT | ❌ | Détail |
| `pdf_url` | TEXT | ❌ | PDF signé final |
| `total_ht` | NUMERIC(12,2) | ❌ | Calculé depuis lignes |
| `total_ttc` | NUMERIC(12,2) | ❌ | |
| `invoice_id` | UUID | ❌ | Facture issue de ce BI |
| `public_token` | TEXT | ✅ | Lien public consultation |
| `created_by` | UUID | ✅ | |
| `created_at`, `updated_at` | TIMESTAMPTZ | ✅ | |

### 2.4 Workflow de statuts

```
                        ┌──────────────┐
                        │  brouillon   │
                        └──────┬───────┘
                               │ Finaliser
                               ▼
                        ┌────────────────┐
                        │ prêt_à_signer  │
                        └──┬─────┬───┬───┘
                           │     │   │
                  Signé   Refusé  Expiré (J+30)
                           │     │   │
                           ▼     ▼   ▼
                       ┌──────┐ ┌──────┐ ┌──────┐
                       │signé │ │refusé│ │expiré│
                       └──┬───┘ └──────┘ └──────┘
                          │ Convertir en facture
                          ▼
                       ┌──────┐
                       │facturé│
                       └──────┘
```

**Règles** :
- Un BI **brouillon** est éditable.
- Un BI **prêt_à_signer** : le PDF avec emplacement signature est généré, il est dans l'attente d'une action client.
- Un BI **signé** : le PDF est immutable.
- Un BI **refusé** : motif obligatoire.
- Un BI peut être lié à une facture (`invoice_id`). Plusieurs BIs peuvent être agrégés dans une seule facture (Phase 3).

### 2.5 Structure JSONB `materials`

```json
{
  "items": [
    {
      "type": "material",          // material | labor | travel | other
      "description": "Joint cuivre 1/2 pouce",
      "quantity": 4,
      "unit": "u",
      "unit_price_ht": 2.50,
      "vat_rate": 20.00,
      "total_ht": 10.00
    },
    {
      "type": "labor",
      "description": "Main d'œuvre — plomberie",
      "quantity": 2.5,
      "unit": "h",
      "unit_price_ht": 65.00,
      "vat_rate": 20.00,
      "total_ht": 162.50
    },
    {
      "type": "travel",
      "description": "Déplacement",
      "quantity": 1,
      "unit": "forfait",
      "unit_price_ht": 35.00,
      "vat_rate": 20.00,
      "total_ht": 35.00
    }
  ]
}
```

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue d'ensemble BIs émis, supervision conformité |
| **Chef d'agence (admin)** | Création de BI ex nihilo, vérification, déblocage refus |
| **Comptable (accountant)** | Conversion BI → facture, agrégation mensuelle, export |
| **Technicien (technician)** | **Acteur principal** : remplit le BI sur le terrain, fait signer, soumet |
| **Lecture seule (viewer)** | Audit |

**Persona externe** :

| Persona | Cas d'usage |
|---|---|
| **Client / locataire / gardien** | Reçoit le BI, le signe (sur écran ou papier), fait des remarques |

---

## 4. Parcours utilisateur

### 4.1 Création BI depuis une intervention terminée (parcours principal)

```
[Module 05 — Intervention passe en status='terminée']
   │
   ▼
[Modal de clôture intervention (cf. module 05 §4.5)]
   - Toggle "Générer un bon d'intervention" coché par défaut
   │
   ▼
[Page Édition BI — pré-rempli]
   - Référence BI auto : BI-2026-NNNN
   - Chantier, intervention, technicien : pré-remplis
   - Date intervention, heure arrivée/départ : depuis intervention
   - Description des travaux : pré-remplie depuis "compte-rendu" intervention si saisi
   - Matériel : vide, à compléter
   │
   ▼
[Section "Travaux réalisés"]
   - Description (textarea, multiline, requise)
   - Sous-section : photos avant / pendant / après (drag & drop ou bouton parcourir)
   │
   ▼
[Section "Matériel et main d'œuvre" (TanStack Table)]
   - Boutons d'ajout : "+ Matériel" / "+ Main d'œuvre" / "+ Déplacement" / "+ Autre"
   - Pour main d'œuvre : autocomplete depuis tarifs paramétrés (ex : "MO Plomberie tech : 65 €/h")
   - Pour matériel : autocomplete depuis bibliothèque (Phase 4) ou saisie libre
   - Calcul auto Total HT / TTC
   │
   ▼
[Section "Suite à donner"]
   - Toggle "Nouvelle intervention nécessaire" → ouvre modal de planification (cf. module 05)
   - Action de suivi (textarea)
   │
   ▼
[Section "Remarques"]
   - Notes techniques internes (visible team uniquement)
   - Remarques client (saisi par le tech avec le client : "Le robinet de la salle de bain fait du bruit")
   │
   ▼
[Bouton "💾 Brouillon" / "📋 Préparer la signature"]
   │
   ▼
[Bouton "Préparer la signature" → status='prêt_à_signer']
   - Génération PDF avec emplacement signature
   - 3 options de signature :
       1. "✏️ Faire signer maintenant" (canvas signature à l'écran)
       2. "🖨 Imprimer pour signature papier"
       3. "📧 Envoyer au client par email pour signature à distance"
```

### 4.2 Signature à l'écran (Phase 1 fin / Phase 2)

```
[Bouton "✏️ Faire signer maintenant"]
   │
   ▼
[Modal plein écran : Signature client]
   - Récapitulatif compact du BI :
       • Référence
       • Travaux réalisés (résumé)
       • Total HT / TTC
   - Section "Le client signe ici"
       • Champ : Nom du signataire (saisie tactile / clavier)
       • Champ : Rôle (locataire, gardien, propriétaire, gestionnaire)
       • Canvas de signature (zone tactile pour stylet doigt) :
           ┌────────────────────────────────┐
           │                                │
           │     [Zone de signature]        │
           │                                │
           └────────────────────────────────┘
           [ Effacer ] [ Annuler ] [ Valider ]
   - Texte légal en bas :
     "En signant, [Nom] reconnaît la bonne exécution des travaux décrits ci-dessus
      et accepte la facturation à venir pour le montant de [TTC] €."
   - Checkbox "☑ Le client a pris connaissance des conditions"
   - Bouton "✓ Confirmer la signature"
   │
   ▼
[Backend]
   - Capture du canvas → image PNG transparent → upload Supabase Storage
   - Update BI :
       • status='signé'
       • client_signature_url, client_signature_name, client_signature_role
       • client_signature_at = now
       • client_signature_ip
   - Régénération PDF final avec signature intégrée + horodatage + QR code de vérification
   - Stockage immutable
   - Activity log
   - Notification interne au comptable : "BI signé — prêt à facturer"
   │
   ▼
[Page de remerciement avec récapitulatif]
   - "Merci ! Le bon d'intervention a été signé."
   - Bouton "📥 Envoyer une copie par email au client"
   - Bouton "Retour au planning"
```

### 4.3 Signature à distance (envoi par email)

```
[Bouton "📧 Envoyer au client par email"]
   │
   ▼
[Modal d'envoi]
   - Destinataire (auto-rempli : email locataire, gardien, ou contact client)
   - Sujet pré-rempli
   - Message pré-rempli
   - Lien public sécurisé : https://app.lms.fr/bi/{public_token}
   - Bouton "Envoyer"
   │
   ▼
[Email reçu par le client]
   - Bouton "Consulter et signer le bon d'intervention"
   - Lien expire dans 30 jours
   │
   ▼
[Page publique signature à distance (mobile-friendly)]
   - Récapitulatif BI (lecture)
   - Photos avant/après
   - Détail matériel et MO
   - Section signature (canvas idem flow 4.2)
   - Bouton "Refuser" en bas (avec motif)
   │
   ▼
[Backend identique au flow 4.2]
   - Notification interne dès la signature
```

### 4.4 Signature papier (impression)

Cas typique pour les techs qui préfèrent le papier ou n'ont pas de tablette.

```
[Bouton "🖨 Imprimer pour signature papier"]
   │
   ▼
[PDF généré avec emplacement signature et instructions]
   - Document A4 propre
   - En bas :
       "Bon pour accord
        Date : __________   Lieu : __________
        Nom du signataire : ___________________
        Rôle : ___________________
        Signature :
        _______________________"
   - Le tech imprime, fait signer en physique
   │
   ▼
[De retour au bureau, le tech (ou un admin) scanne le BI signé]
   │
   ▼
[Bouton "📷 Charger le BI signé" sur la fiche]
   - Upload du scan
   - Modal "Confirmer la signature reçue"
       - Date de signature : (default aujourd'hui)
       - Nom signataire (saisie)
       - Rôle (saisie)
       - Bouton "✓ Marquer comme signé"
   │
   ▼
[Backend]
   - status='signé'
   - PDF original conservé + scan signé attaché
   - Activity log mentionne "Signature papier scannée"
```

### 4.5 Refus de signature

```
[Page publique ou modal signature à l'écran → bouton "Refuser"]
   │
   ▼
[Modal : Pourquoi refusez-vous de signer ?]
   - Motif (radio) :
       ○ Travaux non conformes au devis
       ○ Travaux non terminés
       ○ Problème technique non résolu
       ○ Désaccord sur le prix
       ○ Autre
   - Détail (textarea, optionnel)
   - Bouton "Confirmer le refus"
   │
   ▼
[Backend]
   - status='refusé'
   - refusal_reason, refusal_explanation
   - Notification immédiate :
       • Tech intervenant
       • Admin agence
   - Le tech doit reprendre l'intervention ou créer un avenant
   │
   ▼
[Côté admin : alerte sur dashboard]
   - "🔴 BI [ref] refusé par le client — Action requise"
   - Possibilité de :
       • Replanifier une intervention de reprise
       • Annuler le BI
       • Forcer la facturation (rare, justification écrite)
```

### 4.6 Conversion BI signé → facture

```
[Fiche BI signé → bouton "💶 Générer la facture"]
   │
   ▼
[Modal : Type de facturation]
   - ○ Facture immédiate
   - ○ Ajouter à la facture mensuelle du client (si paramètre activé pour ce client)
   - Si immédiat :
       - Date facture (défaut aujourd'hui)
       - Date échéance (depuis client.payment_terms_days)
   - Bouton "Générer"
   │
   ▼
[Redirection vers Édition de facture (module 07)]
   - Lignes héritées du BI (matériel + MO)
   - Lien BI ↔ facture créé
   - Mention sur la facture : "Suite au bon d'intervention BI-2026-NNNN du [date]"
   │
   ▼
[Émission de la facture standard]
   │
   ▼
[Backend]
   - BI passe en status='facturé'
   - intervention_orders.invoice_id = facture créée
```

### 4.7 Création BI ex nihilo

Cas : intervention non planifiée (urgence sans pré-création), contrat de maintenance forfaitaire.

```
[Page BI → "+ Nouveau BI"]
   │
   ▼
[Modal court initial]
   - Chantier (autocomplete) ou "Créer un chantier rapide"
   - Technicien (default = user connecté si tech)
   - Date intervention
   - Bouton "Créer brouillon"
   │
   ▼
[Page Édition vide pré-remplie avec ces données]
   (Reste identique au flow 4.1)
```

### 4.8 Relance signature

Job Inngest quotidien :
- Pour chaque BI status='prêt_à_signer' avec age > 7 jours :
  - Email de relance au client
- Age > 14 jours : 2ᵉ relance.
- Age > 30 jours : status='expiré' + notification interne.

---

## 5. Écrans détaillés

### 5.1 Page Liste des BI

**URL** : `/intervention-orders`

**Header** :
- Titre "📋 Bons d'intervention".
- Cards stats :
  - BI signés ce mois.
  - En attente de signature.
  - Refusés (rouge).
  - À facturer.
- Filtres : statut, période, technicien, agence, client.
- Bouton "+ Nouveau BI".

**Tableau** :

| Colonne | Contenu |
|---|---|
| ☐ | Sélection |
| Réf | BI-2026-0042 |
| Statut | Chip coloré |
| Chantier | Lien |
| Client | Nom |
| Tech | Avatar + nom |
| Date | Date intervention |
| Total TTC | Montant |
| Signature | Date + nom signataire |
| Actions | ⋯ |

### 5.2 Page Édition BI

**URL** : `/intervention-orders/:id/edit`

Layout : full page, sticky header avec actions.

**Sections** (cf. parcours 4.1) :
- Informations générales (chantier, tech, date).
- Travaux réalisés.
- Photos.
- Matériel et MO.
- Suite à donner.
- Remarques.
- Action en bas : "Brouillon" / "Préparer la signature".

### 5.3 Page Fiche BI

**URL** : `/intervention-orders/:id`

**Header** :
- Réf + statut.
- Boutons selon statut :
  - Brouillon : "✏️ Reprendre l'édition", "🗑 Supprimer".
  - Prêt à signer : "✏️ Faire signer", "📧 Envoyer", "🖨 Imprimer", "📷 Charger BI signé".
  - Signé : "💶 Générer facture", "📥 PDF signé", "🔗 Lien public".
  - Refusé : "📅 Replanifier", "🚫 Annuler", note motif visible.

**Cards stats** :
- Statut + date.
- Total TTC.
- Tech intervenant.
- Lien chantier + client.

**Onglets** :
1. **📋 Détail** : récap travaux + matériel + MO.
2. **📷 Photos** : galerie avant / pendant / après.
3. **✏️ Signatures** : signatures client + tech, scan PDF.
4. **📊 Activité** : timeline (créé, signé, facturé...).
5. **🔗 Liens** : intervention source, chantier, facture issue, devis lié.

### 5.4 Modal "Signature à l'écran"

Cf. parcours 4.2.

**Spécificités UX** :
- Mode plein écran sur tablette (orientation paysage recommandée).
- Désactivation des notifs et popups système pendant la signature (PWA fullscreen API).
- Message si écran trop petit : "Tournez votre tablette en mode paysage pour signer plus confortablement."
- Sauvegarde du dessin canvas en PNG haute résolution.

### 5.5 Page publique signature à distance

**URL** : `/bi/:public_token`

**Layout mobile-first** :
- Header avec logo organisation.
- Récapitulatif BI compact.
- Photos en swiper.
- Détail matériel + MO.
- Section signature en bas (canvas + champs).
- Lien "Refuser" plus discret.
- Optimisé tactile.

### 5.6 Modal "Charger BI signé scanné"

Cf. parcours 4.4.

### 5.7 Modal "Refus de signature"

Cf. parcours 4.5.

---

## 6. Génération PDF

### 6.1 Stack
Identique aux modules 06/07 : `@react-pdf/renderer`.

### 6.2 Structure du PDF

**Page 1 — Titre + en-tête**
- Logo organisation.
- Coordonnées émetteur.
- Titre : "BON D'INTERVENTION N° BI-2026-0042".
- Date d'intervention.
- Référence chantier liée.
- Bloc "Émis pour : [Client]" + adresse intervention.
- Bloc "Technicien : [Nom + métier]".

**Page principale — Détail**
- Section "Description des travaux réalisés".
- Section "Photos" (mini-thumbs cliquables ou page séparée pour grand format).
- Section "Matériel utilisé" (tableau).
- Section "Main d'œuvre" (tableau).
- Section "Déplacements et autres" (tableau).
- Totaux HT / TVA / TTC.

**Section signature**
- Si non signé : encart "Bon pour accord" + lignes vierges.
- Si signé :
  - Cadre vert : "✓ SIGNÉ".
  - Image signature client.
  - Nom + rôle + date + heure + IP.
  - QR code de vérification (lien public + hash).
- Si scan papier : intégration de l'image scannée.

**Section légale**
- Mentions obligatoires.
- "Ce document atteste de la réalisation des travaux décrits. Il sert de base à la facturation à venir."

### 6.3 QR code de vérification

Sur les BI signés, un QR code permet de vérifier l'authenticité :
- URL : `https://app.lms.fr/verify/bi/{public_token}`.
- Page de vérification publique :
  - Affiche les données clés : référence, date, signature, hash SHA-256 du PDF.
  - Permet de vérifier que le PDF n'a pas été altéré.

---

## 7. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste BI | ✅ tous | ✅ ses agences | ✅ tous | ✅ ses BI | ✅ tous (limité) |
| Voir détail BI | ✅ | ✅ | ✅ | ✅ ses BI | ✅ |
| Créer BI brouillon | ✅ | ✅ | ❌ | ✅ ses chantiers | ❌ |
| Modifier brouillon | ✅ | ✅ ses agences | ❌ | ✅ ses BI | ❌ |
| Préparer signature | ✅ | ✅ | ❌ | ✅ ses BI | ❌ |
| Faire signer (à l'écran) | ✅ | ✅ | ❌ | ✅ ses BI | ❌ |
| Envoyer pour signature à distance | ✅ | ✅ | ❌ | ✅ ses BI | ❌ |
| Charger BI scanné | ✅ | ✅ | ❌ | ✅ ses BI | ❌ |
| Marquer signé manuellement | ✅ | ✅ | ❌ | ❌ | ❌ |
| Annuler BI signé | ✅ | ❌ | ❌ | ❌ | ❌ |
| Convertir en facture | ✅ | ✅ | ✅ | ❌ | ❌ |
| Forcer facturation après refus | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Workflows clés

### 8.1 Numérotation BI

- Format : `BI-{YYYY}-{NNNN}` paramétrable.
- Séquence par organisation, séparée des factures et devis.
- Attribution à la création (pas à la signature, contrairement aux factures).

### 8.2 Bibliothèque tarifs MO et matériel

Stockée dans `organization_settings.pricing_library` :

```json
{
  "labor_rates": [
    { "code": "MO_PLOMB", "label": "MO Plomberie technicien", "unit": "h", "unit_price_ht": 65 },
    { "code": "MO_ELEC",  "label": "MO Électricité technicien", "unit": "h", "unit_price_ht": 70 }
  ],
  "travel_rates": [
    { "code": "DEP_LOC", "label": "Déplacement local (<15 km)", "unit": "forfait", "unit_price_ht": 35 },
    { "code": "DEP_REG", "label": "Déplacement régional", "unit": "km", "unit_price_ht": 0.65 }
  ],
  "materials": [
    { "code": "JOINT_12", "label": "Joint cuivre 1/2 pouce", "unit": "u", "unit_price_ht": 2.50 }
  ]
}
```

Phase 4 : catalogue centralisé avec gestion stocks. Phase 1 : saisie libre + suggestions depuis bibliothèque.

### 8.3 Agrégation mensuelle (Phase 3)

Pour les contrats de maintenance avec facturation récurrente :
- Paramètre client `billing_mode='monthly_aggregate'`.
- Les BIs signés s'accumulent pendant le mois.
- Le 1er du mois suivant : job Inngest génère une facture unique récap.
- Les BIs passent en status='facturé' avec lien `invoice_id` commun.

Phase 1 : facturation unitaire seule. Phase 3 : agrégation.

### 8.4 Notifications

| Événement | Destinataire | Canal |
|---|---|---|
| BI créé | Tech assigné | In-app |
| BI prêt à signer envoyé au client | Tech + admin | In-app |
| Client a consulté le lien | Tech + admin | In-app |
| Client a signé | Comptable + admin | Email + in-app (pour conversion facture) |
| Client a refusé | Tech + admin (URGENT) | Email + in-app + push (Phase 2) |
| BI expiré (J+30) | Admin agence | Email récap quotidien |

### 8.5 Validation tech avant envoi

Avant qu'un tech puisse "Préparer la signature", l'app vérifie :
- Description des travaux : non vide.
- Au moins une ligne (matériel ou MO).
- Heures arrivée et départ : renseignées.

Si non : message clair des champs manquants.

---

## 9. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| BI signé puis modification tentée | Bloqué : "Un BI signé ne peut être modifié. Pour corriger, annulez (owner) et créez un nouveau BI." |
| Annulation BI signé | Owner uniquement, raison obligatoire, notification client (email d'annulation), si déjà facturé → générer un avoir |
| Suppression BI brouillon | OK avec confirmation |
| Client refuse de signer mais tech veut quand même facturer | Owner peut "Forcer la facturation" avec justification écrite (audit log) |
| Signature canvas dessin trop léger / illisible | Warning : "La signature semble incomplète. Confirmer ou redessiner ?" |
| Lien public expiré (>30j) | Page : "Ce bon a expiré. Contactez-nous pour le renouveler." |
| BI lié à intervention annulée | Le BI reste, mais notification au tech "L'intervention liée a été annulée" |
| Intervention modifiée après création BI | BI conserve les données snapshot, pas de propagation auto |
| Tech qui veut éditer un BI d'un autre tech | Bloqué (sauf admin) |
| Charger un scan de BI signé non lisible | Warning visuel mais upload accepté (audit responsabilité utilisateur) |
| Total HT négatif | Bloqué : pas de remise > 100% |
| Photos > 100 Mo total | Compression auto à l'upload, ou refus si trop lourd |
| Caractères spéciaux dans description | Échappés dans XML/PDF |
| Plusieurs signatures sur le même BI | 1 client + 1 tech max ; nouvelles signatures écrasent l'ancienne avec audit |

---

## 10. Critères d'acceptation

### 10.1 Création
- ✅ BI créé depuis intervention pré-rempli correctement.
- ✅ BI ex nihilo créable.
- ✅ Référence générée à la création.
- ✅ Validation des champs obligatoires avant "Préparer la signature".

### 10.2 Édition
- ✅ Auto-save toutes les 5s en mode brouillon.
- ✅ Photos upload avec compression auto.
- ✅ Calcul total HT/TTC en temps réel.
- ✅ Suggestions depuis bibliothèque tarifs fonctionnent.

### 10.3 Signature
- ✅ Canvas signature fonctionnel sur desktop, tablette, mobile.
- ✅ Capture image PNG haute résolution.
- ✅ Données légales (nom, rôle, date, IP) capturées.
- ✅ PDF final intègre la signature.
- ✅ QR code de vérification fonctionnel.
- ✅ Hash SHA-256 du PDF stocké et vérifiable.

### 10.4 Refus
- ✅ Motif obligatoire.
- ✅ Notification immédiate à tech + admin.
- ✅ Status='refusé' verrouille la facturation (sauf force admin).

### 10.5 Conversion facture
- ✅ Lignes héritées correctement.
- ✅ Lien BI ↔ facture créé.
- ✅ Status='facturé' après émission facture.

### 10.6 Permissions
- ✅ Tech voit uniquement ses BI.
- ✅ BI signé immutable pour tous (sauf annulation owner).
- ✅ RLS bloque accès cross-organisation.

### 10.7 PDF
- ✅ PDF lisible, propre, conforme.
- ✅ Signature visible et nette.
- ✅ Mentions légales présentes.
- ✅ QR code lisible (test scan smartphone).

---

## 11. Métriques (PostHog)

### 11.1 Événements
- `bi.created` (props: source=intervention|exnihilo|chantier)
- `bi.materials_added` (props: type, count)
- `bi.prepared_for_signature`
- `bi.signed` (props: signature_method=canvas|paper_scan|distance, time_to_sign_minutes)
- `bi.refused` (props: reason)
- `bi.expired`
- `bi.invoice_generated`
- `bi.printed`
- `bi.distance_link_sent`
- `bi.distance_link_opened`
- `bi.qr_verified`

### 11.2 KPIs
- Taux de signature : objectif > 90 % (sur prêt_à_signer).
- Délai moyen prêt → signé : objectif < 24h pour signature à l'écran, < 7j à distance.
- Taux de refus : objectif < 3 % (KPI qualité prestation).
- Taux conversion BI signé → facture : objectif > 95 % à J+15.
- Adoption signature électronique vs papier (objectif > 70 % à 3 mois).

---

## 12. Points ouverts à arbitrer plus tard

- **Templates de BI par type d'intervention** : "Maintenance plomberie trimestrielle" pré-rempli (Phase 4).
- **Signature via SMS** : OTP sur téléphone du client (Phase 4).
- **Géolocalisation au moment de la signature** : preuve de présence sur le lieu (Phase 2 mobile).
- **Vidéo avant/après** : compléter les photos (Phase 3, dépend de la bande passante mobile).
- **Reconnaissance vocale du tech pour la description** (Phase 3 IA).
- **Signature électronique avancée eIDAS** (Phase 4 pour gros marchés publics ou très gros syndics).
- **Multi-signatures** : co-signataire (par exemple 2 gestionnaires de copro qui signent ensemble) (Phase 4).
- **Workflow d'approbation interne** : un BI > X € doit être approuvé par admin avant envoi au client (Phase 4).
- **Intégration ChainLock blockchain** pour preuve immuable (Phase 5, gadget).
- **OCR des BI papier scannés** pour extraction auto (Phase 3 IA).

---

*Fin de la spec module 08 — Bons d'intervention.*
*Prochaine spec : 09-import-ia-migration.md (pipeline Claude API, OCR, scoring de confiance, scripts migration Electron + Interfast).*
