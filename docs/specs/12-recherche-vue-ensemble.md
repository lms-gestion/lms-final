# Spec produit — Module 12 : Recherche & Vue d'ensemble produit

**Version** : 1.0
**Statut** : Module chapeau, à implémenter incrémentalement (Sprint 1 fondations dashboard, Sprint 14 recherche globale et monitoring)
**Dépendances** : Tous les modules métier
**Sprints concernés** : 1, 14 (incrémental)

---

## 1. Objectif du module

Module **chapeau** qui constitue le point d'entrée quotidien des utilisateurs et la couche de synthèse au-dessus des modules métier. Il ne crée pas de nouvelle entité ; il agrège, recherche et présente.

Le module couvre :

- la **recherche globale Ctrl+K / Cmd+K** : palette de commandes universelle pour trouver instantanément un chantier, un client, une facture, un technicien, un document, ou exécuter une action rapide.
- le **dashboard d'accueil** : vue synthétique adaptée au rôle de l'utilisateur (gérant, admin, comptable, technicien, viewer).
- le **monitoring temps réel** : qui fait quoi, où, en ce moment.
- la **vue d'ensemble produit** : KPIs, activité récente, alertes, prochaines actions.
- les **quick actions** : raccourcis vers les actions les plus fréquentes (créer chantier urgent, saisir paiement, planifier intervention).
- l'**activity feed** : flux chronologique des événements importants (filtré selon rôle).
- les **vues spécialisées** par persona.

**Hors périmètre du module** :
- Création / édition d'entités (faits dans modules dédiés).
- Reporting avancé, BI (Phase 4).
- Tableaux de bord paramétrables par utilisateur (Phase 4).
- Carte interactive plein écran (Phase 4 — vue Carte du module 04 suffit Phase 1).

---

## 2. Architecture

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│  Niveau 1 : Page d'accueil (/dashboard)             │
│  Vue synthétique du rôle, mise à jour temps réel    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Niveau 2 : Recherche globale (Ctrl+K)              │
│  Accessible depuis toute l'app, instantanée         │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  Niveau 3 : Vues spécialisées                       │
│  /monitoring, /activity, /reports                   │
└─────────────────────────────────────────────────────┘
```

### 2.2 Stack technique

| Composant | Choix | Notes |
|---|---|---|
| Recherche full-text | Postgres `tsvector` + GIN index | Suffit jusqu'à 100k entités |
| Realtime updates | Supabase Realtime channels | Cards stats temps réel |
| Charts | Recharts (déjà dans React) | Simple, suffisant Phase 1 |
| Cartes (heatmap) | MapLibre | Réutilisé du module 04 |
| Command palette | `cmdk` (lib React, par Vercel) | Standard de fait |
| Cache requêtes | TanStack Query | Cohérent avec le reste de l'app |

---

## 3. Personas concernés

| Persona | Dashboard adapté |
|---|---|
| **Gérant (owner)** | Vue 360° globale : CA, encours, charge équipe, urgences, alertes critiques |
| **Chef d'agence (admin)** | Focus opérationnel sur ses agences : kanban résumé, planning du jour, urgences à dispatcher |
| **Comptable (accountant)** | Focus financier : factures émises, à émettre, à relancer, encours par âge |
| **Technicien (technician)** | Focus terrain : ses interventions du jour, ses chantiers actifs, prochaine étape |
| **Lecture seule (viewer)** | Synthèse audit : vue lecture des KPIs principaux |

Chaque rôle a un dashboard **différent**, pas juste une variation. C'est le bon endroit pour montrer aux utilisateurs ce qui leur sert vraiment.

---

## 4. Recherche globale (Ctrl+K)

### 4.1 Activation

- Raccourci clavier **Ctrl+K** (Windows/Linux) ou **Cmd+K** (Mac), affiché dans l'UI à côté du champ de recherche du header.
- Bouton "🔍" dans la topbar, accessible mobile.
- Toujours disponible, sur toutes les pages.

### 4.2 Modal command palette

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Rechercher ou exécuter une action...             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚡ ACTIONS RAPIDES                                  │
│   🚨 Créer un chantier d'urgence            ⌘⇧U    │
│   🏗️ Nouveau chantier                       ⌘N    │
│   👥 Nouveau client                                  │
│   📄 Nouveau devis                                   │
│   💶 Nouvelle facture                                │
│                                                     │
│  RÉSULTATS RÉCENTS                                  │
│   🏗️ CH-2026-0042 — Foncia Les Oliviers Apt 12     │
│   👤 Foncia Sud Méditerranée                        │
│   💶 FAC-2026-0028 — Foncia — 1 240,80 €           │
│   📍 Résidence Les Oliviers                         │
│                                                     │
│ Tapez "?" pour les raccourcis                       │
└─────────────────────────────────────────────────────┘
```

