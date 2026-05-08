# Spec produit — Module 04 : Chantiers & Kanban

**Version** : 1.0
**Statut** : À implémenter en Sprint 5-6
**Dépendances** : Modules 01 (Auth), 02 (Équipe), 03 (Clients & Lieux)
**Sprints concernés** : Sprint 5, Sprint 6

---

## 1. Objectif du module

Module central de l'application. Permet de gérer le cycle de vie complet d'un chantier, depuis sa création jusqu'à sa clôture, dans une interface Kanban hautement productive. Couvre :

- la **vue Kanban** avec colonnes personnalisables, cartes draggables, mises à jour en temps réel,
- la **création de chantiers** (manuelle, depuis import IA, depuis devis accepté, en duplication),
- la **fiche chantier** complète en panneau latéral avec onglets (infos, interventions, documents, factures, notes, historique),
- la **recherche & filtres** multi-critères avec sauvegarde,
- les **vues alternatives** : Liste (tableau dense), Carte (géolocalisation),
- les **opérations bulk** (assignation, changement de statut, archivage),
- l'**audit trail** complet (qui, quand, quoi),
- la **synchronisation temps réel** entre utilisateurs (un tech qui passe en "en cours" est visible immédiatement par tous).

**Hors périmètre du module** :
- Création / édition d'interventions (module 05).
- Génération PDF (modules 06, 07, 08).
- Saisie de rapport technicien (Phase 3).
- Notifications push aux techniciens (Phase 2 mobile).

---

## 2. Modèle conceptuel

### 2.1 Schéma simplifié des relations

```
                ┌──────────────┐
                │  clients     │
                └──────┬───────┘
                       │
      ┌────────────────┼────────────────┐
      │ 1..n           │ 1..n           │ 1..n
      ▼                ▼                ▼
┌─────────────┐  ┌──────────┐  ┌──────────────────┐
│  chantiers  │──│ contacts │  │ client_locations │
└──────┬──────┘  └──────────┘  └──────────────────┘
       │
       │ 0..1                  ┌─────────────┐
       ├─────────────────────► │ technicians │ (assigné principal)
       │                       └─────────────┘
       │
       │ 0..1                  ┌─────────────┐
       ├─────────────────────► │ suppliers   │ (donneur d'ordre)
       │                       └─────────────┘
       │
       │ 1..n                  ┌────────────────┐
       ├─────────────────────► │ interventions  │ (planning)
       │                       └────────────────┘
       │
       │ 1..n                  ┌────────────┐
       ├─────────────────────► │ documents  │ (photos, BC, attestations)
       │                       └────────────┘
       │
       │ 0..n                  ┌─────────┐
       ├─────────────────────► │ quotes  │ (devis liés)
       │                       └─────────┘
       │
       │ 0..n                  ┌──────────┐
       └─────────────────────► │ invoices │ (factures émises pour ce chantier)
                               └──────────┘
```

### 2.2 Champs principaux d'un chantier

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | Identifiant unique |
| `organization_id` | UUID | ✅ | Multi-tenant |
| `reference` | TEXT | ✅ | "CH-2026-0001" auto-généré, séquence par organisation |
| `client_id` | UUID | ✅ | Référence au client |
| `location_id` | UUID | ❌ | Lieu d'intervention récurrent (résidence syndic) |
| `agency_id` | UUID | ✅ | Agence en charge (auto-déduite par CP si possible) |
| `metier` | TEXT | ✅ | Plomberie, Électricité, Toiture, Serrurerie, Menuiserie, Peinture, Maçonnerie, Syndics |
| `priority` | TEXT | ✅ | `normal`, `haute`, `urgence` |
| `status` | TEXT | ✅ | ID de la colonne kanban active |
| `title` | TEXT | ✅ | Titre court (ex : "Fuite radiateur Apt 12") |
| `description` | TEXT | ❌ | Description détaillée du besoin |
| `address` | JSONB | ✅ | Si pas de location : adresse propre. Si location : null (récupéré via `location_id`) |
| `tenant_name` | TEXT | ❌ | Nom du locataire / occupant |
| `tenant_phone` | TEXT | ❌ | Téléphone locataire |
| `tenant_email` | TEXT | ❌ | Email locataire |
| `supplier_id` | UUID | ❌ | Donneur d'ordre si différent du client |
| `supplier_reference` | TEXT | ❌ | "BC-FONCIA-2026-318" |
| `assigned_technician_id` | UUID | ❌ | Tech principal assigné |
| `scheduled_date` | DATE | ❌ | Date prévue de la première intervention |
| `deadline_date` | DATE | ❌ | Date limite de fin (échéance contractuelle) |
| `estimated_duration_hours` | NUMERIC | ❌ | Durée estimée totale |
| `tags` | TEXT[] | ❌ | Tags libres pour filtrage |
| `notes` | TEXT | ❌ | Notes internes |
| `metadata` | JSONB | ❌ | Champs custom selon métier |
| `created_by` | UUID | ✅ | User créateur |
| `created_at` | TIMESTAMPTZ | ✅ | Date création |
| `updated_at` | TIMESTAMPTZ | ✅ | Date dernière modif |
| `closed_at` | TIMESTAMPTZ | ❌ | Date passage en statut terminal |
| `archived_at` | TIMESTAMPTZ | ❌ | Soft delete |

