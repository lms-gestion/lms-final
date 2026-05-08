# Spec produit — Module 03 : Clients & Contacts

**Version** : 1.0
**Statut** : À implémenter en Sprint 3-4
**Dépendances** : Module 01 (Auth), Module 02 (Équipe)
**Sprints concernés** : Sprint 3, Sprint 4

---

## 1. Objectif du module

Gérer la base CRM des clients et des entités liées. Le module couvre :

- la création / modification / désactivation des clients,
- la gestion des contacts multiples par client,
- la gestion des **lieux d'intervention récurrents** (résidences pour les syndics, sites multiples pour les bailleurs),
- la segmentation par type de client (syndic, bailleur, copropriété, assurance, tertiaire, hôtellerie, particulier),
- la **vue 360°** (chantiers, devis, factures, encours, historique de communication),
- la fusion de doublons,
- l'import CSV en masse,
- le suivi commercial (CA, ancienneté, encours, statut payeur).

**Hors périmètre du module** :
- Génération de devis / facture (modules 06, 07).
- Communications email automatiques (module 11 Notifications).
- Marketing / segmentation avancée (Phase 4).
- Portail client externe (Phase 4).

---

## 2. Modèle conceptuel

### 2.1 Entités

```
┌─────────────────────────┐
│  clients                │ ← entité commerciale (personne morale ou physique)
│  - name, type           │
│  - siret, tva           │
│  - payment_terms_days   │
└────────────┬────────────┘
             │
             ├──────────────────┐
             │ 1..n             │ 1..n
             ▼                  ▼
┌─────────────────────┐  ┌──────────────────────┐
│  contacts           │  │  client_locations    │ ← lieux d'intervention récurrents
│  - full_name        │  │  - name              │
│  - role             │  │  - address (geo)     │
│  - email, phone     │  │  - default_contact_id│
│  - is_primary       │  │  - notes             │
└─────────────────────┘  └──────────────────────┘
```

### 2.2 Pourquoi `client_locations`

C'est l'apport principal du module par rapport à l'Electron actuel et à Interfast. Aujourd'hui, pour le syndic Foncia qui gère 80 résidences :
- Chaque chantier = retaper l'adresse manuellement.
- Risque de fautes, de variantes orthographiques.
- Pas de stats "combien de chantiers sur Résidence Les Oliviers cette année".

Avec `client_locations` :
- Une résidence est créée une fois, réutilisée n fois.
- Adresse propre + gardien/concierge associé.
- Statistiques par lieu.
- Les chantiers référencent `client_id` ET `location_id` (optionnel).
- Pour un particulier : pas de location, l'adresse reste sur le chantier.

### 2.3 Types de clients (segmentation)

| Type | Description | Spécificités |
|---|---|---|
| `syndic` | Syndic de copropriété (Foncia, Nexity, Citya, Loiselet...) | Multi-résidences, contacts multiples (gestionnaire, comptable, assistante), délai paiement souvent 45-60j, mandat à renseigner |
| `bailleur` | Bailleur ou gestionnaire de logements (CDC Habitat, ICF, ANRU...) | Portefeuille important, contacts multiples, délai paiement strict (souvent 30j), souvent Chorus Pro |
| `copropriete` | Copropriété sans syndic professionnel (autogestion) | Conseil syndical comme contact, président, parfois plusieurs co-décisionnaires |
| `assurance` | Assurance / cabinet d'expertise sinistre | Référence dossier sinistre obligatoire, contact expert + assistante, délais variables |
| `tertiaire` | Entreprises, bureaux, ERP | Single-site souvent, factures B2B classiques, Factur-X attendu |
| `hotellerie` | Hôtels, résidences hôtelières, gîtes | 24/7, contacts maintenance + direction, urgences fréquentes |
| `particulier` | Personne physique | Pas de SIRET, pas de location séparée, paiement souvent immédiat |

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue globale CA par client, CA par segment. Modification conditions commerciales sensibles (délai paiement, ristourne globale). |
| **Chef d'agence (admin)** | Création/modification clients de ses agences. Suivi encours. Réponse aux demandes. |
| **Comptable (accountant)** | Vérification SIRET/TVA, conditions de paiement, RIB, encours et relances. |
| **Technicien (technician)** | Lecture limitée des clients liés à ses chantiers. Voit le contact à appeler avant intervention. |
| **Lecture seule (viewer)** | Lecture globale sans accès aux RIB ni notes confidentielles. |