### 4.3 Modes de recherche

**Recherche libre** (par défaut) : full-text sur toutes les entités.

**Recherche typée** : préfixes pour cibler :
- `c:` clients (`c:foncia` → clients dont le nom contient "foncia")
- `ch:` chantiers (`ch:CH-2026-0042` ou `ch:fuite radiateur`)
- `f:` factures (`f:2026-0028`)
- `d:` devis
- `t:` techniciens
- `l:` lieux d'intervention
- `b:` bons d'intervention

**Recherche par référence directe** : taper "FAC-2026-0028" trouve directement la facture.

**Actions** : taper le nom d'une action ("nouveau chantier", "exporter factures") pour l'exécuter.

### 4.4 Comportements

- **Debounce** 100 ms côté client.
- **Highlighting** : termes recherchés surlignés dans les résultats.
- **Navigation clavier** : flèches haut/bas pour naviguer, Entrée pour ouvrir, Tab pour préview.
- **Préview rapide** : panel à droite avec aperçu de l'entité sélectionnée (sans quitter le modal).
- **Historique** : dernières recherches en haut quand le champ est vide.
- **Suggestions** : actions contextuelles selon la page courante (ex : si on est sur un chantier, "Planifier une intervention" remonte).

### 4.5 Backend de recherche

**Postgres tsvector** sur tables clés :
```sql
-- Exemple chantiers
ALTER TABLE chantiers ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french',
      coalesce(reference, '') || ' ' ||
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(supplier_reference, '')
    )
  ) STORED;

CREATE INDEX idx_chantiers_search ON chantiers USING GIN(search_vector);

-- Recherche
SELECT * FROM chantiers
WHERE search_vector @@ plainto_tsquery('french', $1)
ORDER BY ts_rank(search_vector, plainto_tsquery('french', $1)) DESC
LIMIT 10;
```

**Index séparé par entité** (chantiers, clients, factures, devis, techniciens, lieux, fournisseurs, BI).

**Endpoint unifié** : `GET /api/search?q={query}&type={optional}` qui retourne agrégat de toutes les sources.

**RLS appliquée** : seuls les résultats accessibles à l'utilisateur courant remontent.

---

## 5. Dashboard d'accueil

### 5.1 Layout général

**URL** : `/` ou `/dashboard`

**Layout** : 12 colonnes responsive, cards modulaires.

**Header** :
- Salutation : "Bonjour [Prénom]" + date du jour.
- Météo opérationnelle : indicateur global de santé ("✅ Tout va bien" / "⚠️ 3 urgences à dispatcher" / "🔴 Action requise").
- Quick actions (boutons selon rôle).

**Body** : grille de cards adaptées au rôle (cf. §5.2 à §5.6).

**Footer** : activity feed (14 derniers événements pertinents).

### 5.2 Dashboard Gérant (owner)

**Cards stats principales** (4 colonnes, 1ère rangée) :
- **CA mensuel** : montant + comparaison N-1 (flèche tendance).
- **Encours impayé** : montant + nb factures en retard.
- **Chantiers actifs** : compteur + répartition par statut.
- **Charge équipe** : % global + indicateur saturé/disponible.

**Cards opérationnelles** (2ème rangée) :
- **Urgences** : liste des chantiers urgence non assignés ou en cours.
- **Échéances proches** : factures et chantiers avec deadline < 7j.
- **Top 5 clients** : par CA mensuel.
- **Charge par agence** : barres horizontales.

**Cards stratégiques** (3ème rangée) :
- **CA 12 mois** : graphique courbe avec comparaison N-1.
- **Pipeline** : devis envoyés → acceptés → facturés (funnel).
- **Mauvais payeurs** : top 5 avec retard moyen.
- **Productivité techniciens** : interventions/jour moyen, % complétion.

### 5.3 Dashboard Chef d'agence (admin)