### 2.3 Colonnes Kanban personnalisables

Les colonnes ne sont pas codées en dur. Chaque organisation peut les créer, renommer, réordonner, supprimer.

Colonnes par défaut à la création d'une organisation (cf. module 01 onboarding) :

```
🆕 Nouveau (initial=true)
   ↓
📅 Planifié
   ↓
🔧 En cours
   ↓
✅ Terminé (terminal=true)
```

Une organisation peut ajouter des colonnes intermédiaires : "🔍 Diagnostic", "💬 En attente client", "📋 À facturer", "⏸ En pause", "❌ Annulé" (terminal), etc.

**Contraintes** :
- Au moins une colonne `is_initial=true` (statut par défaut à la création).
- Au moins une colonne `is_terminal=true` (passage = `closed_at` automatique).
- La suppression d'une colonne avec chantiers exige une migration vers une autre colonne.
- L'ordre des colonnes (`position`) détermine l'affichage.
- Les colonnes peuvent être configurées par agence (Phase 4 ready : `agency_id` peut être NULL = toutes agences ou spécifique).

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue globale du board, supervision charge, déblocage cas exceptionnels, modification colonnes |
| **Chef d'agence (admin)** | Création / suivi des chantiers de ses agences, assignation, dispatch urgences |
| **Comptable (accountant)** | Lecture pour facturation, filtrage "Terminé non facturé", création de factures depuis chantier |
| **Technicien (technician)** | Vue de **ses** chantiers uniquement, passage en "en cours", "terminé", upload photos |
| **Lecture seule (viewer)** | Audit, suivi, lecture sans interaction |

---

## 4. Parcours utilisateur

### 4.1 Création manuelle d'un chantier

```
[Page Kanban] ou [Topbar globale]
   │
   ▼
Bouton "+ Nouveau chantier"
   │
   ▼
[Modal : Nouveau chantier — formulaire en 1 page (pas en wizard, pour rapidité)]
   - Section "Client" :
       • Champ avec autocomplete (cf. module 03 §4.2)
       • Si client choisi : champ "Lieu d'intervention" apparaît avec autocomplete des locations du client
       • Si pas de location : champ adresse manuel (autocomplete Google Places)
       • Détection automatique de l'agence par code postal
   - Section "Demande" :
       • Titre court * (ex : "Fuite radiateur Apt 12")
       • Métier * (select avec emoji)
       • Priorité (radio Normal / Haute / Urgence avec couleurs)
       • Description (texarea)
   - Section "Locataire / contact sur place" :
       • Nom du locataire
       • Téléphone (validation FR)
   - Section "Référence donneur d'ordre" :
       • Fournisseur / DO (autocomplete suppliers)
       • Réf. fournisseur (BC-FONCIA-318)
   - Section "Planification" :
       • Technicien (select avec dispo + charge actuelle visible)
       • Date prévue (date picker)
       • Durée estimée (heures)
       • Date limite contractuelle (date picker, optionnel)
   - Section "Tags" : chips additionnables
   - Section "Documents initiaux" : drop zone pour BC/photos/devis
   │
   ▼
   Boutons :
     - "Annuler"
     - "Créer et fermer"
     - "Créer et ouvrir la fiche" (par défaut)
     - "Créer et créer un autre" (workflow rapide)
   │
   ▼
[Backend]
   - Génération reference auto : CH-{year}-{seq:0000} (séquence par organisation)
   - Application du statut initial (colonne is_initial)
   - Insertion + activity_log
   - Notifications :
       • Au tech assigné : "Nouveau chantier : [titre]"
       • Si urgence : notif aussi à l'admin agence
   - Synchronisation temps réel : la carte apparaît chez tous les utilisateurs connectés sur le board
   │
   ▼
[Toast confirmation + redirection selon bouton choisi]
```

