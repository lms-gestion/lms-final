# Spec produit — Module 05 : Interventions & Planning

**Version** : 1.0
**Statut** : À implémenter en Sprint 7
**Dépendances** : Modules 01 (Auth), 02 (Équipe), 03 (Clients & Lieux), 04 (Chantiers)
**Sprint concerné** : Sprint 7

---

## 1. Objectif du module

Gérer la planification opérationnelle des interventions terrain. Une intervention est un événement daté et minuté, lié à un chantier, assigné à un technicien.

Le module couvre :

- la **création / édition d'interventions** depuis la fiche chantier ou le planning,
- les **vues planning** : semaine (5 jours × techniciens), jour, tech individuel, mois,
- la **détection des conflits horaires** (chevauchement, surcharge, indisponibilités),
- la **géolocalisation et optimisation de tournée** (distance entre interventions consécutives, ordre suggéré),
- l'**export iCal** par technicien pour synchronisation Google Calendar / Outlook / Apple Calendar,
- les **statuts d'intervention** (planifiée, en cours, terminée, annulée, reportée),
- la **timeline d'arrivée / départ** (saisie manuelle Phase 1, GPS automatique Phase 2),
- les **notes d'intervention** (synthèse rapide, à enrichir avec les rapports voix/IA en Phase 3).

**Hors périmètre du module** :
- Saisie de rapport détaillé sur le terrain (Phase 3 IA).
- Signature client électronique (Phase 2 mobile).
- Photos avant/après (Phase 2 mobile, mais doc upload depuis bureau OK Phase 1).
- Pointage horaire pour la paie (Phase 3+).
- Optimisation tournée multi-techniciens automatique (Phase 4).

---

## 2. Modèle conceptuel

### 2.1 Champs principaux d'une intervention

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ | Identifiant unique |
| `organization_id` | UUID | ✅ | Multi-tenant |
| `chantier_id` | UUID | ✅ | Chantier rattaché |
| `technician_id` | UUID | ✅ | Tech assigné (un seul Phase 1) |
| `type` | TEXT | ✅ | `diagnostic`, `reparation`, `travaux`, `controle`, `urgence`, `livraison`, `autre` |
| `scheduled_at` | TIMESTAMPTZ | ✅ | Date + heure planifiées |
| `duration_minutes` | INT | ✅ | Durée prévue en minutes (default 60) |
| `status` | TEXT | ✅ | `planifiée`, `en_cours`, `terminée`, `annulée`, `reportée` |
| `arrived_at` | TIMESTAMPTZ | ❌ | Heure réelle d'arrivée |
| `completed_at` | TIMESTAMPTZ | ❌ | Heure réelle de fin |
| `actual_duration_minutes` | INT | ❌ | Durée réelle (calculée si arrivée + fin renseignées) |
| `title` | TEXT | ❌ | Titre court optionnel (auto-généré : "Diagnostic — Plomberie") |
| `notes` | TEXT | ❌ | Notes pour le tech (consignes, codes, particularités) |
| `report` | TEXT | ❌ | Compte-rendu post-intervention (Phase 3 IA enrichira) |
| `geolocation_arrival` | JSONB | ❌ | Position GPS à l'arrivée (Phase 2 mobile) |
| `signature_url` | TEXT | ❌ | Signature client (Phase 2 mobile) |
| `client_satisfaction` | INT | ❌ | Note 1-5 (Phase 2-3) |
| `created_by` | UUID | ✅ | Qui a créé l'intervention |
| `created_at`, `updated_at` | TIMESTAMPTZ | ✅ | |
| `cancelled_at` | TIMESTAMPTZ | ❌ | Date d'annulation |
| `cancellation_reason` | TEXT | ❌ | Raison annulation |

### 2.2 Statuts et transitions

```
                 ┌──────────────┐
                 │  planifiée   │ (création)
                 └──────┬───────┘
                        │
              ┌─────────┼──────────┬─────────────┐
              │         │          │             │
              ▼         ▼          ▼             ▼
       ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
       │ en_cours │ │reportée │ │annulée  │ │ terminée │
       └────┬─────┘ └────┬────┘ └─────────┘ └──────────┘
            │            │
            ▼            ▼
       ┌──────────┐  (génère une nouvelle
       │ terminée │   intervention planifiée)
       └──────────┘
```