**Cards stats** :
- **Chantiers actifs (ses agences)**.
- **Interventions du jour**.
- **Urgences à dispatcher** (rouge si > 0).
- **Devis en attente d'acceptation**.

**Cards opérationnelles** :
- **Kanban résumé** : compteurs par colonne, lien vers la vue complète.
- **Planning du jour** : timeline des techs avec leurs interventions.
- **Échéances** : chantiers avec deadline proche, devis qui expirent.
- **Activité récente** : créations / modifications / changements statut des dernières 24h.

**Cards spécifiques** :
- **Carte des chantiers en cours** (mini-carte MapLibre).
- **Notifs urgentes**.

### 5.4 Dashboard Comptable (accountant)

**Cards stats** :
- **CA émis ce mois**.
- **Encaissé ce mois**.
- **Encours impayé** (avec répartition par âge : <30j / 30-60j / >60j).
- **DSO** (Days Sales Outstanding).

**Cards opérationnelles** :
- **À émettre** : devis acceptés non encore facturés.
- **À relancer** : factures en retard, niveau de relance proposé.
- **Paiements à saisir** : virements détectés (Phase 4 si rapprochement bancaire) ou rappels manuels.
- **Top mauvais payeurs**.

**Cards spécifiques** :
- **Calendrier échéances** : vue mensuelle des due_dates.
- **Export rapide** : boutons FEC, Sage, EBP pour le mois en cours.

### 5.5 Dashboard Technicien (technician)

**Card principale** :
- **Mon prochain RDV** : grand bloc visible avec :
  - Heure d'arrivée prévue.
  - Client + lieu.
  - Adresse + bouton "Itinéraire".
  - Téléphone locataire.
  - Code d'accès.
  - Notes pour le tech.
  - Bouton "▶ Démarrer l'intervention" (Phase 1 : depuis bureau ; Phase 2 : depuis mobile sur le terrain).

**Cards opérationnelles** :
- **Mes interventions du jour** : timeline avec statuts.
- **Mes chantiers actifs** : kanban filtré.
- **Mes BI à finaliser** (en attente de signature).
- **Ma semaine** : vue planning compactée 5 jours.

**Pas de stats financières** (visibilité limitée).

### 5.6 Dashboard Lecture seule (viewer)

Vue synthétique sans données sensibles :
- Compteurs globaux (chantiers, clients, techs).
- Graphique d'activité.
- Pas de noms / contacts / montants détaillés.
- Pas d'actions.

---

## 6. Monitoring temps réel

### 6.1 Page Monitoring

**URL** : `/monitoring`

**Accessible à** : owner, admin, accountant, viewer.

**Layout** : 3 colonnes principales mises à jour en temps réel via Supabase Realtime.

**Colonne 1 — Techniciens en activité**
Pour chaque tech actif aujourd'hui :
- Avatar + nom.
- Statut courant : "🚗 En route", "🏗️ En intervention", "⏸ Pause", "✅ Disponible".
- Lieu actuel (Phase 1 : déduit du dernier statut intervention ; Phase 2 : géoloc temps réel).
- Prochaine étape (intervention suivante).
- Charge journée (barre).

**Colonne 2 — Chantiers en cours**
Liste des chantiers avec status='en_cours' :
- Référence + client + lieu.
- Tech assigné.
- Heure de début.
- Durée écoulée.
- Estimation fin.

**Colonne 3 — Urgences**
Chantiers et interventions en priorité urgence :
- Chip rouge animé.
- Référence + client.
- Statut (assigné ou non).
- Tech assigné si oui.
- Temps écoulé depuis création.
- Bouton "Voir" → fiche.
- Compteur d'escalade en haut (X urgences depuis 30 min, Y depuis 1h).

### 6.2 Mise à jour temps réel

- Supabase Realtime channels : `monitoring:org_{id}`.
- Events écoutés : tout changement sur `chantiers`, `interventions`, `technicians.status`.
- Animations subtiles à chaque changement (pulse).
- Son discret (paramétrable) à l'arrivée d'une urgence.

### 6.3 Carte temps réel (Phase 2)

Phase 2 mobile : ajout d'une carte plein écran avec position GPS des techs.
Phase 1 : carte des lieux d'intervention en cours uniquement.

---

## 7. Activity feed

### 7.1 Implémentation

Source : `activity_logs` filtrés selon rôle.

Affichage chronologique inversé, max 50 éléments en page principale, lazy load.