---

## 4. Parcours utilisateur

### 4.1 Création d'un syndic avec ses résidences

```
[Page Clients]
   │
   ▼
Bouton "+ Nouveau client"
   │
   ▼
[Modal : Nouveau client — Étape 1/4 : Type]
   - Quel type de client ?
       ○ Syndic de copropriété     ○ Bailleur / Gestionnaire
       ○ Copropriété en autogestion ○ Assurance / Expert
       ○ Tertiaire / Entreprise     ○ Hôtel / Résidence
       ○ Particulier
   - Bouton "Continuer"
   │
   ▼
[Étape 2/4 : Identité (champs adaptés au type "Syndic")]
   - Raison sociale * (ex : "Foncia Sud Méditerranée")
   - Nom commercial / enseigne (ex : "Foncia Montpellier")
   - SIRET * (validation Luhn)
   - N° TVA intra * (FR + 11 chiffres)
   - Forme juridique (SAS, SARL, SA...)
   - N° de carte professionnelle G/T (spécifique syndic)
   - Date de mandat
   - Agence référente (multi-select)
   │
   ▼
[Étape 3/4 : Coordonnées siège]
   - Adresse * (autocomplete Google Places)
   - Téléphone standard
   - Email général
   - Site web
   - Contact principal :
       - Nom *, Rôle ("Directeur", "Gestionnaire principal")
       - Email, Téléphone direct, Mobile
   │
   ▼
[Étape 4/4 : Conditions commerciales]
   - Délai de paiement (30j / 45j / 60j / À réception / Custom)
   - Mode de paiement préféré (virement / chèque / prélèvement)
   - Pénalités de retard : taux légal + 7pts (par défaut)
   - Indemnité forfaitaire 40 € (case cochée par défaut)
   - Code service (Chorus Pro si bailleur public)
   - Numéro engagement obligatoire ? (toggle)
   - Notes commerciales (zone libre)
   │
   ▼
[Bouton "Créer le client"]
   │
   ▼
[Toast succès + redirection sur la fiche client]
   │
   ▼
[Fiche client — Onglet Lieux d'intervention]
   - Encart "Aucune résidence enregistrée"
   - Bouton CTA : "+ Ajouter une résidence"
   │
   ▼
[Modal : Nouvelle résidence]
   - Nom de la résidence * (ex : "Les Oliviers")
   - Code interne (optionnel, ex : "OLV-34170")
   - Adresse * (autocomplete)
   - Code postal, Ville (auto-remplis depuis l'autocomplete)
   - Coordonnées GPS (auto)
   - Année construction
   - Nb lots (optionnel, pour stats)
   - Contact gardien :
       - Nom, Téléphone, Email
   - Notes (codes d'accès portail, particularités)
   - Bouton "Ajouter"
   │
   ▼
[Liste mise à jour, possibilité d'ajouter d'autres résidences en boucle]
```

### 4.2 Ajout rapide depuis création de chantier

```
[Modal : Nouveau chantier]
   Champ "Client" → utilisateur tape "Foncia"
   │
   ▼
[Autocomplete liste des clients existants + option]
   - Foncia Sud Méditerranée (Syndic · Montpellier · 23 chantiers)
   - Foncia Aix (Syndic · Aix · 5 chantiers)
   - ➕ Créer "Foncia" comme nouveau client
   │
   ▼
   [Sélection d'un existant]
   │
   ▼
[Champ "Lieu d'intervention" → autocomplete des résidences du client]
   - Résidence Les Oliviers (34170 Castelnau-le-Lez)
   - Résidence Le Parc (34000 Montpellier)
   - Résidence Méditerranée (34070 Montpellier)
   - ➕ Nouvelle résidence pour Foncia Sud Méditerranée
   │
   ▼
   [Choix existant pré-remplit l'adresse + le contact gardien]
   ou
   [Choix "Nouvelle résidence" ouvre une modal inline pour la créer sans quitter le formulaire chantier]
```