### 4.2 Création via raccourci urgence

Cas typique : appel téléphonique d'un syndic, urgence, on doit créer en 30 secondes.

```
[Topbar] ou [⌘⇧U / Ctrl+Shift+U]
   │
   ▼
[Modal raccourci urgence — formulaire ultra-court]
   - Client (autocomplete)
   - Adresse / Lieu (autocomplete)
   - Téléphone locataire
   - Métier
   - Description courte
   - Priorité forcée à "Urgence" (icône rouge)
   - Bouton géant "🚨 CRÉER ET DISPATCHER"
   │
   ▼
[Backend]
   - Création chantier
   - Tentative d'auto-assignation : tech disponible le plus proche, dans le bon métier, en agence concernée
   - Si aucun tech dispo : statut "Nouveau", notif à l'admin agence
   - Notif push (Phase 2) au tech
   │
   ▼
[Toast urgent + redirection sur fiche]
```

### 4.3 Drag & drop carte entre colonnes

```
[Page Kanban — utilisateur clique-maintient sur une carte]
   │
   ▼
[État drag]
   - Carte devient semi-transparente, ombre portée renforcée
   - Curseur en mode "grab"
   - Colonnes draggables s'illuminent (border bleue pointillée)
   - Colonnes non draggables (selon permissions) restent normales
   │
   ▼
[Dépose sur une colonne valide]
   - Animation fluide d'insertion
   - Update DB en optimistic UI (la carte bouge avant le retour serveur)
   - Si échec serveur : rollback + toast erreur
   - Si nouveau statut = is_terminal : prompt "Marquer comme terminé ? Le chantier sera archivé après 30 jours."
   │
   ▼
[Backend]
   - Update chantiers.status
   - Si is_terminal : update closed_at = now
   - Activity log (ancien statut → nouveau statut)
   - Notification au technicien si pertinent
   - Realtime broadcast à tous les clients connectés
   │
   ▼
[UI]
   - Toast : "✓ [ref] → [nouvelle colonne]"
   - Carte visible chez tous les utilisateurs en temps réel
```

### 4.4 Drag & drop colonne pour réordonner

```
[Page Kanban — utilisateur clique-maintient sur le header d'une colonne]
   │
   ▼
[État drag]
   - Header en mode grabbing
   - Colonnes voisines s'écartent
   │
   ▼
[Dépose entre 2 colonnes]
   - Modal de confirmation : "Déplacer 'En cours' avant 'Terminé' ?"
   - Avertissement : "Les chantiers restent dans cette colonne."
   - Boutons "Annuler" / "Déplacer"
   │
   ▼
[Confirmation]
   - Update chantier_columns.position
   - Animation de réorganisation
   - Activity log
```

### 4.5 Recherche et filtres

```
[Page Kanban — barre de filtres en haut]
   │
   ▼
Filtres actifs visibles sous forme de chips (cliquables pour retirer) :
   - 📍 Montpellier
   - 🔧 Plomberie
   - 🔴 Urgence
   - 👷 Pierre Durand
   - 📅 Cette semaine
   │
   ▼
[Bouton "+ Ajouter un filtre"] → menu déroulant :
   - Agence (multi)
   - Métier (multi)
   - Priorité
   - Technicien (multi)
   - Client (autocomplete)
   - Lieu d'intervention (autocomplete)
   - Période (création / planification / clôture)
   - Tags
   - Statut (multi colonnes)
   - Donneur d'ordre
   - Echéance dépassée
   │
   ▼
[Champ recherche full-text à droite]
   - Tape "fuite" → filtrage instantané sur titre, description, ref, ref fournisseur
   - Surlignage des termes correspondants dans les cartes
   - Debounce 200ms côté client
   │
   ▼
[Boutons sauvegarde de filtre]
   - "Sauver cette vue" → modal pour nommer ("Mes urgences", "Plomberie cette semaine"...)
   - Mes vues sauvegardées en sidebar gauche du kanban
   - Vues partagées avec l'équipe (option)
```

### 4.6 Vue Liste (alternative)

Pour les utilisateurs qui préfèrent un tableau dense (typiquement comptable, lecture seule).

```
[Toggle Kanban / Liste / Carte en haut à droite du board]
   │
   ▼
[Vue Liste — tableau triable]
Colonnes :
   ☐ Sélection · Réf · Titre · Client · Lieu · Métier · Priorité ·
   Tech · Statut · Créé · Échéance · Actions

Tri par défaut : créé desc.
Filtres identiques à la vue Kanban.
Pagination 50/100/250.
Multi-sélection avec actions bulk en bas.
```