Format de chaque entry :
- Avatar de l'auteur.
- Action en langage naturel : "Marie Leroy a terminé l'intervention du chantier CH-2026-0042 (Foncia Les Oliviers)".
- Date relative.
- Lien cliquable vers l'entité.
- Icône type d'action.

### 7.2 Filtres

- Par type d'action.
- Par utilisateur.
- Par entité.
- Par période.

### 7.3 Page complète

**URL** : `/activity`

Tableau dense, recherche, filtres avancés, export.

---

## 8. Quick actions

### 8.1 Header / Sidebar

Boutons d'accès rapide selon rôle :
- 🚨 Créer urgence (admin, owner).
- 🏗️ Nouveau chantier (admin, owner, accountant).
- ▶ Démarrer mon prochain RDV (technician).
- 💳 Saisir paiement (accountant).

### 8.2 Floating action button (mobile)

FAB orange en bas à droite avec menu contextuel selon page :
- Sur Kanban : "+ Chantier".
- Sur Planning : "+ Intervention".
- Sur Factures : "+ Facture".
- Sur Devis : "+ Devis".

### 8.3 Raccourcis clavier globaux

| Raccourci | Action |
|---|---|
| `Ctrl/Cmd + K` | Ouvrir command palette |
| `Ctrl/Cmd + N` | Nouveau (selon page courante) |
| `Ctrl/Cmd + Shift + U` | Créer urgence |
| `Ctrl/Cmd + /` | Aide raccourcis |
| `g` puis `c` | Aller à Chantiers |
| `g` puis `d` | Aller au Dashboard |
| `g` puis `f` | Aller à Factures |
| `g` puis `p` | Aller au Planning |
| `Esc` | Fermer modal / panneau |

---

## 9. Écrans détaillés

### 9.1 Page Dashboard

Cf. §5 pour le layout par rôle.

**Caractéristiques communes** :
- Cards modulaires, drag & drop pour réorganiser (préférences user, Phase 4).
- Toutes les cards ont un état "loading skeleton" puis le contenu.
- Mise à jour temps réel des compteurs.
- Bouton "Personnaliser" en haut à droite (Phase 4).

### 9.2 Modal Command palette

Cf. §4.