### 4.3 Vue 360° d'un client

```
[Page Clients → Clic sur "Foncia Sud Méditerranée"]
   │
   ▼
[Fiche client en page pleine largeur (pas panneau latéral car beaucoup de données)]
   │
   ├─── Header
   │   - Logo organisation cliente (favicon depuis site web ou avatar initiales)
   │   - Nom + type (chip coloré)
   │   - Statut (Actif, Archivé, Bloqué)
   │   - Boutons : ✏️ Modifier · 📁 Documents · ⋯ Plus (Archiver, Fusionner, Exporter)
   │
   ├─── Cards stats (4 colonnes)
   │   - CA cumulé : 145 220 €
   │   - Encours impayé : 4 230 €
   │   - Chantiers actifs : 7
   │   - Ancienneté : 3 ans 4 mois
   │
   ├─── Onglets
   │   1. 📋 Informations
   │   2. 📍 Lieux (X)
   │   3. 👥 Contacts (Y)
   │   4. 🏗️ Chantiers (Z)
   │   5. 📄 Devis
   │   6. 💶 Factures
   │   7. 📁 Documents
   │   8. 📜 Historique / Activité
   │   9. 📝 Notes
   │
   └─── Contenu de l'onglet sélectionné
```

### 4.4 Fusion de doublons

Cas typique : un commercial a créé "Foncia Sud Med" pendant qu'un autre créait "Foncia Sud Méditerranée".

```
[Liste clients → Recherche "Foncia"]
   │
   ▼
[2 entrées détectées : "Foncia Sud Med" et "Foncia Sud Méditerranée"]
   │
   ▼
[Sélection multiple via checkbox]
   - Apparition d'une barre d'actions en bas : "Fusionner" disponible si 2 sélectionnés
   │
   ▼
[Modal : Fusionner 2 clients]
   - Tableau comparatif champ par champ
   - Pour chaque champ : choix de la valeur à conserver (radio)
       Champ "Raison sociale" :
         ○ Foncia Sud Med
         ● Foncia Sud Méditerranée
       Champ "SIRET" :
         ○ (vide)
         ● 12345678901234
       Champ "Téléphone" :
         ● 04 67 12 34 56
         ○ 04 67 12 34 56  (même valeur)
       ...
   - Récapitulatif des éléments fusionnés :
       • 12 chantiers consolidés
       • 4 contacts dédoublonnés (1 doublon détecté)
       • 8 résidences (sans doublons)
       • 23 factures consolidées
       • Documents : 5 + 3 = 8
   - Avertissement : "Cette action est irréversible"
   - Step-up auth (mot de passe)
   - Bouton "Fusionner"
   │
   ▼
[Backend]
   - Choisit l'ID gagnant (par défaut le plus ancien)
   - Update tous les FK pointant vers le perdant : chantiers, factures, devis, documents, contacts, locations
   - Détecte les contacts doublons (même email) et les fusionne aussi
   - Soft-delete du perdant (archived_at + merged_into=winner_id)
   - Activity log détaillé (qui, quand, quoi fusionné, valeurs choisies)
   - Toast confirmation
```

### 4.5 Import CSV de clients