### 4.7 Vue Carte (géolocalisation)

```
[Toggle Carte]
   │
   ▼
[Carte plein écran (MapLibre + tuiles OSM)]
   - Pins colorés selon statut (couleur de la colonne)
   - Cluster automatique au dézoomage
   - Clic sur pin → popup avec mini-carte chantier (titre, client, tech, statut)
   - Bouton "Ouvrir" → fiche
   - Filtres latéraux identiques aux autres vues
   - Heatmap optionnelle (densité de chantiers par zone)
   - Itinéraire entre chantiers d'un tech (Phase 2 mobile)
```

### 4.8 Ouverture de la fiche chantier

```
[Clic sur une carte ou ligne]
   │
   ▼
[Panneau latéral droite — 720 px desktop, plein écran mobile]
   Slide-in animation (250ms)
   Fond légèrement assombri
```

### 4.9 Modification du statut depuis la fiche

```
[Fiche chantier — header]
   - Dropdown de statut visible
   │
   ▼
[Sélection d'un nouveau statut]
   - Si terminal : confirmation + remarques de clôture (texte libre)
   - Si retour en arrière (ex: terminé → en cours) : confirmation
   │
   ▼
   Update + animation : la carte est remplacée à la bonne position dans le kanban en arrière-plan
```

### 4.10 Création de devis ou facture depuis chantier

```
[Fiche chantier → bouton "+ Devis" ou "+ Facture"]
   │
   ▼
[Modal du module concerné, pré-rempli avec :]
   - Client : pré-sélectionné
   - Lieu : pré-sélectionné
   - Référence chantier liée
   - Description : depuis description chantier
   │
   ▼
[Workflow standard du module 06 ou 07]
```

### 4.11 Bulk operations (vue Liste)

```
[Vue Liste — sélection multiple via checkbox]
   │
   ▼
[Barre d'actions bulk apparaît en bas]
   - "X sélectionnés"
   - Boutons :
       • Réassigner technicien
       • Changer statut
       • Ajouter tag
       • Archiver
       • Exporter en PDF
       • Exporter CSV
   │
   ▼
[Modal selon action]
   - Réassignation : select tech, option de réassigner les interventions futures aussi
   - Changement statut : select colonne, confirmation si terminal
   - Tag : input avec autocomplete
   - Archivage : confirmation forte si chantiers en cours
```

### 4.12 Archivage / Suppression

Pas de suppression réelle. Archivage seulement (conservation 10 ans).

```
[Fiche chantier → ⋯ → Archiver]
   │
   ▼
[Modal de confirmation]
   - "Archiver ce chantier ?"
   - Vérifications :
       • Interventions à venir : "Les annuler ?" (oui par défaut)
       • Factures non payées : avertissement
       • Documents : conservés
   - Raison (optionnel)
   - Step-up auth si admin/owner
   │
   ▼
[Backend]
   - chantiers.archived_at = now
   - Annulation des interventions futures (status = 'annulée')
   - Activity log
```

---

## 5. Écrans détaillés

### 5.1 Page Kanban

**URL** : `/chantiers` (par défaut, vue Kanban)
**Layout** : header de filtres + board horizontal scrollable.

**Header** :
- Titre "🏗️ Chantiers" + total chantiers actifs.
- Toggle vue : Kanban / Liste / Carte.
- Onglets de filtres rapides (configurable par organisation) :
  - Tous (par défaut)
  - 🔴 Urgences
  - 📍 [Agence 1]
  - 📍 [Agence 2]
  - Mes chantiers (filtre auto sur tech connecté)
  - Échus / Échéance proche
- Recherche full-text (à droite).
- Boutons :
  - "+ Chantier" (orange).
  - "⚙️ Colonnes" (gestion).
  - "💾 Vues" (vues sauvegardées).

**Board** :
- Colonnes horizontales scrollables.
- Largeur colonne : 280 px.
- Header colonne : background coloré par la colonne, emoji + label + compte.
- Actions par colonne (3 icônes au survol) :
  - "+" : créer chantier directement dans cette colonne.
  - "✏️" : renommer.
  - "🗑" : supprimer (avec migration).
- Body colonne :
  - Virtual scrolling si > 50 cartes.
  - Drop zone visuelle au survol drag.
  - Empty state : "Aucun chantier" centré gris clair.