**Règles** :
- Création par défaut : `planifiée`.
- `en_cours` : déclenchée par le tech au démarrage (Phase 2 mobile auto, Phase 1 manuel par admin/tech).
- `terminée` : peut être directe depuis `planifiée` ou `en_cours`.
- `reportée` : crée une nouvelle intervention `planifiée` à une autre date, l'originale passe en `reportée` figée.
- `annulée` : terminale, raison obligatoire.
- Une intervention `terminée` ne peut être modifiée que par owner/admin (audit log).

### 2.3 Types d'intervention

| Type | Emoji | Couleur | Durée par défaut | Description |
|---|---|---|---|---|
| `diagnostic` | 🔍 | Bleu clair | 60 min | Visite de constat, devis |
| `reparation` | 🛠️ | Bleu | 120 min | Intervention curative |
| `travaux` | 🏗️ | Orange | 240 min (4h) | Travaux planifiés (rénovation, gros œuvre) |
| `controle` | ✅ | Vert | 30 min | Visite de contrôle, vérification |
| `urgence` | 🚨 | Rouge | 90 min | Intervention d'urgence non planifiée |
| `livraison` | 📦 | Violet | 30 min | Livraison de matériel |
| `autre` | 📋 | Gris | 60 min | Autre |

---

## 3. Personas concernés

| Persona | Cas d'usage principal |
|---|---|
| **Gérant (owner)** | Vue globale planning multi-agences, supervision charge équipe |
| **Chef d'agence (admin)** | Création / modification interventions, gestion conflits, dispatch urgences |
| **Comptable (accountant)** | Lecture pour facturation au temps passé, vérification durée réelle |
| **Technicien (technician)** | Voir SON planning, marquer arrivée/départ, prendre notes |
| **Lecture seule (viewer)** | Audit, lecture |

---

## 4. Parcours utilisateur

### 4.1 Création d'une intervention depuis la fiche chantier

```
[Fiche chantier → onglet Interventions → bouton "+ Planifier"]
   │
   ▼
[Modal : Planifier une intervention]
   - Type * (select avec emoji et couleur)
   - Technicien * (select : techs de l'agence du chantier)
       └── Indicateur de charge à côté de chaque nom :
             "Pierre Durand — 32h cette semaine (charge 87%)"
   - Date * (date picker)
   - Heure début * (time picker, pas de 15 min)
   - Durée prévue * (select : 30min, 1h, 1h30, 2h, 3h, 4h, journée)
   - Titre (optionnel, auto-généré si vide)
   - Notes pour le technicien (consignes, codes d'accès, contact à appeler avant arrivée)
   - Statut initial (par défaut "planifiée")
   - Bouton "Annuler" et "✓ Planifier"
   │
   ▼
[Vérification automatique conflits]
   - Si conflit détecté : avertissement modal :
       "⚠️ Pierre Durand a déjà une intervention le 06/05 de 14h00 à 16h00.
        Cette intervention en chevaucherait une partie.
        Voulez-vous tout de même planifier ?"
       [ Voir le détail ] [ Annuler ] [ Planifier quand même ]
   │
   ▼
[Backend]
   - Insert dans interventions
   - Activity log
   - Notification au tech : "Nouvelle intervention le [date] à [heure] — [client]"
   - Realtime broadcast (planning mis à jour chez tous)
   │
   ▼
[Toast confirmation + retour fiche chantier avec intervention dans la liste]
```

### 4.2 Création depuis la vue Planning

```
[Page Planning → vue Semaine]
   │
   ▼
[Drag d'une plage horaire dans une cellule du tableau (lundi 14h-16h pour Pierre)]
   │
   ▼
[Modal pré-remplie : tech, date, heure, durée]
   - Reste à choisir le chantier (autocomplete)
   - Type d'intervention
   - Notes
   │
   ▼
[Validation → création identique au flow 4.1]
```

### 4.3 Modification / déplacement d'une intervention