```
[Page Clients → Bouton "📥 Importer CSV"]
   │
   ▼
[Modal : Importer des clients]
   Étape 1/4 : Format
   - Bouton "Télécharger le modèle"
   - Modèle propose colonnes : type, nom, raison_sociale, siret, tva_intra,
     adresse, cp, ville, telephone, email, contact_nom, contact_email,
     contact_tel, delai_paiement, agence, notes
   - Possibilité d'importer aussi les exports d'Interfast (mapping différent)
   │
   ▼
   Étape 2/4 : Upload
   - Drop zone CSV (max 10 Mo, 5000 lignes max)
   │
   ▼
   Étape 3/4 : Mapping colonnes
   - Système détecte automatiquement les correspondances
   - Permet de remapper manuellement si CSV non-standard
   - Aperçu des 5 premières lignes
   │
   ▼
   Étape 4/4 : Validation & import
   - Tableau preview : ✅ valides · ⚠️ erreurs · 🔁 doublons potentiels
   - Pour chaque erreur : ligne, champ, raison
   - Pour chaque doublon : choix par ligne (Ignorer / Fusionner / Créer quand même)
   - Options globales :
       ☑ Créer les contacts principaux automatiquement
       ☑ Détecter les doublons par SIRET puis par nom
       ☑ Mode dry-run (rapport seulement, pas d'écriture)
   - Bouton "Importer X lignes"
   │
   ▼
[Job en arrière-plan via Inngest]
   - Notification de progression en bas de l'écran
   - Email récap envoyé à la fin (avec rapport CSV des erreurs)
```

### 4.6 Archivage d'un client

Pas de suppression réelle (conservation factures 10 ans obligatoire).

```
[Fiche client → ⋯ → Archiver]
   │
   ▼
[Modal : Archiver Foncia Sud Méditerranée]
   - Vérification :
       • 7 chantiers actifs
       • 4 230 € d'encours impayés
       • 3 devis en attente
   - Avertissement : "Vous ne pourrez plus créer de nouveau chantier pour ce client. L'historique reste consultable."
   - Si encours non nul : "Régler les factures impayées avant l'archivage ?" (lien vers liste factures)
   - Raison de l'archivage (optionnel, choix déroulant) :
       ○ Fin de relation commerciale
       ○ Doublon (lier au client conservé)
       ○ Erreur de saisie
       ○ Autre (texte libre)
   - Bouton "Archiver"
   │
   ▼
[Backend]
   - clients.archived_at = now
   - clients.archive_reason = ...
   - Le client n'apparaît plus dans les selects (ex : nouveau chantier)
   - Reste consultable via filtre "Archivés"
   - Possibilité de désarchiver (owner uniquement)
```

---

## 5. Écrans détaillés

### 5.1 Page "Clients"

**URL** : `/clients`
**Layout** : header + tableau dense.

**En-tête** :
- Titre "👥 Clients & Syndics".
- Sous-titre dynamique : "X clients actifs · Y € de CA cumulé sur 12 mois".
- Filtres :
  - Type (multi-select chips).
  - Agence (multi-select).
  - Statut payeur (chips : "Bon payeur" 🟢, "À surveiller" 🟡, "Mauvais payeur" 🔴, "Bloqué" ⚫).
  - Tags (input avec autocomplete).
  - Période d'activité (sélecteur date).
  - Toggle "Inclure archivés".
- Recherche full-text (nom, SIRET, contact, adresse).
- Boutons :
  - "+ Nouveau client" (orange).
  - "📥 Importer CSV".
  - "📤 Exporter".

**Tableau** :

| Colonne | Contenu |
|---|---|
| ☐ Sélection | Checkbox multi-sélection |
| Logo + Nom | Favicon ou initiales + nom + raison sociale en sous-titre |
| Type | Chip coloré |
| Agence(s) | Liste compacte |
| CA 12 mois | Montant + flèche tendance |
| Encours | Montant en rouge si impayé |
| Statut payeur | Pastille colorée |
| Chantiers actifs | Compte + lien |
| Dernière activité | Date relative ("il y a 3j") |
| Actions | ⋯ menu (Modifier · Archiver · Fusionner · Documents) |

**Actions multi-sélection** (apparaît en bas si 2+ lignes cochées) :
- "Fusionner" (si exactement 2).
- "Exporter la sélection".
- "Archiver".
- "Ajouter un tag".