- Carte de chantier :
  - Bordure gauche colorée selon priorité (rouge/orange/vert).
  - Header : référence + menu ⋯.
  - Titre court (gras).
  - Sous-titre : métier emoji + 📍 lieu / agence.
  - Tags / chips : priorité, ref fournisseur, échéance proche (rouge si <3j).
  - Footer : avatar tech + nom + date relative.
  - Indicateur d'interventions : "🔧 2/4" (terminées/total).
  - Indicateur de docs : "📁 5".
  - Au survol : ombre renforcée, légère élévation.
  - Au drag : opacité 30%, autres cartes s'écartent légèrement.

**Bouton flottant mobile** :
- Sur mobile, FAB orange en bas à droite "+".

**Comportement temps réel** :
- Connexion Supabase Realtime à `chantiers:org_id={current_org}`.
- Insert : nouvelle carte apparaît avec animation pulse.
- Update : carte se déplace si `status` change, anim subtile sinon.
- Delete (archive) : carte fade-out.

### 5.2 Vue Liste

**URL** : `/chantiers?view=list`

**Tableau dense, sticky header** :

| ☐ | Réf | Titre | Client | Lieu | Métier | Prio | Tech | Statut | Créé | Échéance | Actions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ☐ | CH-2026-0042 | Fuite radiateur Apt 12 | Foncia Sud | Les Oliviers | 🔧 Plomberie | 🔴 Urgence | M. Leroy | En cours | 02/05 | 06/05 | ⋯ |

**Caractéristiques** :
- Tri par colonne (clic sur header).
- Filtres identiques au Kanban.
- Pagination 50/100/250.
- Densité réglable (compact / confort).
- Export CSV de la sélection courante.
- Multi-sélection avec actions bulk en bas.

### 5.3 Vue Carte

**URL** : `/chantiers?view=map`

**MapLibre GL avec tuiles OpenStreetMap** :
- Centre par défaut : barycentre des agences ou agence active.
- Pins colorés par statut.
- Cluster automatique (chiffre dans bulle).
- Popup au clic sur pin : mini-card avec lien fiche.
- Filtres latéraux identiques.
- Légende des statuts en bas à droite.
- Toggle "Afficher zones agences" (cercles colorés sur les CP couverts).

### 5.4 Fiche chantier (panneau latéral)

**Largeur** : 720 px desktop, plein écran mobile.
**Animation** : slide-in droite, 250ms ease-out.
**Fermeture** : clic fond, croix, ou ESC.

**Header** :
- Référence + bouton copy.
- Titre court.
- Sous-titre : client + lieu / adresse.
- Statut : dropdown éditable (cf. 4.9).
- Boutons d'action :
  - "+ Intervention".
  - "+ Devis".
  - "+ Facture".
  - "📞 Appeler" (ouvre le téléphone du locataire).
  - "🗺️ Itinéraire" (ouvre Google Maps avec adresse).
  - "⋯ Plus" : Modifier · Dupliquer · Imprimer fiche · Archiver.
  - "✕ Fermer".

**Stepper de statut** :
- Affiche les colonnes de l'organisation comme étapes.
- Étape courante en bleu, précédentes en vert ✓, suivantes en gris.

**Cards stats (4 colonnes)** :
- Interventions : 2 / 4 (terminées / total).
- Documents : 8.
- Devis : 1 (envoyé).
- Facturation : 320 € HT (à émettre).

**Onglets** :

#### Onglet 1 : 📋 Infos
- Section "Demande" :
  - Description complète.
  - Métier, priorité, deadline.
- Section "Localisation" :
  - Adresse complète.
  - Mini-carte MapLibre (200 px).
  - Lien "Itinéraire".
  - Si lieu lié : lien vers fiche du lieu.
  - Code d'accès (si renseigné, masqué par défaut, audit log au dévoilement).
- Section "Locataire" :
  - Nom + téléphone (cliquable tel:) + email (cliquable mailto:).
- Section "Donneur d'ordre" :
  - Fournisseur + référence BC.
- Section "Planification" :
  - Technicien assigné + sa charge.
  - Date prévue.
  - Durée estimée.
- Section "Tags" : chips éditables.

#### Onglet 2 : 🔧 Interventions
- Liste chronologique des interventions (passées → futures).
- Compact : date, heure, durée, type, technicien, statut.
- Bouton "+ Planifier une intervention" (cf. module 05).
- Clic sur intervention → édition.

#### Onglet 3 : 📁 Documents
- Catégories : BC, Photos avant, Photos après, Attestations, Factures, Autres.
- Drop zone par catégorie ou globale.
- Liste / grid toggle.
- Aperçu PDF inline.
- Aperçu image avec lightbox.
- Limite : 500 Mo par chantier.
- Métadonnées EXIF des photos affichées (date, géoloc).

