# Spec produit — Module 09 : Import IA & Migration

**Version** : 1.0
**Statut** : À implémenter en Sprint 13
**Dépendances** : Modules 01 à 08 (toutes les entités cibles)
**Sprint concerné** : Sprint 13

---

## 1. Objectif du module

Module qui regroupe deux fonctions distinctes mais liées techniquement :

**A. Import IA** : permettre à un utilisateur de glisser un document (BC, facture, attestation, photo) ou de saisir du texte libre, et que l'application extraie automatiquement les informations pertinentes pour créer ou enrichir un chantier, une facture, un client. Pipeline :
- détection automatique du type de document.
- extraction structurée via **Claude API (claude-sonnet-4-6)** avec vision pour images et PDFs.
- OCR de fallback (Tesseract.js) si l'API Claude est indisponible ou désactivée.
- scoring de confiance par champ.
- validation utilisateur systématique avant création d'entité.
- traçabilité complète des extractions et corrections.

**B. Migration** : permettre la bascule des données existantes (Electron `lms-data.json` et exports Interfast) vers la nouvelle plateforme SaaS, avec mode dry-run, détection de doublons, et rapport de réconciliation.

Le module couvre :
- l'**activation/désactivation** de l'IA par organisation (paramètre).
- les **caps budgétaires** mensuels (alerte + blocage à seuil défini).
- les **prompts spécialisés** par type de document.
- le **logging exhaustif** dans `ai_imports` pour audit, amélioration prompts, et fine-tuning futur (Phase 3).
- la **boucle d'amélioration** : capture des corrections utilisateur pour optimiser les prompts.
- les **scripts de migration** atomiques avec rollback.
- la **période de coexistence** (3 mois cf. cadrage Phase 1).

**Hors périmètre du module** :
- Saisie vocale technicien et rapport IA (Phase 3).
- Fine-tuning de modèles propriétaires (Phase 4-5).
- Reconnaissance manuscrite avancée (Phase 4).
- Intégration directe avec Foncia/Nexity API (Phase 4 si possible).
- Auto-création d'entités sans validation (Phase 4 quand confiance > 99 %).

---

## 2. Architecture du pipeline IA

### 2.1 Vue d'ensemble

```
┌────────────────────────────────────────────────────────┐
│  Sources d'entrée                                      │
│  • Drop fichier (PDF, JPG, PNG, TIFF)                 │
│  • Saisie texte libre                                 │
│  • Upload depuis email (forward, Phase 4)             │
│  • Photo prise depuis mobile (Phase 2)                │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Pré-traitement                                        │
│  • Validation type / taille                           │
│  • Stockage Supabase Storage (chiffré)                │
│  • Génération preview / thumbnail                     │
│  • Extraction métadonnées (EXIF, PDF info)            │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Détection du type de document (classification)        │
│  Méthode 1 : règles (regex sur nom + premier scan)    │
│  Méthode 2 : Claude vision rapide (haïku) si dispo    │
│  Sortie : type ∈ {bc, facture, attestation, photo,    │
│           devis_recu, autre}                           │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Routage vers extracteur spécialisé                    │
│  • BC → extract_bon_de_commande (prompt + vision)     │
│  • Facture → extract_facture                          │
│  • Attestation → classify_attestation                 │
│  • Photo + ref → match_chantier                       │
│  • Texte libre → extract_text                         │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Extraction Claude API (claude-sonnet-4-6)            │
│  • Tool use avec schéma JSON strict                   │
│  • Vision pour images / PDFs scannés                  │
│  • Retour : payload + score de confiance par champ    │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Post-traitement et matching                          │
│  • Validation Zod des champs                          │
│  • Normalisation (téléphones, codes postaux, dates)   │
│  • Match avec entités existantes (clients, lieux,     │
│    chantiers, fournisseurs)                           │
│  • Détection action : create | update | classify      │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  UI de validation utilisateur                         │
│  • Affichage par champ avec confiance (vert/orange/   │
│    rouge)                                             │
│  • Édition inline                                     │
│  • Suggestions liens entités existantes               │
│  • Confirmation finale → création / mise à jour       │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Persistance + audit                                  │
│  • Insert ai_imports (raw + result + corrections)     │
│  • Insert/update entités cibles                       │
│  • Comptage tokens / coût                             │
│  • Activity log                                       │
└────────────────────────────────────────────────────────┘
```

### 2.2 Stack technique