**Pagination** : 25 / 50 / 100 / 250 lignes par page.
**Tri** : sur chaque colonne triable.

**Empty state** : illustration, "Aucun client", CTA "+ Nouveau client" et "📥 Importer CSV".

### 5.2 Fiche client (page pleine largeur)

**URL** : `/clients/:id`
**Layout** : header + 9 onglets.

**Header** :
- Breadcrumb : "Clients > Foncia Sud Méditerranée".
- Logo (favicon ou initiales).
- Nom + type (chip).
- Badges : Statut (Actif / Archivé), Statut payeur (pastille).
- Boutons :
  - "+ Nouveau chantier" (CTA orange).
  - "+ Nouveau devis".
  - "✏️ Modifier".
  - "⋯" menu (Archiver, Fusionner, Bloquer, Exporter, Imprimer fiche).

**Cards stats** (4 colonnes en haut) :
- CA cumulé / CA 12 mois (toggle).
- Encours impayé (rouge si > 0).
- Chantiers actifs.
- Ancienneté (depuis date de création).

**Onglets** :

#### Onglet 1 : 📋 Informations
- Section "Identité" : raison sociale, nom commercial, SIRET, TVA intra, forme juridique, carte pro G/T (si syndic), date mandat.
- Section "Coordonnées" : adresse siège (avec mini-map MapLibre), téléphone, email, site web.
- Section "Conditions commerciales" : délai paiement, mode paiement, pénalités, code service Chorus, RIB.
- Section "Affectation" : agence référente, commercial dédié (technicien ou membre).
- Section "Tags" : chips éditables.

#### Onglet 2 : 📍 Lieux d'intervention
- Header avec recherche + bouton "+ Nouvelle résidence".
- Vue toggle : Liste / Carte (MapLibre).
- Liste : tableau avec nom, adresse, code postal, dernier chantier, nb chantiers, contact gardien.
- Carte : pins colorés selon nombre de chantiers (heatmap).
- Clic sur résidence → ouvre la fiche résidence (panneau latéral) avec stats, chantiers, contacts.

#### Onglet 3 : 👥 Contacts
- Header avec bouton "+ Ajouter un contact".
- Liste de cartes contacts :
  - Avatar (photo ou initiales).
  - Nom + rôle (Gestionnaire, Comptable...).
  - Tel + email cliquables.
  - Badge "Principal" si applicable.
  - Préférence communication (📧 / 📱).
  - Notes courtes.
  - Actions : Modifier · Supprimer.
- Cas particulier syndic : sous-section "Gestionnaires d'immeubles" avec leur affectation aux résidences.

#### Onglet 4 : 🏗️ Chantiers
- Filtres : statut, métier, période, agence.
- Tableau ou kanban (toggle) compact.
- Lien vers chaque chantier.

#### Onglet 5 : 📄 Devis
- Tableau filtré sur ce client.
- Statuts : brouillon, envoyé, accepté, refusé, expiré.
- Total cumulé en bas.

#### Onglet 6 : 💶 Factures
- Tableau filtré sur ce client.
- Cards stats : Total émis, Total payé, Encours, Retard moyen.
- Bouton "Relancer toutes les impayées" (envoie email récap).

#### Onglet 7 : 📁 Documents
- Catégories : Mandat syndic, Contrat cadre, Justificatifs, KBIS, Attestation TVA, Autres.
- Drop zone par catégorie.
- Limite : 200 Mo par client.

#### Onglet 8 : 📜 Historique / Activité
- Timeline chronologique inversée :
  - Création client (info).
  - Modifications (qui, quand, quoi).
  - Chantiers créés.
  - Factures émises / payées.
  - Communications (emails envoyés via Resend, à logger).
  - Tags ajoutés.
  - Archivages / désarchivages.
- Filtres par type d'activité.