```
[Vue Planning → drag d'un événement vers une autre cellule (autre tech ou autre horaire)]
   │
   ▼
[Confirmation modal]
   - "Déplacer cette intervention ?"
   - Détails du déplacement : ancien créneau → nouveau créneau
   - Notification au tech impacté ?
   - Boutons "Annuler" / "Déplacer"
   │
   ▼
[Backend]
   - Update intervention
   - Vérification conflits sur la nouvelle plage
   - Notification tech (ancien + nouveau si réassignation)
   - Activity log
```

**Drag aussi possible pour redimensionner la durée** (poignée en bas de l'événement).

### 4.4 Démarrage d'une intervention (statut → en_cours)

```
[Phase 1 — depuis la fiche intervention ou planning]
   - Bouton "▶ Démarrer"
   - Demande de saisie heure d'arrivée (par défaut "maintenant")
   - Update status='en_cours', arrived_at=now
   - Notification à l'admin agence : "Pierre Durand a démarré l'intervention chez Foncia — Les Oliviers"

[Phase 2 — automatique mobile]
   - Le tech est sur place, GPS détecte qu'il est dans le périmètre du lieu
   - Notif push "Vous êtes sur place. Démarrer l'intervention ?"
   - 1 tap pour confirmer
   - Géoloc enregistrée
```

### 4.5 Clôture d'une intervention

```
[Bouton "✓ Terminer"]
   │
   ▼
[Modal de clôture]
   - Heure de fin (par défaut "maintenant")
   - Type de résultat :
       ○ Intervention terminée (problème résolu)
       ○ Intervention partielle (besoin d'une autre intervention)
       ○ Bloquée (problème externe)
   - Compte-rendu (textarea, obligatoire)
   - Matériel utilisé (Phase 1 : texte libre, Phase 2 : structuré)
   - Photos (drop zone, optionnel Phase 1)
   - Si "intervention partielle" : checkbox "Planifier une autre intervention" → ouvre modal de planification
   - Bouton "Terminer"
   │
   ▼
[Backend]
   - status='terminée', completed_at=now
   - actual_duration_minutes calculé
   - Si checkbox "intervention partielle" : pré-remplit modal pour la suivante
   - Activity log
   - Si toutes les interventions du chantier sont terminées :
       → cf. workflow auto-bascule chantier (module 04 §9.1)
```

### 4.6 Annulation / report

```
[Bouton "⊘ Annuler" ou "📅 Reporter"]
   │
   ▼
[Modal]
   - Annulation : raison obligatoire (select + texte libre), notification tech + client
   - Report : nouvelle date/heure obligatoire, notification tech
   │
   ▼
[Backend]
   - Annulation : status='annulée', cancellation_reason
   - Report : status='reportée' sur l'originale, création d'une nouvelle 'planifiée'
   - Notification : SMS au client en Phase 2, email Phase 1
```

### 4.7 Export iCal pour le technicien

```
[Page Équipe → Fiche tech → onglet "Planning"]
   - Bouton "🔗 Lien iCal"
   │
   ▼
[Modal : Synchroniser avec votre calendrier]
   - URL iCal personnelle (privée, signée HMAC) :
       https://app.lms.fr/ical/u/abcd1234.ics
   - Boutons :
       [ Copier le lien ]
       [ Ouvrir dans Google Calendar ] (deep link)
       [ Ouvrir dans Outlook ]
       [ Télécharger un .ics ponctuel ]
   - Notice : "Ce lien donne accès en lecture à votre planning. Ne le partagez pas."
   - Bouton "Régénérer le lien" (en cas de fuite)
```

---

## 5. Écrans détaillés

### 5.1 Page Planning — Vue Semaine (par défaut)

**URL** : `/planning?view=week&date=2026-05-04`

**Layout** :

```
┌────────────────────────────────────────────────────────────────────┐
│ 📅 Planning — Semaine du 4 au 8 mai 2026         [< sem][>] [Auj] │
│ Filtres : [Toutes agences ▼] [Tous métiers ▼]    [Vue: Semaine ▼] │
├────────────────────────────────────────────────────────────────────┤
│             │ Lun 4    │ Mar 5    │ Mer 6    │ Jeu 7    │ Ven 8   │
├─────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ 🔧 P. Durand │ ┌────┐   │          │ ┌──────┐ │ ┌────┐   │         │
│ Plomberie   │ │ ◉  │   │          │ │      │ │ │ ▶  │   │         │
│ MTP · 87%   │ │... │   │          │ │  ◉   │ │ └────┘   │         │
│             │ └────┘   │          │ └──────┘ │          │         │
├─────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ ⚡ M. Leroy  │          │ ┌────┐   │          │          │ ┌────┐  │
│ Élec        │          │ │ ◉  │   │          │          │ │... │  │
│ MTP · 45%   │          │ └────┘   │          │          │ └────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Header** :
- Titre + intervalle date.
- Boutons navigation : ← (semaine précédente), → (suivante), "Aujourd'hui" (recentre).
- Filtres :
  - Agence (multi-select).
  - Métier (multi-select).
  - Statut (toggle "Inclure annulées").
  - Recherche (filtre par tech, client, lieu).
- Toggle vue : Semaine / Jour / Tech / Mois.
- Bouton "+ Nouvelle intervention".
- Bouton "🔗 Liens iCal" (gestion des liens par tech).

**Tableau** :
- 1ère colonne : techniciens (avatar + nom + métier + agence + charge en %).
- Colonnes suivantes : 5 jours ouvrables (lun-ven) ou 7 jours selon paramètre.
- Tri techniciens : par agence puis nom (paramétrable : par charge croissante / décroissante).
- Cellules :
  - Plage horaire 7h-19h par défaut (paramétrable).
  - Grille au quart d'heure (15 min).
  - Header de cellule = jour + date.
- Événements (interventions) :
  - Bloc coloré selon type (cf. tableau 2.3).
  - Bordure colorée selon statut :
    - `planifiée` : bordure pleine de la couleur du type.
    - `en_cours` : bordure pulsante + fond légèrement saturé.
    - `terminée` : grisée + ✓.
    - `annulée` : barrée + opacité 50%.
    - `reportée` : pointillés.
  - Contenu visible : heure début + titre court + référence chantier.
  - Au survol : tooltip avec détails complets (client, lieu, tech, durée prévue/réelle, contact).
  - Clic : ouvre la fiche intervention (panneau latéral).
  - Drag : déplace l'intervention (si permission).
  - Resize handle bottom : modifie la durée.

**Indicateurs visuels par cellule** :
- Charge < 70% : fond vert clair en arrière-plan.
- Charge 70-100% : fond orange clair.
- Charge > 100% (sur-chargé) : fond rouge clair + warning ⚠️.

**Légende** (en bas) :
- Types d'intervention avec couleurs.
- Statuts.

**Empty state** : "Aucune intervention cette semaine. [Planifier]"

### 5.2 Vue Jour

**URL** : `/planning?view=day&date=2026-05-06`

**Layout** :
- Colonnes : 1 par technicien actif ce jour.
- Lignes : 1 par tranche de 30 min (ou 15 min selon zoom).
- Plus de détail visible : titre complet, client, lieu, durée chiffrée.
- Mode "agenda" : timeline verticale plus lisible pour la journée.

### 5.3 Vue Tech individuel

**URL** : `/planning?view=tech&technician_id=...&date=2026-05-04`

**Layout** :
- 1 tech sélectionné.
- Vue calendrier mensuelle traditionnelle (5-6 lignes × 7 colonnes).
- Pour chaque jour : pastilles colorées par intervention (max 3 visibles + "+2" si plus).
- Clic sur jour → vue détaillée du jour.
- Cards stats à droite :
  - Heures travaillées ce mois.
  - Nb interventions ce mois.
  - Taux complétion.
  - Charge moyenne.

### 5.4 Vue Mois (vue d'ensemble)

**URL** : `/planning?view=month&date=2026-05`

**Layout** :
- Calendrier mensuel.
- Pour chaque jour : nombre total d'interventions tous techs confondus, code couleur selon charge globale.
- Bandeau d'urgences en haut (urgences planifiées dans le mois).
- Vue très macro pour le gérant.

### 5.5 Fiche intervention (panneau latéral)

**Layout** : largeur 500 px, slide-in droite.

**Header** :
- Titre auto + référence chantier.
- Statut (badge coloré).
- Boutons :
  - "▶ Démarrer" (si planifiée).
  - "✓ Terminer" (si en cours).
  - "📅 Reporter".
  - "⊘ Annuler".
  - "✏️ Modifier".
  - "✕ Fermer".

**Sections** :
- **Détails** : type, durée, date/heure, tech assigné.
- **Chantier lié** : référence + titre + client + lieu (cliquable, ouvre fiche chantier).
- **Adresse** : récupérée du lieu ou du chantier, mini-carte, bouton "Itinéraire".
- **Locataire** : nom + tel cliquable.
- **Notes pour le tech** : éditable.
- **Compte-rendu** : éditable (apparaît après "terminée").
- **Documents** : liste des photos / docs liés à cette intervention spécifique.
- **Historique** : timeline des changements (créée, modifiée, démarrée, terminée).

### 5.6 Modal "Nouvelle intervention" (depuis chantier ou planning)

Cf. parcours 4.1 et 4.2.

**Particularité depuis le planning** :
- Si drag d'une plage horaire : pré-remplissage tech + date + heure + durée.
- Champ "Chantier" devient obligatoire avec autocomplete.

### 5.7 Modal "Démarrer / Terminer une intervention"

Cf. parcours 4.4 et 4.5.

### 5.8 Modal "Conflit horaire détecté"

```
⚠️ Conflit horaire détecté

Pierre Durand a déjà une intervention dans ce créneau :

┌─────────────────────────────────────────────┐
│ 🛠️ Réparation — 06/05/2026 14h00 à 16h00   │
│ Foncia Sud — Résidence Les Oliviers Apt 12 │
│ Statut : Planifiée                          │
└─────────────────────────────────────────────┘

Votre nouvelle intervention :
🔍 Diagnostic — 06/05/2026 15h00 à 16h30
Chevauchement : 1h00

Que voulez-vous faire ?

[ Annuler ] [ Voir le détail ] [ Planifier quand même ]
```

### 5.9 Modal "Synchroniser iCal"

Cf. parcours 4.7.

---

## 6. Détection des conflits et alertes

### 6.1 Types de conflits

| Conflit | Détection | Sévérité |
|---|---|---|
| **Chevauchement** | 2 interventions du même tech sur des plages temporelles qui se croisent | ⚠️ Avertissement |
| **Sur-cadrage** | 1 intervention plus longue que la durée disponible avant la suivante | ⚠️ Avertissement |
| **Surcharge** | > 9h cumulées dans la journée pour un tech | ⚠️ Avertissement |
| **Déplacement irréaliste** | Distance entre 2 interventions > distance possible dans le créneau libre | 💡 Information |
| **Hors horaires** | Intervention en dehors des horaires de travail définis (ex : 7h-19h) | 💡 Information |
| **Tech indisponible** | Intervention pendant un congé / arrêt déclaré | 🚫 Bloquant |
| **Tech inactif** | Tech désactivé | 🚫 Bloquant |

### 6.2 Comportements

- **⚠️ Avertissement** : modal avec détails, possibilité de planifier "quand même".
- **💡 Information** : toast informatif non bloquant.
- **🚫 Bloquant** : refus de création / déplacement avec message d'erreur.

### 6.3 Heures de travail

Configurables par technicien dans sa fiche :
- Plages horaires par jour de la semaine.
- Pause déjeuner.
- Indisponibilités ponctuelles (vacances, formations, arrêts maladie).

Stocké dans `technicians.work_schedule` (JSONB) :
```json
{
  "monday":    { "start": "08:00", "end": "12:00", "afternoon_start": "13:30", "afternoon_end": "17:30" },
  "tuesday":   { ... },
  "wednesday": { ... },
  "thursday":  { ... },
  "friday":    { ... },
  "saturday":  null,
  "sunday":    null
}
```

Et `technicians.unavailabilities` (table séparée) pour les exceptions ponctuelles.

---

## 7. Géolocalisation et optimisation tournée

### 7.1 Distance entre interventions

Pour un tech avec plusieurs interventions le même jour, l'app calcule :
- Distance routière entre lieux successifs (via OpenRouteService gratuit ou Google Distance Matrix).
- Durée estimée du trajet.
- Affichée entre les événements dans la vue jour.

### 7.2 Suggestion de réordonnancement

```
[Vue jour pour Pierre Durand — 06/05]
   │
   ▼
[Bouton "🚗 Optimiser la tournée"]
   │
   ▼
[Modal : Suggestion d'optimisation]
   Tournée actuelle :
     08:30 → 10:00  Foncia Les Oliviers (Castelnau)        12 km / 18 min
     10:00 → 11:30  Foncia La Paillade (Montpellier)       15 km / 22 min
     14:00 → 16:00  Foncia Le Parc (Lattes)                10 km / 15 min
     16:00 → 17:00  Foncia La Méditerranée (Pérols)
     Total : 47 km, 1h30 de route
     
   Suggestion optimisée :
     08:30 → 10:00  Foncia La Paillade (Montpellier)
     10:00 → 11:30  Foncia Les Oliviers (Castelnau)        4 km / 8 min
     14:00 → 16:00  Foncia Le Parc (Lattes)                7 km / 12 min
     16:00 → 17:00  Foncia La Méditerranée (Pérols)
     Total : 23 km, 50 min de route
     
   Économie : 24 km / 40 min
   
   [ Annuler ] [ Appliquer la suggestion ]
```

### 7.3 Itinéraire (Phase 1 desktop)

Bouton "🗺️ Itinéraire" sur fiche intervention → ouvre Google Maps / Apple Maps avec coordonnées.

### 7.4 Phase 2 mobile
- GPS automatique pour `arrived_at`.
- Navigation turn-by-turn intégrée.
- Notifications "Vous êtes à 5 min de votre prochain RDV".
- Tracking position pour assistance dispatch.

---

## 8. Export iCal

### 8.1 URL personnelle
- Format : `https://app.lms.fr/ical/u/{ical_token}.ics`
- `ical_token` : 32 chars random, stocké dans `users.ical_token`, régénérable.
- Lecture seule (les calendriers externes pourraient théoriquement écrire mais on ignore).

### 8.2 Contenu .ics
Pour chaque intervention `planifiée` ou `en_cours` du tech connecté :
```
BEGIN:VEVENT
UID:intervention-{uuid}@lms.fr
DTSTAMP:20260506T120000Z
DTSTART:20260506T140000Z
DTEND:20260506T160000Z
SUMMARY:🛠️ Foncia — Les Oliviers Apt 12 — Réparation plomberie
DESCRIPTION:Locataire : Mme Dupont (06 12 34 56 78)\n
            Code accès : 1234A\n
            Notes : Fuite radiateur, prévoir clé Allen 6\n
            Voir : https://app.lms.fr/i/{intervention_id}
LOCATION:Résidence Les Oliviers, 1 rue des Oliviers, 34170 Castelnau-le-Lez
URL:https://app.lms.fr/i/{intervention_id}
STATUS:CONFIRMED
END:VEVENT
```

### 8.3 Cache et fraîcheur
- Cache HTTP 5 min.
- Headers `ETag` + `If-None-Match` pour bandwidth.
- Google Calendar refresh toutes les ~24h (limite Google), pas de solution pour accélérer.
- Pour MAJ rapide : envoi email "Votre planning a changé" avec lien direct.

### 8.4 Sécurité
- Token unique par tech, non devinable.
- Régénération possible (invalide l'ancien).
- Logs d'accès au .ics (IP, user-agent) pour détecter fuites.

---

## 9. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir planning global | ✅ | ✅ ses agences | ✅ tous | ❌ | ✅ tous (lecture) |
| Voir son planning | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer intervention | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Modifier intervention | ✅ | ✅ ses agences | ❌ | ✅ ses interventions (limité) | ❌ |
| Drag & drop dans planning | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Démarrer (status → en_cours) | ✅ | ✅ | ❌ | ✅ ses interv. | ❌ |
| Terminer | ✅ | ✅ | ❌ | ✅ ses interv. | ❌ |
| Reporter | ✅ | ✅ | ❌ | ❌ | ❌ |
| Annuler | ✅ | ✅ ses agences | ❌ | ❌ (peut signaler à admin) | ❌ |
| Modifier intervention `terminée` | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Optimiser tournée | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configurer horaires tech | ✅ | ✅ ses agences | ❌ | ❌ (lecture seule) | ❌ |
| Régénérer son token iCal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir token iCal d'un autre | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 10. Workflows clés

### 10.1 Auto-création d'intervention à la création de chantier

À la création d'un chantier avec :
- `scheduled_date` renseignée
- `assigned_technician_id` renseigné

→ Proposition automatique de créer une intervention "diagnostic" ou "réparation" à cette date.
Si checkbox "Planifier l'intervention maintenant" cochée : création automatique.

### 10.2 Notifications automatiques

| Événement | Destinataire | Canal | Délai |
|---|---|---|---|
| Création intervention | Tech assigné | Email + push (Phase 2) | Immédiat |
| Modification d'horaire | Tech assigné | Email + push | Immédiat |
| Annulation | Tech assigné | Email + push | Immédiat |
| Rappel J-1 | Tech assigné | Email | 18h la veille |
| Rappel H-1 | Tech assigné | Push (Phase 2) | 1h avant |
| Démarrage | Admin agence | In-app | Immédiat |
| Clôture | Admin agence + comptable | In-app | Immédiat |
| Échéance dépassée (intervention non démarrée) | Tech + admin | Email | 30 min après scheduled_at |

### 10.3 Reprogrammation après absence

Si un tech déclare une indisponibilité (vacances, arrêt) qui couvre des interventions déjà planifiées :
- Modal d'avertissement listant les interventions impactées.
- Choix : reporter manuellement / réassigner à un autre tech / laisser tel quel (à gérer plus tard).

### 10.4 Détection retard

Si une intervention `en_cours` n'a pas été passée en `terminée` après 3× sa durée prévue :
- Notification au tech : "Votre intervention chez X est-elle toujours en cours ? Pensez à la clôturer."
- Notification admin si toujours pas clôturée après 6× la durée.

---

## 11. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Intervention créée sur un chantier archivé | Bloqué : "Ce chantier est archivé. Désarchivez-le ou choisissez-en un autre." |
| Intervention sur tech inactif | Bloqué : "Ce technicien est inactif." |
| Drag d'intervention `terminée` | Confirmation forte : "Cette intervention est marquée terminée. Êtes-vous sûr ?" |
| Heure de fin antérieure à heure de début (saisie manuelle) | Validation : "L'heure de fin doit être après l'heure de début." |
| Durée prévue > 12h | Avertissement : "Durée inhabituellement longue. Confirmer ?" |
| 2 interventions exactement au même créneau pour le même tech | Bloqué (chevauchement parfait), sauf si admin force avec confirmation |
| Suppression d'un chantier avec interventions futures | Modal : "Ce chantier a 3 interventions planifiées. Les annuler ?" |
| Modification d'horaire après notification au tech | Nouvelle notification "Votre intervention a été déplacée" |
| iCal téléchargé avec mauvais token | 404 |
| Tech qui change d'agence | Interventions futures : reste assignées au tech, juste l'agence change |
| Réseau lent au démarrage d'intervention | Optimistic UI, sync au retour ; statut local "synchronisation en cours" |
| Tentative de créer intervention dans le passé | Avertissement : "Cette date est passée. Continuer ?" (utile pour saisir des interventions a posteriori) |

---

## 12. Critères d'acceptation

### 12.1 Création / modification
- ✅ Intervention créée avec tous les champs obligatoires fonctionne.
- ✅ Détection conflit affiche un modal avec détails.
- ✅ Drag dans planning crée / déplace l'intervention.
- ✅ Resize de l'événement modifie `duration_minutes`.
- ✅ Notification au tech assigné dans les 30 secondes.

### 12.2 Statuts
- ✅ Transitions de statut respectent les règles (pas de retour arbitraire).
- ✅ `arrived_at` saisi à `en_cours`.
- ✅ `completed_at` saisi à `terminée`.
- ✅ `actual_duration_minutes` calculé automatiquement.
- ✅ Annulation : raison obligatoire, notification client.

### 12.3 Conflits
- ✅ Chevauchement détecté correctement.
- ✅ Surcharge journalière calculée (somme des durées).
- ✅ Distances calculées via API tierce.
- ✅ Tech indisponible bloque la création.

### 12.4 Vues planning
- ✅ Vue Semaine charge en < 1s pour 50 interventions.
- ✅ Vue Jour zoom OK 15 min / 30 min / 1h.
- ✅ Vue Tech individuel affiche stats.
- ✅ Filtres se combinent.
- ✅ État de la vue dans l'URL.

### 12.5 iCal
- ✅ URL .ics génère un fichier valide (testé Google Calendar, Outlook, Apple).
- ✅ Token unique par tech, régénérable.
- ✅ Cache HTTP fonctionne.
- ✅ Description contient lien direct app.

### 12.6 Optimisation tournée
- ✅ Suggestion calculée correctement.
- ✅ Application réordonne les interventions atomiquement.
- ✅ Notifications envoyées si horaires modifiés.

### 12.7 Permissions et RLS
- ✅ Un tech ne voit que ses interventions.
- ✅ Un admin de Perpignan ne voit pas le planning Montpellier.
- ✅ Token iCal d'un tech inaccessible aux autres.

### 12.8 Performance
- ✅ Vue Semaine 50 interv : < 1s.
- ✅ Vue Mois 200 interv : < 1.5s.
- ✅ Drag fluide à 60fps.
- ✅ Realtime update : < 1s.

---

## 13. Métriques à suivre (PostHog)

### 13.1 Événements
- `intervention.created` (props: type, duration, source=fiche_chantier|planning|urgent)
- `intervention.modified`
- `intervention.dragged_planning` (props: from_tech, to_tech, time_diff_minutes)
- `intervention.started` (props: minutes_late_or_early)
- `intervention.completed` (props: actual_vs_planned_duration_pct)
- `intervention.cancelled` (props: reason)
- `intervention.reported` (props: days_diff)
- `planning.view_changed` (props: view_type)
- `planning.optimization_proposed`
- `planning.optimization_applied` (props: km_saved, minutes_saved)
- `planning.conflict_detected` (props: conflict_type)
- `planning.conflict_overridden`
- `ical.token_generated`
- `ical.fetched` (props: tech_id, hits_per_day)

### 13.2 KPIs
- Taux de respect des horaires planifiés (intervention démarrée à ±15 min) — objectif > 80 %.
- Taux d'utilisation de l'optimisation tournée — objectif adoption > 30 %.
- Économie moyenne km/jour grâce à l'optimisation.
- Taux d'interventions modifiées après création (KPI qualité planning).
- Taux d'adoption iCal (techs ayant configuré la synchro) — objectif > 50 %.
- Délai moyen "création intervention → notification tech reçue".

---

## 14. Points ouverts à arbitrer plus tard

- **Multi-techs sur une intervention** : pour les gros chantiers à plusieurs (Phase 3).
- **Sous-traitance ponctuelle** : assigner une intervention à un sous-traitant externe (Phase 3).
- **Optimisation tournée multi-techs** : algorithme de routing global avec Cluster + 2-opt (Phase 4).
- **Intégration Google Calendar bidirectionnelle** : créer dans LMS sync vers Google, et inversement (Phase 4).
- **Notification client J-1 / H-1** : SMS automatique au locataire (Phase 2 mobile + SMS).
- **Tracking GPS continu** : voir où sont les techs en temps réel sur une carte (Phase 3, RGPD à valider avec eux).
- **Templates de plages récurrentes** : visite annuelle, contrôle trimestriel (Phase 4).
- **Suggestion d'assignation par IA** : "Pierre est le mieux placé pour cette intervention car habilité B1V et proche" (Phase 4).
- **Métriques de productivité avancées** : ratio heures facturables, taux d'utilisation (Phase 3).

---

*Fin de la spec module 05 — Interventions & Planning.*
*Prochaine spec : 06-devis.md (édition lignes, calcul TVA, conditions, génération PDF, conversion devis → BC → facture).*