| Composant | Choix | Notes |
|---|---|---|
| LLM principal | Claude Sonnet 4.6 (`claude-sonnet-4-6`) via SDK Anthropic | Excellent FR + vision native |
| LLM rapide (classification) | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Détection type, ~10× moins cher |
| OCR fallback | Tesseract.js (lib JS, langues fra+eng) | Tourne dans un job Inngest si Claude désactivé ou échec |
| Job runner | Inngest | Orchestration des étapes async |
| Storage | Supabase Storage (chiffré) | Conservation 90 jours puis purge auto |
| Logs | Table `ai_imports` (cf. cadrage §4.3) | Source pour amélioration |
| UI sync | Realtime via Supabase ou polling 1s | Affichage progression |

### 2.3 Coûts estimés

| Type document | Taille | Tokens IN | Tokens OUT | Coût (€) |
|---|---|---|---|---|
| BC (1 page A4) | ~50 Ko | ~2 500 | ~500 | ~0,02 |
| Facture (1-2 pages) | ~150 Ko | ~5 000 | ~800 | ~0,04 |
| Attestation | ~30 Ko | ~1 500 | ~200 | ~0,01 |
| Photo + ref | ~500 Ko | ~3 000 | ~300 | ~0,02 |
| Texte libre | ~1 Ko | ~500 | ~400 | ~0,005 |
| Classification (Haiku) | n/a | ~1 000 | ~50 | ~0,001 |

**Volume estimé LMS** : ~500 imports/mois → **coût mensuel ~10-25 €** par organisation. Cap par défaut : **100 €/mois** par organisation.

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Active/désactive l'IA, fixe les caps budgétaires, consulte stats d'usage |
| **Chef d'agence (admin)** | Utilisateur principal du drop de documents (BC, factures fournisseur) |
| **Comptable (accountant)** | Import factures fournisseur en masse, validation des extractions |
| **Technicien (technician)** | Phase 1 : peu d'usage. Phase 2 mobile : photos sur le terrain avec match auto |
| **Lecture seule (viewer)** | Pas d'accès au module |

---

## 4. Cas d'usage IA détaillés

### 4.1 Drop d'un Bon de Commande (BC)

Cas typique : un syndic envoie un BC par email PDF.

```
[Page Import IA → drop d'un PDF "BC-FONCIA-2026-318.pdf"]
   │
   ▼
[Pipeline IA]
   1. Stockage du PDF
   2. Classification → "bon_de_commande" (confiance 95 %)
   3. Extraction Claude vision avec prompt spécifique BC
      → Champs extraits :
         • supplier_reference: "BC-FONCIA-2026-318" (confiance 99 %)
         • client_name: "Foncia Sud Méditerranée" (98 %)
         • client_address: "1 rue X, 34000 Montpellier" (95 %)
         • intervention_address: "Résidence Les Oliviers, 34170 Castelnau" (92 %)
         • tenant_name: "Mme Dupont" (88 %)
         • tenant_phone: "+33 6 12 34 56 78" (90 %)
         • metier: "Plomberie" (95 %)
         • priority: "urgence" (85 %)
         • description: "Fuite radiateur Apt 12 chauffage central" (90 %)
         • amount_authorized: 800.00 € HT (75 %)
   4. Matching :
      • client → existe : "Foncia Sud Méditerranée" → propose lien
      • lieu → existe : "Résidence Les Oliviers" → propose lien
      • chantier avec cette ref → n'existe pas → propose création
   │
   ▼
[Modal de validation]
   - Type détecté : 📋 Bon de commande
   - Confiance globale : 92 %
   - Tableau champ par champ avec :
       • Nom du champ
       • Valeur extraite (éditable inline)
       • Indicateur confiance (vert/orange/rouge)
       • Suggestion lien si entité matchée
   - Action proposée : 🏗️ Créer un nouveau chantier
   - Bouton "Créer le chantier"
   - Bouton "Annuler"
   │
   ▼
[Création chantier avec données validées]
   - Le PDF est attaché en pièce jointe au chantier (catégorie "BC")
   - L'ai_import est lié au chantier créé
   - Activity log : "Chantier créé via import IA"
```

### 4.2 Drop d'une facture fournisseur