#### Onglet 4 : 💶 Facturation
- Liste devis et factures liés.
- Statuts visibles.
- Boutons "+ Devis" et "+ Facture".

#### Onglet 5 : 📝 Notes
- Zone texte rich, auto-save.
- Visibilité par rôle.

#### Onglet 6 : 📜 Historique
- Timeline activity_log filtré sur ce chantier.
- Création, modifications, changements statut, ajout intervention, upload doc, etc.
- Filtre par type d'activité.

### 5.5 Modal "Nouveau chantier"

Cf. parcours 4.1 pour le détail.

**Comportements clés** :
- Auto-déduction agence par CP (si lieu adresse renseigné).
- Détection en temps réel de chantiers similaires (même client + même lieu + < 30j) → avertissement non bloquant.
- Sauvegarde brouillon automatique (si fermeture sans création).
- Raccourci clavier "Ctrl+Enter" pour valider.

### 5.6 Modal "Gérer les colonnes"

**URL** : ouverte via bouton dédié sur la page Kanban.

**Layout** :
- Liste draggable des colonnes existantes.
- Pour chaque colonne :
  - Drag handle ⠿.
  - Pastille couleur.
  - Emoji + nom.
  - Compteur chantiers (ex : "23 chantiers").
  - Toggle "Statut initial" (un seul).
  - Toggle "Statut terminal".
  - Boutons : Modifier · Supprimer.
- Bouton "+ Ajouter une colonne".

**Édition d'une colonne** :
- Emoji (input emoji picker).
- Label.
- Couleur (picker 10 couleurs prédéfinies + custom).
- Toggle initial / terminal.
- Position (auto via drag).

**Suppression** :
- Si colonne vide : suppression directe avec confirmation.
- Sinon : modal demandant la colonne de destination des chantiers.

---

## 6. Drag & drop : implémentation

### 6.1 Bibliothèque
- **@dnd-kit/core** + **@dnd-kit/sortable** + **@dnd-kit/utilities**.
- Plus robuste que HTML5 native (qui pose problèmes en mobile, accessibilité, multi-touch).

### 6.2 Comportements desktop
- Click + hold + move pour démarrer le drag.
- Curseur "grab" puis "grabbing".
- Auto-scroll horizontal si proche du bord pendant le drag.
- Touche ESC annule le drag en cours.

### 6.3 Comportements mobile
- Long-press 200ms pour démarrer le drag (évite les conflits avec scroll).
- Vibration légère au démarrage (haptic feedback).
- Auto-scroll vertical et horizontal.
- Indicateur visuel du target.

### 6.4 Accessibilité (a11y)
- Drag déclenchable au clavier : Tab pour focus, Espace pour saisir, flèches pour déplacer, Espace ou Entrée pour déposer.
- Annonces vocales aux utilisateurs de lecteurs d'écran ("Carte CH-2026-0042 saisie. Utilisez les flèches pour la déplacer.").
- Focus rings visibles.

### 6.5 Optimistic updates
- Avant le retour serveur, l'UI est déjà à jour.
- En cas d'échec : rollback animé + toast erreur.
- Permet une expérience fluide même sur réseau lent.

### 6.6 Conflits temps réel
- Si deux utilisateurs déplacent la même carte simultanément : last-write-wins, le second voit son écran rafraîchir avec l'état serveur final.
- Toast info : "Cette carte a été modifiée par [user]".

---

## 7. Recherche et filtres

### 7.1 Recherche full-text
- Implémentation Postgres `tsvector` sur `(title, description, reference, supplier_reference)`.
- Index GIN pour performance.
- Stemming français activé.
- Surlignage des correspondances dans les cartes (HTML `<mark>`).
- Debounce client 200ms.

### 7.2 Filtres
- Stockés dans l'URL (query params) → partageable, history-aware.
- Multi-valeurs via virgule : `?metier=plomberie,electricite`.
- Filtres complexes (date ranges) : `?created_from=2026-04-01&created_to=2026-05-01`.
- Combinaisons AND par défaut, OR explicite via opérateur (Phase 2).

### 7.3 Vues sauvegardées
- Table `saved_views` (org_id, user_id, name, filters JSONB, is_shared, created_at).
- Sidebar des vues avec icône et raccourci.
- Possibilité de partager une vue avec toute l'équipe (admin / owner).

---

## 8. Matrice rôles × permissions