#### Onglet 9 : 📝 Notes
- Zone texte rich (gras, italique, listes, liens).
- Auto-save après 2s.
- Indicateur "Modifié il y a X par [user]".
- Visibilité par rôle :
  - Toutes notes : owner, admin, accountant.
  - Notes "internes" (toggle privé) : owner, admin uniquement.

### 5.3 Modal "Nouveau client" (4 étapes)

Cf. parcours 4.1 pour le détail. Quelques précisions :

- Les champs s'adaptent au type sélectionné (étape 1) :
  - `particulier` : pas de raison sociale ni SIRET, juste prénom + nom.
  - `syndic` : ajoute carte pro G/T et date mandat.
  - `bailleur public` : ajoute code service Chorus Pro et n° engagement obligatoire.
  - `assurance` : ajoute champ "Référence dossier" sur chaque chantier futur.
- Validation SIRET en temps réel via API INSEE Sirene (gratuite, 30 req/sec).
  - Auto-remplit raison sociale et adresse depuis la base Sirene.
  - Détection si entreprise cessée → avertissement.
- Validation TVA intra via API VIES (vérification européenne).

### 5.4 Modal "Nouveau contact"

**Champs** :
- Civilité (M., Mme, autre).
- Prénom * Nom *.
- Rôle (autocomplete avec suggestions par type de client : Gestionnaire, Comptable, Assistante, Président conseil syndical, Expert, Directeur, Maintenance...).
- Email.
- Téléphone fixe.
- Mobile.
- Préférence communication (email / SMS / mobile).
- Disponibilités (texte libre, ex : "Lundi-Vendredi 9h-12h, 14h-17h").
- Toggle "Contact principal pour ce client".
- Affectation aux lieux d'intervention (multi-select, optionnel).
- Notes.
- Photo (optionnelle).

### 5.5 Modal "Nouvelle résidence / lieu d'intervention"

**Champs** :
- Nom * (ex : "Résidence Les Oliviers").
- Code interne (optionnel, ex : "OLV-34170" pour référence rapide).
- Adresse * (autocomplete).
- Coordonnées GPS (auto, modifiables).
- Année de construction.
- Nombre de lots (pour stats).
- Contact gardien (lien vers contact existant ou création inline).
- Code d'accès / digicode (chiffré en DB, visible uniquement aux admins, masqué par défaut).
- Particularités d'accès (texte libre).
- Documents (plans, règlement copro, etc.).
- Tags (ex : "ascenseur", "PMR", "sous-sol", "ALUR").

### 5.6 Modal "Fusionner clients"

Cf. parcours 4.4 pour le détail.

---

## 6. Statut payeur (calculé automatiquement)

Algorithme de scoring :

```
score = 100 (point de départ)
- 5 points par facture réglée avec retard (< 15 jours)
- 15 points par facture réglée avec retard (15-30 jours)
- 30 points par facture réglée avec retard (> 30 jours)
- 50 points par facture impayée actuelle (> 30 jours)
+ 5 points par facture réglée en avance (par mois)
- bornage [0, 100]

Buckets :
- 80-100 : 🟢 Bon payeur
- 50-79 : 🟡 Moyen payeur
- 0-49 : 🔴 Mauvais payeur
- "Bloqué" : statut manuel (override par admin/owner)
```

Recalculé en temps réel à chaque création/modification de facture ou paiement.
Affiché sur la liste clients et la fiche client.

Le statut "Bloqué" peut être appliqué manuellement par un owner pour empêcher la création de nouveaux chantiers (avec confirmation forte).

---

## 7. Matrice rôles × permissions

### 7.1 Clients

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste clients | ✅ tous | ✅ ses agences | ✅ tous | ✅ ceux liés à ses chantiers | ✅ tous (limité) |
| Voir fiche client | ✅ | ✅ | ✅ | ✅ (limitée) | ✅ (limitée) |
| Voir RIB / IBAN | ✅ | ✅ | ✅ | ❌ | ❌ |
| Voir notes confidentielles | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Voir CA et encours | ✅ | ✅ | ✅ | ❌ | ✅ (sans détail) |
| Créer client | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier client | ✅ | ✅ ses agences | ✅ (champs financiers) | ❌ | ❌ |
| Modifier conditions paiement | ✅ | ❌ | ✅ | ❌ | ❌ |
| Bloquer un client | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archiver | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Désarchiver | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fusionner | ✅ | ❌ | ❌ | ❌ | ❌ |
| Importer CSV | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exporter CSV | ✅ | ✅ | ✅ | ❌ | ❌ |