```
[Drop d'un PDF "Facture-Rexel-2026-004532.pdf"]
   │
   ▼
[Classification : facture (98 %)]
   │
   ▼
[Extraction par prompt facture]
   - Numéro : "FACT-2026-004532" (95 %)
   - Date : 15/04/2026 (98 %)
   - Échéance : 15/05/2026 (95 %)
   - Fournisseur : "Rexel France SA" (95 %)
   - SIRET fournisseur : "303 290 080" (90 %)
   - Total HT : 1 245,80 € (98 %)
   - TVA : 249,16 € (98 %)
   - Total TTC : 1 494,96 € (99 %)
   - Lignes : 12 lignes détectées (table extraite)
   │
   ▼
[Matching]
   - Fournisseur : existe "Rexel France" → lien proposé
   - Chantier : non détecté → utilisateur peut le saisir
   │
   ▼
[Modal validation + édition]
   - Tableau lignes éditable
   - Champs principaux à valider
   - Sélection chantier optionnelle (autocomplete)
   - Statut paiement (par défaut "en_attente")
   - Bouton "Enregistrer la facture"
   │
   ▼
[Insert facture direction='purchase']
   - PDF attaché
   - Document de la facture rattaché à un chantier si choisi
```

### 4.3 Drop d'une attestation TVA réduite

```
[Drop d'un PDF "Attestation TVA 10% Mme Dupont.pdf"]
   │
   ▼
[Classification : attestation (95 %)]
   │
   ▼
[Extraction]
   - Type d'attestation : "TVA réduite 10 %" (98 %)
   - Bénéficiaire : "Mme Dupont, 1 rue X, 34170 Castelnau" (90 %)
   - Date signature : 02/04/2026 (95 %)
   - Validité : 1 an (calculée)
   - Travaux concernés : "Réfection plomberie SDB" (85 %)
   │
   ▼
[Matching]
   - Bénéficiaire → match avec un client existant ?
   - Si oui : lien proposé
   - Si chantier en cours pour ce bénéficiaire : lien aussi
   │
   ▼
[Modal validation]
   - Action proposée : 📁 Classer dans documents [Client / Chantier / Les deux]
   - Bouton "Classer"
   │
   ▼
[Insert document]
   - Catégorie : "Attestation TVA"
   - Métadonnée : type, validité, bénéficiaire
   - Alert auto sur chantier : "✓ Attestation TVA 10% reçue, valide jusqu'à [date]"
```

### 4.4 Drop de photos avec référence chantier

```
[Drop de 5 photos (JPG) avec saisie de la ref "BC-FONCIA-318"]
   │
   ▼
[Matching référence → chantier CH-2026-0042]
   │
   ▼
[Pour chaque photo : analyse Claude vision]
   - Description auto : "Robinet de douche cassé, fuite visible" (75 %)
   - Détection avant/après si possible (45 %)
   - Métadonnées EXIF : date, géoloc
   │
   ▼
[Modal validation]
   - Aperçu des 5 photos avec descriptions IA
   - Catégorisation proposée : avant / pendant / après / autre
   - Édition possible
   - Action : "Ajouter au dossier du chantier CH-2026-0042"
   │
   ▼
[Insert documents catégorie 'photo']
```

### 4.5 Saisie texte libre

```
[Zone de texte → utilisateur tape ou colle]
   "Intervention chez Mme Dupont, Résidence Les Oliviers Bat B Apt 12
    Castelnau-le-Lez. Dégât des eaux urgence chauffage. Locataire 06 12 34 56 78.
    Foncia Sud Méd. réf BC-FONCIA-2026-318."
   │
   ▼
[Extraction]
   - Locataire : "Mme Dupont" (98 %)
   - Adresse : "Résidence Les Oliviers Bat B Apt 12, 34170 Castelnau-le-Lez" (92 %)
   - Téléphone : "+33 6 12 34 56 78" (99 %)
   - Métier : "Plomberie" (90 %, déduit de "dégât des eaux")
   - Priorité : "urgence" (95 %)
   - Donneur d'ordre : "Foncia Sud Méditerranée" (95 %)
   - Réf BC : "BC-FONCIA-2026-318" (98 %)
   │
   ▼
[Matching identique au flow 4.1]
   - Match client, lieu, ref chantier
   │
   ▼
[Modal validation + création chantier]
```

---

## 5. Pipeline d'extraction détaillé

### 5.1 Prompts spécialisés

Chaque type de document a un prompt dédié, versionné dans le repo (`packages/ai/prompts/`).

**Exemple prompt extraction BC** (extrait simplifié) :