### 8.1 Sur les chantiers

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir le board | ✅ tous | ✅ ses agences | ✅ tous | ✅ ses chantiers | ✅ tous (limité) |
| Voir détail chantier | ✅ | ✅ | ✅ | ✅ ses chantiers | ✅ (sans notes confidentielles) |
| Créer chantier | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier chantier | ✅ | ✅ ses agences | ❌ | ✅ champs limités (notes, statut) | ❌ |
| Réassigner technicien | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Changer statut | ✅ | ✅ | ❌ | ✅ ses chantiers | ❌ |
| Drag & drop carte | ✅ | ✅ | ❌ | ✅ ses chantiers | ❌ |
| Drag & drop colonne | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archiver | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Désarchiver | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bulk operations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir audit log | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier référence | ❌ (immuable après création) | ❌ | ❌ | ❌ | ❌ |

### 8.2 Sur les colonnes

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Créer colonne | ✅ | ✅ | ❌ | ❌ | ❌ |
| Renommer colonne | ✅ | ✅ | ❌ | ❌ | ❌ |
| Réordonner | ✅ | ✅ | ❌ | ❌ | ❌ |
| Supprimer | ✅ | ❌ | ❌ | ❌ | ❌ |
| Définir initial / terminal | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 9. Workflows clés

### 9.1 Auto-bascule en "Terminé"

Règle métier optionnelle (paramétrable par organisation) : quand toutes les interventions d'un chantier sont en statut "terminée", proposer de passer le chantier en colonne terminale.

```
[Dernière intervention passe en "terminée"]
   │
   ▼
[Banner sur la fiche chantier]
   "Toutes les interventions sont terminées. Marquer le chantier comme terminé ?"
   - Bouton "Marquer terminé"
   - Bouton "Plus tard"
```

Si paramètre `auto_close_chantier=true` : passage automatique sans demande, juste notification.

### 9.2 Notification urgence non assignée

Si un chantier en priorité "urgence" reste sans `assigned_technician_id` plus de 30 minutes :
- Notification automatique à l'admin de l'agence (email + in-app).
- Affichage prioritaire sur le board avec animation pulse.
- Échalation : si toujours non assigné après 1h, notif au gérant.

### 9.3 Détection chantiers similaires

À la création d'un nouveau chantier, si :
- même `client_id` ET
- même `location_id` (ou même adresse) ET
- créé il y a moins de 30 jours

→ avertissement non bloquant : "Un chantier similaire existe déjà : [lien]. Voulez-vous tout de même créer ?"

### 9.4 Auto-archivage des terminés

Job Inngest quotidien :
- Tous les chantiers `closed_at` < 30 jours → archived_at = now.
- Notification owner avec récap mensuel : "X chantiers archivés ce mois".

### 9.5 Échéance dépassée

Job Inngest quotidien :
- Pour chaque chantier avec `deadline_date < today` ET non terminal :
  - Tag automatique "échu".
  - Notification au tech assigné + admin.
  - Affichage badge rouge sur la carte.

---

## 10. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Drag d'une carte vers la même colonne | Pas de changement, pas de notif |
| Drag avec problème réseau | Optimistic UI, rollback + toast erreur si échec |
| Drop sur une zone non-droppable | Animation retour à la position d'origine |
| Suppression de la dernière colonne `is_initial` | Bloqué : "Au moins une colonne initiale est requise" |
| Création chantier avec client archivé | Bloqué : "Ce client est archivé. Désarchivez-le ou choisissez-en un autre." |
| Tech assigné devient inactif | Le chantier reste, mais une alerte apparaît : "Technicien désactivé. Réassigner ?" |
| Lieu d'intervention supprimé en parallèle | Le chantier conserve l'adresse copiée, lien orphelin |
| Recherche sans résultat | Empty state : "Aucun chantier ne correspond. Vérifiez vos filtres ou [Réinitialiser]" |
| Page chargée avec >2000 chantiers | Pagination par colonne, lazy loading des cartes invisibles |
| Hors-ligne | Banner orange : "Hors ligne — modifications stockées localement, sync au retour" (PWA service worker) |
| Conflit temps réel (édition concurrente) | Last-write-wins + toast info + diff visible dans audit log |
| Tentative de modification d'une référence | Bloqué : référence immuable après création |
| Tag avec caractère interdit | Validation : alphanumeric + tirets/underscores |

---

## 11. Critères d'acceptation par fonctionnalité

### 11.1 Création chantier
- ✅ Référence générée automatiquement, séquence sans trou.
- ✅ Validation client obligatoire (autocomplete + création inline OK).
- ✅ Auto-déduction agence via CP fonctionne.
- ✅ Détection chantiers similaires affichée si applicable.
- ✅ Brouillon sauvegardé automatiquement en cas de fermeture.
- ✅ Notifications envoyées au tech + admin si urgence.