**Composant** : `cmdk` (https://cmdk.paco.me/), customisé avec branding LMS.

### 9.3 Page Monitoring

Cf. §6.

### 9.4 Page Activity feed

Cf. §7.3.

### 9.5 Page Reports (Phase 4 placeholder)

URL `/reports` : page placeholder Phase 1, à enrichir Phase 4 avec rapports paramétrables.

---

## 10. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir dashboard | ✅ vue gérant | ✅ vue admin | ✅ vue compta | ✅ vue tech | ✅ vue limitée |
| Voir monitoring | ✅ tous | ✅ ses agences | ✅ tous | ❌ | ✅ tous (limité) |
| Voir activity feed | ✅ tous | ✅ ses agences | ✅ tous | ✅ ses actions | ✅ tous (limité) |
| Recherche globale | ✅ tous | ✅ ses agences | ✅ tous | ✅ ses chantiers | ✅ limité |
| Quick actions disponibles | toutes | sauf paramètres globaux | factures et paiements | interventions et BI | aucune |

---

## 11. Workflows clés

### 11.1 Adaptation dashboard au rôle

À la connexion, le serveur détermine le rôle et envoie le layout JSON adéquat. Le frontend rend les cards correspondantes.

Phase 4 : possibilité pour l'utilisateur de personnaliser son dashboard (drag, hide, ajouter des cards).

### 11.2 Météo opérationnelle

Indicateur en haut du dashboard, calculé en temps réel :

```
- 0 urgences non assignées : "✅ Tout va bien" (vert)
- 1-2 urgences : "⚠️ 2 urgences à dispatcher" (orange)
- > 2 urgences ou facture critique > 30j : "🔴 Action requise" (rouge)
```

Click sur la météo → ouvre la liste des éléments à traiter.

### 11.3 Cache et performance

- Toutes les KPI cards en cache 60 sec côté client (TanStack Query).
- Recalcul forcé au focus de l'onglet.
- Mise à jour temps réel via Realtime pour les modifications visibles.
- Skeleton loading sur premier chargement.

### 11.4 Indexation pour la recherche

- Index GIN sur tsvector pour chaque table principale.
- Refresh automatique des vecteurs à chaque update (déclencheur GENERATED ALWAYS AS).
- Maintenance VACUUM hebdomadaire.

---

## 12. États d'erreur et edge cases

| Cas | Comportement |
|---|---|
| Aucune donnée (organisation vide) | Empty states avec CTAs guidés vers les premières actions |
| Recherche sans résultat | "Aucun résultat pour 'X'. Essayez une recherche différente." + suggestions actions |
| Realtime déconnecté | Bandeau subtil "Reconnexion..." + auto-retry |
| Card stats échec backend | Skeleton + message "Indisponible — réessayer" |
| Recherche très lente (> 2s) | Spinner + cancel automatique après 5s |
| Trop de résultats (>100) | "Affinez votre recherche pour voir plus de résultats" |
| Activity feed très volumineux | Pagination 50 par page |
| Dashboard sur écran mobile | Stack vertical, cards prennent toute la largeur |
| Permission insuffisante pour une card | Card masquée gracieusement (pas d'erreur visible) |

---

## 13. Critères d'acceptation

### 13.1 Recherche globale
- ✅ Ctrl+K / Cmd+K ouvre la palette partout.
- ✅ Recherche < 200 ms pour 50 000 entités.
- ✅ Préfixes typés (`c:`, `ch:`, `f:`, etc.) fonctionnent.
- ✅ Navigation clavier complète.
- ✅ Résultats respectent la RLS.

### 13.2 Dashboard
- ✅ Layout adapté au rôle.
- ✅ Cards en temps réel.
- ✅ Météo opérationnelle calculée correctement.
- ✅ Empty states présents.
- ✅ Mobile responsive.

### 13.3 Monitoring
- ✅ Mise à jour < 1s après changement.
- ✅ Animations fluides.
- ✅ Filtres par agence fonctionnent.
- ✅ Compteur urgences exact.

### 13.4 Activity feed
- ✅ Filtré selon rôle.
- ✅ Liens vers entités fonctionnent (404 gracieux si supprimé).
- ✅ Pagination sans saut.

### 13.5 Performance
- ✅ Dashboard charge < 1s sur connexion normale.
- ✅ Recherche < 200 ms.
- ✅ Realtime < 1s.

### 13.6 Permissions
- ✅ Cards masquées selon rôle.
- ✅ Recherche bloque cross-org.
- ✅ Monitoring respecte les agences accessibles.

---

## 14. Métriques (PostHog)

### 14.1 Événements
- `dashboard.viewed` (props: role, time_on_page_sec)
- `dashboard.card_clicked` (props: card_type)
- `search.opened` (props: source=keyboard|button|mobile)
- `search.query` (props: query_length, has_typed_prefix, results_count)
- `search.result_clicked` (props: result_type, position)
- `search.action_executed` (props: action)
- `monitoring.viewed`
- `activity.viewed`
- `quick_action.used` (props: action, source=fab|header|sidebar)
- `keyboard_shortcut.used` (props: shortcut)

### 14.2 KPIs
- Adoption command palette (objectif > 50 % des users actifs).
- Top 10 actions exécutées.
- Recherche zéro résultat (KPI qualité).
- Temps moyen avant first action après login.
- Taux de retour quotidien des techniciens.
- Taux d'usage du dashboard vs accès direct module.

---

## 15. Points ouverts à arbitrer plus tard

- **Dashboard personnalisable** : drag & drop des cards, ajout/suppression, sauvegarde par user — Phase 4.
- **Widgets tiers** : intégrer météo locale, trafic Google Maps, agenda Google — Phase 4.
- **Reports avancés** : générateur de rapports paramétrables — Phase 4.
- **AI insights** : "Ton CA Plomberie est en baisse de 12 %, voici pourquoi" — Phase 5.
- **Vue cartographique plein écran globale** — Phase 4.
- **Mode présentation TV** : dashboard plein écran pour mur d'agence — Phase 4.
- **Notifications de saisie incomplète** : "X chantiers terminés sans BI signé" — Phase 3.
- **Recherche sémantique IA** : "factures Foncia janvier" interprété sémantiquement — Phase 4.
- **Heatmap horaire** : à quelle heure les urgences arrivent typiquement — Phase 3.

---

*Fin de la spec module 12 — Recherche & Vue d'ensemble produit.*
*La spec produit Phase 1 est désormais complète.*