```
Tu es un assistant spécialisé dans l'extraction de données depuis des bons de commande (BC)
émis par des syndics français pour des prestataires de services BTP.

Le document fourni est un BC. Extrais les informations suivantes en JSON strict.

Pour chaque champ extrait, fournis :
- la valeur exacte (string, number, ou null si non trouvée)
- un score de confiance entre 0 et 100 (basé sur la clarté du document, la lisibilité,
  la cohérence avec d'autres champs)

Schéma de sortie obligatoire :
{
  "supplier_reference": { "value": string|null, "confidence": int },
  "client_name": { "value": string|null, "confidence": int },
  "client_siret": { "value": string|null, "confidence": int },
  "client_address": { "value": string|null, "confidence": int },
  "intervention_address": { "value": string|null, "confidence": int },
  "intervention_residence": { "value": string|null, "confidence": int },
  "tenant_name": { "value": string|null, "confidence": int },
  "tenant_phone": { "value": string|null, "confidence": int },
  "metier": { "value": "Plomberie"|"Électricité"|"Toiture"|"Serrurerie"|...|null, "confidence": int },
  "priority": { "value": "normal"|"haute"|"urgence"|null, "confidence": int },
  "description": { "value": string|null, "confidence": int },
  "amount_authorized_ht": { "value": number|null, "confidence": int },
  "issue_date": { "value": "YYYY-MM-DD"|null, "confidence": int }
}

Règles :
- Téléphones au format E.164 (+33 ...)
- Dates ISO 8601
- Si tu n'es pas sûr d'un champ, mets une valeur null avec confidence < 30
- Si plusieurs valeurs possibles, prends la plus probable et baisse la confiance
- Pour "metier", déduis depuis le contexte (ex : "fuite" → Plomberie, "court-circuit" → Électricité)
- Pour "priority", "urgence" si mots clés "urgent", "fuite", "panne totale", "danger"

Document à analyser : [vision]
```