### 11.2 Drag & drop
- ✅ Drag carte fluide, animations 60fps.
- ✅ Drag colonne avec confirmation modal.
- ✅ Optimistic UI : carte bouge avant retour serveur.
- ✅ Rollback en cas d'échec.
- ✅ Realtime broadcast aux autres clients fonctionne.
- ✅ A11y clavier fonctionne.

### 11.3 Vues
- ✅ Toggle Kanban / Liste / Carte préserve les filtres.
- ✅ Vue Liste triable par toutes les colonnes.
- ✅ Vue Carte affiche les pins corrects.
- ✅ État de la vue stocké dans l'URL.

### 11.4 Recherche
- ✅ Recherche full-text retourne en < 200ms pour 10 000 chantiers.
- ✅ Surlignage des correspondances visible.
- ✅ Combinaison filtres + recherche fonctionne.

### 11.5 Vues sauvegardées
- ✅ Création / suppression vue OK.
- ✅ Vue partagée visible par tous les rôles concernés.
- ✅ Sidebar avec liste des vues.

### 11.6 Fiche chantier
- ✅ Slide-in animation 250ms.
- ✅ Tous les onglets se chargent en moins de 500ms (lazy load des données).
- ✅ Mini-carte fonctionne avec coordonnées GPS du lieu.
- ✅ Boutons d'action mènent aux bons modules.
- ✅ Audit log complet et lisible.

### 11.7 Permissions et RLS
- ✅ Un technician ne voit que ses chantiers.
- ✅ Un admin de Perpignan ne voit pas Montpellier.
- ✅ Tentative d'API directe sur chantier non autorisé → 404.
- ✅ Référence chantier immuable même via API directe.

### 11.8 Performance
- ✅ Kanban 500 cartes : scroll fluide à 60fps.
- ✅ Realtime : update visible chez tous en < 1s.
- ✅ Recherche : < 200ms.
- ✅ Ouverture fiche : < 500ms.

---

## 12. Métriques à suivre (PostHog)

### 12.1 Événements
- `chantier.created` (props: source=manual|urgent_shortcut|import|duplicate, metier, priority, has_assigned_tech, has_location)
- `chantier.viewed` (props: chantier_id, view_type=kanban|list|map|fiche)
- `chantier.status_changed` (props: from, to, method=drag|fiche_dropdown|bulk)
- `chantier.assigned_technician_changed`
- `chantier.archived` (props: reason)
- `chantier.search_performed` (props: query_length, result_count)
- `chantier.filter_applied` (props: filter_type, value)
- `chantier.view_changed` (props: view_type)
- `chantier.saved_view_created`
- `chantier.bulk_action` (props: action, count)
- `kanban.column_created`
- `kanban.column_renamed`
- `kanban.column_reordered`
- `kanban.column_deleted` (props: had_chantiers, migration_target)
- `chantier.urgent_shortcut_used`

### 12.2 KPIs
- Temps moyen "création urgence → assignation tech" (objectif < 5 min).
- Temps moyen "Nouveau" → "Terminé" (par métier, par client).
- Taux de chantiers archivés sans facturation (KPI qualité, doit tendre vers 0).
- Adoption raccourci urgence (vs création standard).
- Adoption vues sauvegardées.
- Taux d'échantillonnage temps réel (carte mise à jour chez tous en < 1s).
- Nombre moyen de drag & drop par jour (engagement).

---

## 13. Points ouverts à arbitrer plus tard

- **Sous-tâches / checklists par chantier** : utile pour les chantiers complexes (Phase 2-3).
- **Templates de chantier** : un template "Fuite radiateur" pré-remplit champs et checklists (Phase 3).
- **Dépendances entre chantiers** : "Ce chantier doit attendre la fin de l'autre" (Phase 4).
- **Vue Gantt** alternative pour le pilotage temporel (Phase 4).
- **Vue Calendrier** intégrée (en plus du module Planning) (Phase 3).
- **Champs custom par organisation** : Phase 4 (besoins spécifiques métiers).
- **Workflows automatisés** : "Si un chantier de plomberie passe en `terminé`, créer auto la facture" (Phase 4).
- **Modèles de notification configurables** : (Phase 3).

---

*Fin de la spec module 04 — Chantiers & Kanban.*
*Prochaine spec : 05-interventions-planning.md (planning hebdomadaire, conflits horaires, géoloc).*