### 7.2 Contacts et lieux

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir contacts | ✅ | ✅ | ✅ | ✅ (ceux des chantiers liés) | ✅ |
| Créer contact | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier contact | ✅ | ✅ | ✅ | ❌ | ❌ |
| Supprimer contact | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Voir lieux | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer lieu | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir code d'accès | ✅ | ✅ | ❌ | ✅ (le jour de l'intervention) | ❌ |

---

## 8. Workflows clés

### 8.1 Détection automatique de doublons

Au moment de la création/import :
- **Hard match** : SIRET identique → bloque la création, propose de fusionner ou d'éditer existant.
- **Soft match** : nom similaire (Levenshtein ≤ 3) ET même agence ET (même téléphone OU même email) → avertissement non bloquant avec lien vers candidats.

### 8.2 Synchronisation API INSEE Sirene (auto-complétion à la création)

Quand l'utilisateur saisit un SIRET valide :
- Appel API INSEE → récupération automatique :
  - Raison sociale
  - Adresse siège
  - Code APE / NAF
  - Forme juridique
  - Date de création
  - État (actif / cessé)
- Pré-remplissage du formulaire avec validation visible (champs en vert).

### 8.3 Communication consolidée

Toutes les actions de communication (email, SMS Phase 2) avec un client sont loggées dans son historique :
- Source (qui a déclenché).
- Type (devis envoyé, relance facture, rappel intervention).
- Status (envoyé, ouvert, cliqué via Resend webhooks).
- Timestamp.

---

## 9. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| SIRET invalide (format ou Luhn) | Validation temps réel, message rouge, bouton "Continuer" grisé |
| SIRET valide mais entreprise cessée (INSEE) | Avertissement orange : "Cette entreprise est marquée comme cessée chez l'INSEE. Continuer quand même ?" |
| TVA intra invalide (VIES) | Avertissement, mais création possible (services VIES instables) |
| Particulier sans nom de famille | Validation : "Nom obligatoire pour un particulier" |
| Email contact déjà utilisé sur un autre contact du même client | Avertissement non bloquant : "Un contact avec cet email existe déjà : [Nom]. Voulez-vous tout de même créer ?" |
| Suppression d'un contact principal | Bloqué tant qu'un autre n'est pas marqué principal |
| Suppression d'un lieu avec chantiers liés | Soft delete uniquement. Lieu reste visible dans l'historique des chantiers. |
| Modification SIRET d'un client avec factures émises | Bloqué : "Le SIRET ne peut être modifié après émission de factures (mentions légales). Créez un nouveau client si nécessaire." |
| Tentative d'archiver un client avec encours | Avertissement fort + double confirmation |
| Fusion qui crée un conflit (ex : 2 contacts principaux) | Modal résout les conflits champ par champ |
| Import CSV avec ligne ayant des doublons internes au CSV | Détection lignes 4 et 17 même SIRET → Demande quoi faire (garder première / toutes / ignorer) |
| Téléphone international | Format E.164 stocké, affichage français pour les +33 |

---

## 10. Critères d'acceptation par fonctionnalité

### 10.1 Création client
- ✅ Champs adaptés selon type sélectionné.
- ✅ SIRET validé en temps réel via INSEE.
- ✅ Auto-remplissage depuis Sirene fonctionne et marque les champs en vert.
- ✅ TVA intra validée via VIES (warning si échec mais pas bloquant).
- ✅ Conditions de paiement par défaut selon type (60j syndic, 30j tertiaire, etc.).
- ✅ Création échoue si SIRET déjà existant dans l'organisation (sans archive).