**Tool use** (depuis l'API Claude) :

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  tools: [{
    name: 'extract_bon_de_commande',
    description: '...',
    input_schema: { /* JSON Schema strict */ }
  }],
  tool_choice: { type: 'tool', name: 'extract_bon_de_commande' },
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pdfImageBase64 } },
        { type: 'text', text: 'Extrait les informations de ce bon de commande.' }
      ]
    }
  ]
})
```

### 5.2 Scoring de confiance

Pour chaque champ extrait, l'IA retourne un score 0-100. Affichage UI :
- **80-100 → Vert** : "haute confiance", validation rapide.
- **50-79 → Orange** : "à vérifier", l'utilisateur doit lire attentivement.
- **0-49 → Rouge** : "basse confiance", l'utilisateur doit ressaisir.

Confiance globale = moyenne pondérée des champs critiques (ref, montant, client).

### 5.3 Matching avec entités existantes

Après extraction, l'app cherche à matcher avec des entités existantes :

**Client** :
- Match exact sur SIRET → match certain.
- Match nom exact → match probable (>90 %).
- Match Levenshtein ≤ 3 → match suggéré (~70 %).
- Aucun match → proposition de création.

**Lieu d'intervention** :
- Match exact sur nom + client → match certain.
- Match adresse normalisée + client → match probable.
- Aucun → proposition de création.

**Chantier** :
- Match `supplier_reference` → match certain.
- Match client + lieu + métier + < 30 jours → match suggéré (chantier potentiellement en cours).
- Aucun → proposition de création nouveau chantier.

**Fournisseur** :
- Match SIRET → certain.
- Match nom Levenshtein ≤ 3 → suggéré.

### 5.4 Validation utilisateur (UX critique)

Le **principe** : aucune entité créée ou modifiée sans validation explicite humaine.

**UI de validation** :
- Tableau ou liste de champs.
- Chaque champ éditable inline.
- Indicateur de confiance visible (pastille colorée).
- Boutons d'action visibles : "Créer", "Mettre à jour", "Classer", "Annuler".
- Suggestions de matching visibles (avec bouton "Lier").
- Possibilité de marquer un champ comme "non applicable".

**Boucle d'amélioration** :
- Quand l'utilisateur **modifie** une valeur : on stocke l'original IA + la correction dans `ai_imports.user_corrections`.
- Métriques dérivées :
  - Taux de correction par champ (ex : "client_address" corrigé 35 % du temps).
  - Patterns de correction (ex : Claude tend à confondre Foncia/Foncia Sud Med).
- Phase 3 : ces données alimenteront soit l'amélioration manuelle des prompts, soit le fine-tuning.

### 5.5 Audit trail

Pour chaque import, ligne dans `ai_imports` (cf. cadrage §4.3) :
- Source files (ou raw_input).
- Modèle utilisé + version.
- Tokens consommés + coût.
- Payload brut Claude.
- Confidence scores.
- Action utilisateur (accepted, modified, rejected).
- User corrections (avant/après par champ).
- Entité créée (FK).

---

## 6. Coûts et caps budgétaires

### 6.1 Cap mensuel par organisation

Paramétrable dans `organization_settings.ai_monthly_cap_eur` :
- Par défaut 100 €/mois.
- Configurable par owner uniquement.

### 6.2 Comportement à l'approche du cap

- 80 % du cap atteint : notification owner "Votre consommation IA approche du cap".
- 100 % atteint : **désactivation automatique** de l'IA pour le reste du mois.
- Tous les imports utilisent alors le **fallback regex / Tesseract OCR** (qualité moindre mais gratuit).
- Reset au 1er du mois suivant.

### 6.3 Désactivation manuelle

Owner peut désactiver l'IA Claude à tout moment depuis Paramètres → IA.
- Toggle "Activer l'extraction IA Claude".
- Si désactivé : les imports passent automatiquement en mode regex/OCR.
- Possibilité de désactiver par type de document (ex : OK pour BC, off pour photos).

### 6.4 Tableau de bord coût

Page Paramètres → IA → Consommation :
- Graphique mensuel de la consommation.
- Tableau imports/jour.
- Top types de document.
- Top utilisateurs (qui consomme).
- Coût moyen par import.
- Comparaison vs cap.

---

## 7. Migration depuis l'existant

### 7.1 Sources de données

#### A. Fichier `lms-data.json` (Electron actuel)

Structure (cf. main.js Electron) :
```json
{
  "chantiers": [...],
  "clients": [...],
  "techniciens": [...],
  "fournisseurs": [...],
  "factures": [...],
  "imports": [...],
  "columns": [...]
}
```

#### B. Exports Interfast

Formats à confirmer mais en général :
- CSV clients.
- CSV chantiers.
- CSV interventions.
- CSV devis.
- CSV factures.

### 7.2 Mapping Electron → SaaS

**Chantiers** :
| Champ Electron | Champ SaaS | Transformation |
|---|---|---|
| `id` | `reference` | Conservé (CH-YYYY-NNNN) |
| `client` (nom) | `client_id` | Lookup ou création client |
| `clientId` | `client_id` | Si présent, lien direct |
| `clientType` | `client.type` | Mapping enum |
| `adresse` | snapshot dans `address` JSONB | Si pas de location, sinon lookup |
| `metier` | `metier` | Conservé |
| `agence` | `agency_id` | Lookup par nom |
| `locataire` | `tenant_name` | |
| `tel` | `tenant_phone` | Normalisé E.164 |
| `refF` | `supplier_reference` | |
| `fourn` | `supplier_id` | Lookup ou création |
| `tech` (nom string) | `assigned_technician_id` | Lookup par nom |
| `prio` | `priority` | normal/haute/urgence |
| `datePrevue` | `scheduled_date` | |
| `desc` | `description` | |
| `statut` | `status` | Mapping vers ID colonne |
| `docs` | table `documents` | Pour chaque doc, créer une row (sans le fichier réel — manuel) |
| `interventions` | table `interventions` | Création N rows |
| `notes` | `notes` | |
| `createdAt` | `created_at` | |

**Clients** :
| Electron | SaaS |
|---|---|
| `nom` | `name` |
| `type` | `type` (mapping enum) |
| `tel` | `phone` (snapshot ou contact) |
| `email` | `email` |
| `adresse` | snapshot dans address |
| `contact` | Création contact lié |
| `agence` | `default_agency_id` (lookup) |
| `notes` | `notes` |

**Techniciens** :
| Electron | SaaS |
|---|---|
| `prenom` + `nom` | `first_name` + `last_name` |
| `tel`, `email` | idem |
| `metier` | `trades[]` |
| `agence` | `agency_id` |

**Factures** :
| Electron | SaaS |
|---|---|
| `numero` | `reference` |
| `date` | `issue_date` |
| `echeance` | `due_date` |
| `fourn`, `client` | lookup |
| `ht`, `tva`, `ttc` | totaux |
| `statut` | `status` |
| `datePaiement` | `paid_date` + créer `payment` row |

### 7.3 Mapping Interfast

À détailler après obtention des exports CSV réels. Approche :
1. Format CSV → parsing avec PapaParse.
2. Mapping config dans `packages/migration/interfast-mapping.ts`.
3. Validation Zod par ligne.
4. Réutilisation de la pipeline de matching existante (cf. §5.3).

### 7.4 Script de migration

**Localisation** : `packages/migration/`

**Fichiers** :
- `import-electron.ts` : lit `lms-data.json`, mappe, insère.
- `import-interfast-clients.ts` : lit CSV clients.
- `import-interfast-chantiers.ts` : lit CSV chantiers.
- `import-interfast-factures.ts`.
- `import-interfast-devis.ts`.
- `mapping/` : sous-dossier avec mappings spécifiques.
- `cli.ts` : interface CLI.

**Modes** :
- `--dry-run` : analyse, génère rapport, n'écrit rien.
- `--commit` : exécution réelle (transaction Postgres).
- `--source <electron|interfast>` : choix de la source.
- `--organization <slug>` : organisation cible.
- `--input <path>` : chemin fichier(s).
- `--output-report <path>` : où écrire le rapport.

**Rapport généré (CSV + résumé)** :
- Total lignes lues.
- Lignes valides.
- Lignes en erreur (avec détails).
- Doublons détectés (avec stratégie : ignore / merge).
- Entités créées par type.
- Liens créés.

### 7.5 Workflow recommandé pour la migration

```
1. Préparation
   • Exporter Interfast (CSV) en début de jour J.
   • Exporter lms-data.json (copie %APPDATA%\lms-gestion\lms-data.json).
   • Vérifier intégrité (taille, ouverture, comptage entités).

2. Dry-run
   • Lancer le script en --dry-run.
   • Analyser le rapport (sur >1000 lignes : prévoir 30 min de revue).
   • Corriger les CSV / le JSON si problèmes (chemins fichiers, doublons connus).
   • Re-run dry-run jusqu'à 0 erreur critique.

3. Coexistence J0 → J+30 (Mois 1)
   • Migration commit en début de mois.
   • Saisie en double (LMS + Interfast) pour validation.
   • Réconciliation hebdomadaire (script de comparaison).

4. Bascule J+30 → J+60 (Mois 2)
   • Saisie uniquement dans LMS.
   • Interfast en consultation.
   • Migration incrémentale des chantiers nouvellement créés dans Interfast (rare).

5. Archive J+60 → J+90 (Mois 3)
   • Interfast en lecture seule.
   • Export final des chantiers clos restants.

6. Résiliation J+90
   • Désactivation Interfast.
   • Backup Interfast complet conservé (CSV + PDF) chez l'organisation.
```

### 7.6 Période de coexistence

3 mois validés au cadrage (cf. cadrage §13.5). Outils additionnels :

**Script de réconciliation hebdomadaire** :
- Compare nombre de chantiers / factures entre Interfast (export récent) et LMS.
- Liste les écarts.
- Email récap à l'admin chaque lundi.

**Mode "double saisie facilité"** :
- Pendant Mois 1, après création d'un chantier dans LMS, message :
  "✓ Chantier créé. N'oubliez pas de saisir aussi dans Interfast pendant la période de coexistence."

---

## 8. Écrans détaillés

### 8.1 Page Import IA (principale)

**URL** : `/import`

**Layout** : 2 colonnes — gauche (input) + droite (historique récent).

**Colonne gauche — Inputs** :
- Drop zone large : "Déposez vos documents ici"
  - Accepte : PDF, JPG, PNG, TIFF, plusieurs fichiers.
  - Aperçu thumbs des fichiers déposés.
- Champ "Référence chantier (optionnel)" : pour matcher manuellement un BC à un chantier.
- Boutons : "📎 Parcourir", "⚡ Analyser".
- Section "Saisie texte libre" :
  - Textarea large.
  - Compteur caractères.
  - Bouton "⚡ Créer depuis le texte".

**Colonne droite — Historique** :
- Liste des 20 derniers imports.
- Chaque ligne : type, fichier(s), résultat, date, action.
- Lien vers l'entité créée si applicable.
- Filtre par type, par succès/échec.

**Stats en bas** :
- Imports ce mois.
- Coût du mois.
- Cap : 100 € (avec barre de progression).
- Taux de validation au premier coup.

### 8.2 Modal de validation

Largeur 720 px, scrollable.

**Header** :
- Icône type document.
- Titre : "Bon de commande détecté".
- Confiance globale (%).
- Bouton fermer.

**Body** :
- Bandeau info : action proposée + résumé.
- Tableau des champs :
  - Nom champ.
  - Valeur (input éditable).
  - Pastille confiance.
  - Si matching : badge "Lié à [entité]" + bouton "Délier".
  - Suggestions : liste à dérouler avec autres matchs possibles.
- Section "Aperçu document" : iframe ou image preview.
- Section "Actions complémentaires" :
  - Toggle "Créer aussi le client si inexistant".
  - Toggle "Créer la résidence si inexistante".

**Footer** :
- Bouton "Annuler".
- Bouton principal selon action :
  - "Créer le chantier" (si new chantier).
  - "Mettre à jour le chantier [ref]" (si existant).
  - "Classer dans documents" (si attestation).

### 8.3 Page Paramètres → IA

**URL** : `/settings/ai`

**Sections** :
- **Activation** :
  - Toggle global "Activer l'extraction IA Claude".
  - Toggles par type de document (BC, facture, attestation, photo, texte).
- **Cap budgétaire** :
  - Input "Cap mensuel (€)" — défaut 100.
  - Action à 80 % (notif), à 100 % (désactivation auto / fallback).
- **Modèle** :
  - Sélection (lecture seule en Phase 1) : `claude-sonnet-4-6`.
- **Consommation** :
  - Graphique mensuel.
  - Détails par type, par utilisateur.
  - Coût moyen par import.

### 8.4 Page Migration (admin platform)

**URL** : `/admin/migration` (réservé aux admins LMS Gestion durant l'onboarding)

**Layout** :
- Étape 1 : Choix de la source (Electron / Interfast / Autre CSV).
- Étape 2 : Upload des fichiers.
- Étape 3 : Mapping (auto-détection + ajustements manuels).
- Étape 4 : Dry-run + rapport.
- Étape 5 : Validation manuelle des doublons / erreurs.
- Étape 6 : Commit (avec confirmation forte + step-up auth).
- Étape 7 : Récapitulatif post-migration.

---

## 9. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir page Import IA | ✅ | ✅ | ✅ | ❌ | ❌ |
| Drop fichier / texte | ✅ | ✅ | ✅ | ❌ | ❌ |
| Valider extraction | ✅ | ✅ | ✅ | ❌ | ❌ |
| Activer / désactiver IA | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier cap budgétaire | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir consommation | ✅ | ✅ | ✅ | ❌ | ✅ (limité) |
| Voir audit trail | ✅ | ✅ | ✅ | ❌ | ❌ |
| Lancer migration | ✅ (avec admin platform) | ❌ | ❌ | ❌ | ❌ |

---

## 10. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Claude API down | Fallback automatique vers regex + OCR Tesseract. Notification "Mode dégradé activé". Toast warning. |
| Cap mensuel atteint | Désactivation IA. Mode regex. Bannière persistante. |
| PDF protégé par mot de passe | Erreur claire : "Document protégé. Déprotégez-le avant import." |
| Image très basse résolution | Avertissement, extraction tentée mais confiance faible. |
| Document totalement illisible | Échec gracieux : "Impossible d'extraire les données. Saisissez manuellement." |
| Téléphone détecté invalide | Champ marqué orange, suggestion de correction. |
| SIRET détecté invalide (Luhn fail) | Champ marqué rouge. |
| Date détectée future ou très ancienne | Avertissement. |
| Multi-pages document gros (>20 Mo) | Compression auto avant envoi à Claude (limite API). |
| Doublon parfait (même fichier déjà importé) | Détection par hash → message "Ce document a déjà été importé le [date]. [Voir l'import] ou [Importer à nouveau]". |
| Confidence très basse (<30 %) sur tous les champs | Suggestion : "L'extraction a échoué. Vérifiez la qualité du document ou saisissez manuellement." |
| Texte libre trop court (<20 caractères) | Bouton "Analyser" grisé. |
| Migration : ligne CSV avec champ obligatoire vide | Ligne mise en erreur dans le rapport, ignorée au commit. |
| Migration : doublon SIRET | Stratégie configurable (ignore / merge / create_anyway). |
| Migration : référence chantier déjà utilisée | Skip avec log + report. |
| Migration : agence inconnue | Création auto avec warning, ou skip selon config. |

---

## 11. Critères d'acceptation

### 11.1 Pipeline IA
- ✅ Drop de PDF lance la pipeline et affiche progression.
- ✅ Classification correcte sur 95 % des documents test.
- ✅ Extraction par type fonctionne avec scoring.
- ✅ Matching avec entités existantes fonctionne (clients, lieux, fournisseurs).
- ✅ Validation utilisateur obligatoire avant création.
- ✅ Audit trail complet dans `ai_imports`.

### 11.2 Caps budgétaires
- ✅ Cap mensuel configurable.
- ✅ Notification 80 %.
- ✅ Désactivation auto à 100 %.
- ✅ Fallback regex/OCR fonctionne sans IA.
- ✅ Reset au 1er du mois.

### 11.3 Boucle d'amélioration
- ✅ Corrections utilisateur stockées avec valeur originale.
- ✅ Statistiques de correction par champ accessibles.

### 11.4 Migration Electron
- ✅ Script lit `lms-data.json` correctement.
- ✅ Mapping correct vers schéma SaaS.
- ✅ Dry-run produit rapport sans écrire.
- ✅ Commit fonctionne en transaction (rollback si erreur).
- ✅ Doublons détectés par SIRET puis nom.

### 11.5 Migration Interfast
- ✅ Lecture CSV (PapaParse).
- ✅ Mapping configurable.
- ✅ Réconciliation hebdomadaire fonctionne.

### 11.6 Sécurité
- ✅ Documents stockés chiffrés.
- ✅ Purge auto à 90 jours.
- ✅ Audit IP de chaque import.
- ✅ Cross-org isolation (un user d'org A ne peut pas importer pour org B).

### 11.7 Performance
- ✅ Extraction BC simple : < 8s.
- ✅ Extraction facture multi-pages : < 15s.
- ✅ UI affiche progression en temps réel.

---

## 12. Métriques (PostHog)

### 12.1 Événements
- `ai_import.uploaded` (props: type, file_count, file_size_bytes)
- `ai_import.classified` (props: detected_type, confidence)
- `ai_import.extracted` (props: type, model, tokens_in, tokens_out, cost_eur, duration_ms)
- `ai_import.fallback_used` (props: reason=cap_reached|api_down|disabled)
- `ai_import.validated` (props: action=create|update|classify|cancel, modified_fields_count)
- `ai_import.entity_created` (props: entity_type)
- `ai.cap_warning_80pct`
- `ai.cap_reached`
- `ai.disabled_manually` (props: scope=global|by_type)
- `migration.dry_run` (props: source, total_lines, errors_count)
- `migration.commit` (props: source, entities_created)
- `migration.reconciliation_run`

### 12.2 KPIs
- Taux de validation au premier coup : objectif > 70 % (utilisateur valide sans modifier).
- Coût moyen par import : objectif < 0,05 €.
- Précision par champ : objectif > 90 % sur SIRET, total, ref ; > 80 % sur le reste.
- Taux d'usage IA vs fallback : objectif > 90 % en mode normal.
- Taux d'erreur migration : objectif < 1 % de lignes en erreur.

---

## 13. Points ouverts à arbitrer plus tard

- **Auto-création sans validation** : quand confiance > 99 %, créer directement (Phase 4 quand on aura des stats robustes).
- **Email forwarding** : adresse `import@org.lms.fr` qui aspire les BC envoyés par mail (Phase 4).
- **Connecteurs API directs** : Foncia, Nexity ont des portails — explorer (Phase 4).
- **Reconnaissance manuscrite** : prises de notes papier (Phase 4-5).
- **Agent autonome IA** : analyse hebdomadaire des chantiers en retard, propose des actions (Phase 5).
- **Fine-tuning Claude sur les corrections accumulées** (Phase 5, après ~10k exemples).
- **Multi-modèle** : utiliser GPT-4 Vision en parallèle pour cross-validation (Phase 4).
- **Imports en masse** : ZIP de 100 BC, traitement batch (Phase 3).
- **OCR avancé spécialisé** : Mistral OCR ou Google Document AI pour cas complexes (Phase 4).
- **Détection de fraude** : analyse de cohérence sur les factures fournisseur (Phase 4).

---

*Fin de la spec module 09 — Import IA & Migration.*
*Prochaine spec : 10-parametres-administration.md (paramètres organisation, agences, comptes utilisateur, branding, intégrations, logs admin).*