### 10.2 Lieux d'intervention
- ✅ Création de lieu accessible depuis fiche client ET depuis création chantier.
- ✅ Adresse autocomplétée via Google Places restreint à FR.
- ✅ Coordonnées GPS sauvegardées pour calcul distance et carte.
- ✅ Gardien lié à un contact existant ou créé inline.
- ✅ Code d'accès chiffré en DB, visible uniquement aux rôles autorisés.

### 10.3 Vue 360°
- ✅ Cards stats calculées en temps réel.
- ✅ CA 12 mois mis à jour à chaque facture émise.
- ✅ Encours = somme factures non payées (hors avoirs).
- ✅ Statut payeur recalculé automatiquement après chaque paiement.
- ✅ Carte des lieux fonctionne avec pins.

### 10.4 Fusion
- ✅ Détection automatique des doublons à la création.
- ✅ Modal de fusion compare champ par champ.
- ✅ Tous les FK pointant vers le perdant sont mis à jour atomiquement.
- ✅ Activity log complet enregistré.
- ✅ Step-up auth requis.
- ✅ Action irréversible (pas de rollback automatique).

### 10.5 Import CSV
- ✅ Modèle téléchargeable.
- ✅ Mapping automatique avec édition manuelle possible.
- ✅ Mode dry-run produit un rapport sans écrire en base.
- ✅ Job en arrière-plan via Inngest.
- ✅ Notification de progression et email récap final.
- ✅ Rapport CSV des erreurs téléchargeable.

### 10.6 RLS et confidentialité
- ✅ Un technician ne voit pas les RIB/IBAN.
- ✅ Un viewer ne voit pas les notes confidentielles.
- ✅ Un admin de Perpignan ne voit pas les clients exclusivement de Montpellier.
- ✅ Tentative API directe d'accès → 404.
- ✅ Le code d'accès résidence est masqué par défaut, dévoilable au clic (avec audit log).

---

## 11. Métriques à suivre (PostHog)

### 11.1 Événements
- `client.created` (props: type, agency, source=manual|csv|api)
- `client.updated`
- `client.archived` (props: reason)
- `client.merged` (props: winner_id, loser_id, fields_count)
- `contact.created`
- `location.created`
- `client.csv_import_started` (props: row_count)
- `client.csv_import_completed` (props: success, errors, duplicates)
- `client.search_used` (props: query_length, result_count)
- `client.fiche_viewed` (props: client_id, tab)
- `client.export`

### 11.2 KPIs
- Taux de remplissage SIRET sur les clients B2B (objectif > 95 %).
- Taux d'utilisation des lieux d'intervention (objectif > 70 % des chantiers syndic).
- Taux de doublons détectés à la création (KPI qualité).
- Délai moyen de saisie d'un nouveau client (objectif < 90 sec avec auto-fill INSEE).
- Adoption de la fusion (combien de fusions par mois — indicateur qualité base).

---

## 12. Points ouverts à arbitrer plus tard

- **Portail client externe** : un syndic accède à ses chantiers et factures via un lien sécurisé — Phase 4.
- **Scoring crédit / blacklist partagée** : Phase 4 (avec opt-in inter-organisations holding).
- **Synchronisation contacts avec Outlook/Google Contacts** : Phase 3.
- **Segmentation marketing** : campagnes ciblées par segment (Phase 4).
- **Multi-langue contact** : si client international (Phase 5).
- **API publique pour intégrations clients** : Phase 4.
- **Champs custom par organisation** : Phase 4 (pour les autres entités du holding qui pourraient avoir besoin de champs spécifiques métier).
- **Qualification prospect / opportunité** : pour l'instant tout est "client" actif. Pipeline commercial plus tard si besoin.

---

*Fin de la spec module 03 — Clients & Contacts.*
*Prochaine spec : 04-chantiers-kanban.md (cœur métier : kanban, drag & drop, fiche chantier, recherche).*
