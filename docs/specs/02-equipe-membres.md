# Spec produit — Module 02 : Équipe & Membres

**Version** : 1.0
**Statut** : À implémenter en Sprint 1-2 (membres) et Sprint 3-4 (techniciens, fournisseurs)
**Dépendances** : Module 01 (Auth & Onboarding)
**Sprints concernés** : Sprint 1, 2, 3, 4

---

## 1. Objectif du module

Gérer toutes les personnes liées à l'organisation, qu'elles aient un compte applicatif ou non. Le module distingue trois entités conceptuelles :

- **Membres** : utilisateurs ayant un compte LMS Gestion (accès à l'app, rôle, MFA).
- **Techniciens** : personnel de terrain (avec ou sans compte), assignable à des chantiers et interventions.
- **Fournisseurs** : entités externes (donneurs d'ordre type Foncia, fournisseurs de matériel).

Le module gère :
- la création / modification / désactivation des trois entités,
- l'attribution des rôles applicatifs aux membres,
- le lien optionnel technicien ↔ membre (un tech peut avoir un compte),
- la transmission des chantiers d'un tech à un autre (départ/remplacement),
- les statistiques d'activité (chantiers traités, charge planning).

**Hors périmètre du module** :
- Pointage horaire des techniciens (Phase 2 avec mobile).
- Calcul de paie / variable (Phase 3+).
- Synchronisation avec un SIRH externe (hors Phase 1).
- Contacts clients (gérés dans le module 03 Clients).

---

## 2. Distinction conceptuelle Membre / Technicien / Fournisseur

C'est le point structurant du module. La distinction est subtile mais essentielle pour éviter la confusion d'usage.

| Concept | Description | A un compte LMS ? | Apparaît dans | Géré par |
|---|---|---|---|---|
| **Membre** | Utilisateur authentifié avec un rôle (owner, admin, accountant, technician, viewer) | **Toujours** | Paramètres → Membres | owner, admin |
| **Technicien** | Personne réalisant des interventions terrain | Optionnel (lien `membership_id` peut être NULL) | Page "Équipe", planning, fiche chantier | owner, admin |
| **Fournisseur** | Donneur d'ordre (Foncia, Nexity...) ou fournisseur matériel | Jamais | Page "Fournisseurs", fiches chantiers, factures | owner, admin, accountant |

### 2.1 Cas d'usage typiques

**Cas A — Tech salarié interne avec compte mobile (typique)**
- Created as membership (rôle technician) ET technicien (lié au membership).
- Reçoit ses chantiers dans l'app mobile (Phase 2).
- Saisit ses interventions et photos.

**Cas B — Tech salarié sans compte (par exemple : pas de smartphone pro)**
- Created as technicien sans lien membership.
- Reste assignable à des chantiers et au planning.
- Le chef d'agence saisit les infos pour lui depuis le bureau.

**Cas C — Sous-traitant externe ponctuel**
- Created as technicien `is_external=true`, sans compte.
- Visible dans la liste équipe avec badge "Externe".
- Peut recevoir des bons d'intervention par email.

**Cas D — Comptable externe (cabinet)**
- Created as membership (rôle accountant).
- Pas créé comme technicien (ne fait pas d'intervention).
- Accède aux factures, exports, relances.

**Cas E — Promotion d'un technicien en chef d'agence**
- Le membre passe de rôle `technician` à `admin`.
- Le technicien lié reste actif pour les chantiers historiques.
- L'app affiche désormais l'interface admin pour cette personne.

**Cas F — Tech qui quitte l'entreprise**
- Le technicien est désactivé (date de fin renseignée).
- Le membre lié est désactivé (login impossible).
- Les chantiers en cours sont réassignés.
- L'historique reste consultable (pas de suppression).

### 2.2 Schéma de relations (rappel du cadrage)

```
┌─────────────────────────┐
│  users                  │ (compte d'authentification)
│  - email, full_name     │
│  - phone, avatar_url    │
└────────────┬────────────┘
             │
             │ 1..n
             ▼
┌─────────────────────────┐
│  memberships            │ (un user peut être dans plusieurs orgs)
│  - user_id              │
│  - organization_id      │
│  - role                 │
│  - agency_ids[]         │
└────────────┬────────────┘
             │
             │ 0..1
             ▼
┌─────────────────────────┐
│  technicians            │
│  - membership_id (NULL) │ ← lien optionnel vers compte
│  - first_name, last_name│
│  - is_external          │ ← interne / sous-traitant
│  - trades[]             │
│  - agency_id            │
└─────────────────────────┘

┌─────────────────────────┐
│  suppliers              │ (autonome, pas de lien user)
│  - name, type           │
│  - siret, contact info  │
└─────────────────────────┘
```

---

## 3. Personas concernés

| Persona | Cas d'usage principal du module |
|---|---|
| **Gérant (owner)** | Voit tout, modifie tout. Promeut un tech en admin. Désactive un membre. Ajoute des fournisseurs. |
| **Chef d'agence (admin)** | Gère les techniciens et membres de son ou ses agences. Invite des techniciens à devenir membres. Ne peut pas créer d'owner ni d'accountant. |
| **Comptable (accountant)** | Lecture sur l'équipe. Modification sur les fournisseurs (RIB, conditions de paiement). |
| **Technicien (technician)** | Voit la liste de ses collègues (lecture seule, pour collaboration). Ne voit pas les coûts internes. |
| **Lecture seule (viewer)** | Voit la liste équipe en lecture seule. Ne voit ni les coûts ni les emails. |

---

## 4. Parcours utilisateur (user flows)

### 4.1 Ajouter un technicien sans compte

```
[Page Équipe]
   │
   ▼
Bouton "+ Ajouter un technicien"
   │
   ▼
[Modal : Nouveau technicien — Étape 1/2 : Informations]
   - Photo (optionnelle, drop ou clic)
   - Prénom * Nom *
   - Métier(s) (multi-select avec chips emoji)
   - Agence de rattachement (select)
   - Téléphone Email (optionnels)
   - Type : Salarié / Sous-traitant
   - Date d'embauche / début mission
   - Bouton "Continuer"
   │
   ▼
[Étape 2/2 : Compétences & accès (optionnel)]
   - Habilitations (chips : "Habilitation B1V", "CACES R486", ...)
   - Véhicule (text)
   - Coût horaire interne (€/h, optionnel, masqué aux non-owner/admin/accountant)
   - Notes
   - Toggle : "Inviter cette personne à créer un compte"
       └── Si activé : email obligatoire
       └── Si activé : rôle proposé "technician" (modifiable owner uniquement)
   - Bouton "Créer"
   │
   ▼
[Backend]
   - Insert dans technicians
   - Si toggle invitation : créer une invitation (réutilise le module 01)
   - Toast confirmation
   │
   ▼
[Retour Page Équipe]
   - Le nouveau technicien apparaît dans la grid
   - Si invitation envoyée : badge "Invitation envoyée" sur sa carte
```

### 4.2 Inviter un technicien existant à créer un compte

Cas typique : un tech ajouté sans compte au début, qui obtient un smartphone pro plus tard.

```
[Page Équipe → Fiche technicien Jean Dupont]
   │
   ▼
Bouton "Inviter à créer un compte"
   │
   ▼
[Modal : Inviter Jean Dupont à rejoindre l'app]
   - Email pré-rempli si déjà saisi (modifiable, devient obligatoire)
   - Rôle : "Technicien" (modifiable par owner uniquement)
   - Agences : pré-cochées selon agence de rattachement
   - Message personnalisé optionnel
   - Bouton "Envoyer l'invitation"
   │
   ▼
[Backend]
   - Création d'une invitation (cf. module 01)
   - Lien membership_id sur le technicien dès acceptation
   - Toast confirmation
```

### 4.3 Promouvoir un technicien en chef d'agence

```
[Page Membres → Fiche Marie Leroy (rôle technician)]
   │
   ▼
Bouton "Modifier le rôle"
   │
   ▼
[Modal : Modifier le rôle de Marie Leroy]
   - Rôle actuel : Technicien
   - Nouveau rôle : Admin (avec description des permissions)
   - Agences accessibles : multi-select (pré-cochées sur son agence actuelle)
   - Avertissement : "Marie aura accès à tous les chantiers, factures et techniciens de ses agences."
   - Step-up auth : saisir votre mot de passe pour confirmer
   - Bouton "Confirmer le changement"
   │
   ▼
[Backend]
   - Update memberships.role
   - Update memberships.agency_ids
   - Le technicien lié reste actif (Marie peut continuer à intervenir)
   - Email à Marie : "Votre rôle a changé"
   - Activity log
   - Toast côté admin
   │
   ▼
[Retour Page Membres]
   - Marie apparaît dans la liste avec son nouveau rôle
   - Si Marie est connectée, son menu se rafraîchit au prochain refresh
```

### 4.4 Désactiver un technicien qui quitte l'entreprise

```
[Page Équipe → Fiche Pierre Durand]
   │
   ▼
Bouton "Désactiver" (rouge)
   │
   ▼
[Modal : Désactiver Pierre Durand]
   - Date de fin (date picker, défaut aujourd'hui)
   - Vérification : "Pierre a 3 chantiers en cours et 5 interventions planifiées. Que voulez-vous faire ?"
   - Choix radio :
       ○ Réassigner à un autre technicien (select : Marie Leroy, Jean Dupont, ...)
       ○ Laisser non assignés (à reprendre manuellement)
   - Si Pierre a un compte : "Désactiver également son compte ?" (par défaut oui)
   - Step-up auth
   - Bouton "Désactiver"
   │
   ▼
[Backend]
   - technicians.status = 'inactive'
   - technicians.termination_date = date
   - Réassignation des chantiers/interventions ouverts si demandée
   - Si compte : memberships.is_active = false → invalide les sessions
   - Email à Pierre (si compte) : "Votre accès a été désactivé"
   - Activity log
   │
   ▼
[Retour Page Équipe]
   - Pierre disparaît de la liste active
   - Toggle "Afficher les inactifs" → il réapparaît grisé
```

### 4.5 Ajouter un fournisseur

```
[Page Fournisseurs]
   │
   ▼
Bouton "+ Nouveau fournisseur"
   │
   ▼
[Modal : Nouveau fournisseur]
   - Nom / Raison sociale *
   - Type :
       ○ Donneur d'ordre (Foncia, Nexity, syndic externe)
       ○ Fournisseur matériel (Point.P, Rexel, Cedeo)
       ○ Sous-traitant (cf. aussi Techniciens externes)
       ○ Autre
   - SIRET (optionnel, validation)
   - N° TVA intra (optionnel)
   - Adresse
   - Téléphone Email
   - Contact principal (nom + rôle)
   - Conditions de paiement par défaut (30j, 45j, 60j, à réception)
   - Mode de paiement préféré (virement, chèque, prélèvement)
   - RIB (optionnel, masqué par défaut)
   - Notes
   - Bouton "Créer"
```

### 4.6 Voir les statistiques d'un technicien

```
[Page Équipe → Fiche Marie Leroy]
   │
   ▼
[Onglet "Statistiques"]
   - Période sélecteur (30j, 90j, 12 mois, custom)
   - Cards :
       • Chantiers traités : 47
       • Taux de complétion : 92 %
       • Durée moyenne intervention : 1h45
       • Note client moyenne (Phase 2) : 4.6 / 5
   - Graphique : interventions par semaine (barres)
   - Top 3 métiers : Plomberie (32), Serrurerie (10), Électricité (5)
   - Charge planning des 4 prochaines semaines (heatmap)
   - Lien vers chantiers en cours, historique complet
```

---

## 5. Écrans détaillés

### 5.1 Page "Équipe"

**URL** : `/team`
**Accessible à** : owner, admin (sur ses agences), accountant (lecture), technician (lecture limitée), viewer (lecture limitée)
**Layout** : grid de cartes, header avec filtres et CTA.

**En-tête** :
- Titre "👷 Équipe technique" + badge avec nombre actif.
- Filtres :
  - Agence (multi-select, pré-coché sur les agences accessibles).
  - Métier (multi-select chips emoji).
  - Type (Salarié / Externe / Tous).
  - Statut (Actif par défaut, toggle "Inclure inactifs").
  - Recherche full-text (nom, téléphone, métier).
- Bouton orange : "+ Ajouter un technicien" (visible owner/admin uniquement).
- Bouton secondaire : "📥 Importer CSV" (modal d'import en masse, owner/admin).
- Bouton secondaire : "📤 Exporter" (CSV de la sélection courante).

**Grid de cartes (3 colonnes sur desktop, responsive mobile)** :

Chaque carte affiche :
- Avatar (photo ou initiales sur fond couleur déterministe).
- Nom complet.
- Métier(s) avec emoji.
- Agence (📍 Montpellier).
- Badges :
  - "Compte actif" (vert) si lié à un membership actif.
  - "Externe" (gris) si sous-traitant.
  - "Inactif" (rouge) si désactivé.
  - "Invitation envoyée" (orange) si invitation en attente.
- Stats compactes : "🏗️ X chantiers actifs · Y total".
- Actions au survol :
  - Voir fiche.
  - ✏️ Modifier.
  - 📅 Voir planning.
- Indicateur de charge : barre verte/orange/rouge selon nombre d'interventions cette semaine.

**Carte spéciale "Ajouter"** en fin de grid : bouton avec dashed border pour ajout rapide.

**Empty state** : illustration, "Aucun technicien dans cette agence", bouton CTA "Ajouter un technicien".

### 5.2 Fiche technicien (panneau latéral 660 px)

**Activée** par clic sur une carte ou via un lien depuis chantier/planning.

**Header** :
- Photo + Nom + Métier(s) avec emoji.
- Statut (badge).
- Boutons d'action :
  - 📅 Planning.
  - ✏️ Modifier.
  - 🚪 Désactiver (rouge, owner/admin).
  - ✕ Fermer.

**Onglets** :
1. **📋 Informations**
2. **🏗️ Chantiers**
3. **📊 Statistiques**
4. **📁 Documents** (qualifications, attestations)
5. **📝 Notes**

**Onglet 1 — Informations** :
- Téléphone (cliquable tel:).
- Email (cliquable mailto:).
- Adresse perso (optionnelle, masquée aux non-admin).
- Date d'embauche / début mission.
- Métiers (chips emoji).
- Habilitations (chips).
- Véhicule.
- Type (Salarié / Externe).
- Coût horaire interne (€, masqué aux non-owner/admin/accountant).
- Compte associé : "Lié au compte de [Nom]" + lien vers fiche membre, ou "Pas de compte" + bouton "Inviter à créer un compte".

**Onglet 2 — Chantiers** :
- Liste compacte des chantiers actifs (en cours, planifiés).
- Chaque ligne : ref, client, métier emoji, statut chip, date.
- Clic → ouvre la fiche chantier.
- Lien "Voir l'historique complet (47 chantiers)".

**Onglet 3 — Statistiques** :
- Cf. parcours 4.6.

**Onglet 4 — Documents** :
- Grid de cartes (cf. fiche chantier — réutiliser composant).
- Catégories : Habilitations, Contrats, Justificatifs, Autres.
- Upload via Supabase Storage avec prefix `tenants/{org_id}/technicians/{tech_id}/`.
- Limite : 50 Mo total par technicien.

**Onglet 5 — Notes** :
- Zone texte auto-save (toutes les 2s après dernier input).
- Notes visibles owner/admin uniquement.
- Indicateur "Modifié il y a X minutes".

### 5.3 Modal "Nouveau / Modifier technicien"

**En-tête** : titre dynamique, X de fermeture.
**Body** : 2 colonnes ou 2 étapes selon largeur écran.

**Champs (cf. parcours 4.1 pour le détail)** :
- Photo (drop zone 80×80).
- Prénom *, Nom *.
- Téléphone (formatage auto FR).
- Email (validation format).
- Métiers * (multi-select chips emoji).
- Agence * (select).
- Type (radio Salarié / Externe).
- Date début (date picker).
- Coût horaire (number input, optionnel, masqué aux non-autorisés).
- Habilitations (chips additionnables).
- Véhicule.
- Notes.
- Toggle "Inviter à créer un compte" → si activé, email obligatoire et rôle pré-sélectionné.

**Footer** :
- Bouton "Annuler".
- Bouton "✓ Enregistrer".
- Si édition : bouton "🚪 Désactiver" rouge à gauche.

**Validation** :
- Prénom + Nom + Métier + Agence obligatoires.
- Email format si rempli.
- Téléphone format français si rempli.
- Photo < 2 Mo, redimensionnement auto.

### 5.4 Page "Membres" (sous-section Paramètres)

**URL** : `/settings/members`
**Accessible à** : owner (tous), admin (membres de ses agences), accountant (lecture).

**Layout** : table, pas de grid de cartes (admin-oriented).

**En-tête** :
- Titre "👥 Membres de l'organisation".
- Filtres : rôle, agence, statut.
- Recherche.
- Onglets :
  - **Membres actifs** (X)
  - **Invitations en attente** (Y)
  - **Désactivés** (Z)
- Bouton "+ Inviter un membre".

**Tableau (Membres actifs)** :
| Colonne | Contenu |
|---|---|
| Avatar + Nom | Photo + Prénom Nom + email en sous-titre |
| Rôle | Chip coloré (owner=or, admin=bleu, accountant=violet, technician=vert, viewer=gris) |
| Agences | Liste compacte ou "Toutes" |
| Dernière connexion | Date + heure relative ("il y a 2h", "il y a 3j") |
| MFA | ✅ activée / ⚠️ désactivée |
| Lien tech | Si technicien lié : lien vers fiche tech |
| Actions | ⋯ menu : Modifier rôle, Forcer reset MFA, Désactiver |

**Tableau (Invitations en attente)** :
| Colonne | Contenu |
|---|---|
| Email | + prénom/nom si fournis |
| Rôle | Chip |
| Agences | Liste |
| Invité par | Nom de l'inviteur |
| Envoyé le | Date relative |
| Expire le | Date + alerte si < 24h |
| Actions | Renvoyer · Annuler |

**Tableau (Désactivés)** :
| Colonne | Contenu |
|---|---|
| Avatar + Nom | Grisé |
| Rôle | Dernier rôle |
| Désactivé le | Date |
| Désactivé par | Nom |
| Actions | Réactiver (owner) · Anonymiser (RGPD) |

### 5.5 Modal "Inviter un membre" (cf. module 01 §3.2)

Réutilise le parcours du module 01. Différences pour le module 02 :
- Si on invite depuis la page Équipe (pas Paramètres → Membres) : pré-remplissage avec les infos du technicien si on l'invite.
- Choix supplémentaire "Lier au technicien existant : [Jean Dupont]" si parcours depuis fiche tech.

### 5.6 Page "Fournisseurs"

**URL** : `/suppliers`
**Accessible à** : owner, admin, accountant.

**Layout** : table avec recherche et filtres.

**En-tête** :
- Titre "🏭 Fournisseurs et donneurs d'ordre".
- Filtres : type (donneur d'ordre / matériel / autre), recherche.
- Bouton "+ Nouveau fournisseur".

**Tableau** :
| Colonne | Contenu |
|---|---|
| Nom | Logo (favicon auto si site renseigné) + raison sociale |
| Type | Chip (donneur d'ordre / matériel / sous-traitant / autre) |
| Contact | Nom contact principal + téléphone |
| Email | mailto: |
| Conditions paiement | "30 jours" / "À réception" |
| Activité | "12 chantiers · 8 factures" + lien |
| Actions | ⋯ Modifier · Voir factures · Désactiver |

**Fiche fournisseur (panneau latéral)** :
- Header : nom + type + actions.
- Onglets :
  1. **📋 Informations** : tous les champs.
  2. **🏗️ Chantiers** : liste des chantiers liés.
  3. **💶 Factures** : factures émises par ce fournisseur ou liées.
  4. **📁 Documents** : contrats cadres, attestations.
  5. **📝 Notes**.

### 5.7 Modal "Nouveau / Modifier fournisseur"

Cf. parcours 4.5 pour le détail des champs.

**Sections** :
- Identité (nom, type, SIRET, TVA).
- Coordonnées (adresse, tel, email, site web).
- Contact principal (nom, rôle, tel, email).
- Conditions commerciales (délai paiement, mode, RIB optionnel).
- Notes.

---

## 6. Matrice rôles × permissions du module

### 6.1 Membres (table memberships)

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir la liste des membres | ✅ tous | ✅ ses agences | ✅ tous (lecture) | ❌ | ✅ tous (lecture) |
| Voir détail d'un membre | ✅ | ✅ | ✅ | ❌ | ✅ |
| Inviter un owner | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un accountant | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un technician | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inviter un viewer | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier rôle d'un membre | ✅ | ❌ | ❌ | ❌ | ❌ |
| Modifier agences d'un membre | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Désactiver un membre | ✅ | ✅ (sauf owner) | ❌ | ❌ | ❌ |
| Forcer reset MFA | ✅ | ❌ | ❌ | ❌ | ❌ |
| Anonymiser (RGPD) | ✅ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Techniciens (table technicians)

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste équipe | ✅ tous | ✅ ses agences | ✅ tous | ✅ tous (sans coûts) | ✅ tous (limité) |
| Voir fiche tech | ✅ | ✅ | ✅ (sans coût) | ✅ (sans coût) | ✅ (sans coût ni email) |
| Créer technicien | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Modifier technicien | ✅ | ✅ ses agences | ❌ | ❌ (sauf ses notes) | ❌ |
| Voir coût horaire | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier coût horaire | ✅ | ❌ | ✅ | ❌ | ❌ |
| Désactiver technicien | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Inviter à créer un compte | ✅ | ✅ ses agences | ❌ | ❌ | ❌ |
| Voir statistiques | ✅ | ✅ | ✅ | ✅ (les siennes) | ✅ |

### 6.3 Fournisseurs (table suppliers)

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Voir liste fournisseurs | ✅ | ✅ | ✅ | ✅ (limité) | ✅ |
| Voir détail fournisseur | ✅ | ✅ | ✅ | ✅ (sans RIB) | ✅ (sans RIB) |
| Créer fournisseur | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier fournisseur | ✅ | ✅ | ✅ | ❌ | ❌ |
| Voir/Modifier RIB | ✅ | ✅ | ✅ | ❌ | ❌ |
| Désactiver fournisseur | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir factures associées | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 7. Workflows clés détaillés

### 7.1 Réassignation des chantiers d'un technicien

Déclenchée par :
- Désactivation d'un tech (cf. 4.4).
- Bouton "Transférer mes chantiers" depuis fiche tech.
- Action en masse depuis le planning.

**UI** :
```
[Modal : Réassigner les chantiers de Pierre Durand]

Pierre a actuellement :
- 3 chantiers en cours
- 5 interventions planifiées la semaine prochaine

Comment voulez-vous redistribuer ?

○ Tout réassigner à un seul technicien
   → Select : [Marie Leroy ▼]
   ⚠️ Charge prévue de Marie : 84% → 132% (surcharge)

○ Répartir intelligemment selon disponibilités et métiers
   → L'app propose une répartition automatique :
       • Marie Leroy : 2 chantiers Plomberie
       • Jean Dupont : 1 chantier Électricité + 3 interv.
       • Non assigné : 2 interv. (à reprendre manuellement)

○ Tout laisser non assigné
   ⚠️ Vous devrez reprendre chaque chantier individuellement.

[ Aperçu de la répartition ]
[ Annuler ] [ Confirmer la réassignation ]
```

**Backend** :
- Update bulk de `chantiers.assigned_technician_id`.
- Update bulk de `interventions.technician_id`.
- Notifications aux tech repreneurs : "3 nouveaux chantiers vous ont été assignés".
- Activity log détaillé.

### 7.2 Import CSV en masse de techniciens

**Cas d'usage** : déploiement initial, intégration depuis un autre outil.

**UI** :
```
[Modal : Importer des techniciens depuis CSV]

Étape 1/3 — Format
Téléchargez le modèle CSV : [ Modèle vide ] [ Modèle avec exemples ]

Colonnes attendues :
prenom, nom, email, telephone, metier, agence, type, date_debut, notes

Étape 2/3 — Upload
[ Dépose ton CSV ici ou clic pour parcourir ]

Étape 3/3 — Aperçu et validation
- 12 lignes détectées
- ✅ 10 valides
- ⚠️ 2 erreurs (lignes 4, 9 : agence inconnue)

[Tableau des 12 lignes avec édition inline pour corriger]

Options :
- ☑ Inviter automatiquement à créer un compte (si email fourni)
- ☑ Ignorer les doublons (mêmes prénom + nom)

[ Annuler ] [ Importer 10 techniciens ]
```

### 7.3 Limite par rôle : un admin n'invite pas un autre admin

Le système doit empêcher les admins de s'auto-créer ou de créer d'autres admins, pour éviter la prolifération non contrôlée des privilèges. Seul un owner peut nommer un admin.

Implémentation :
- UI : option grisée + tooltip "Seul un gérant peut inviter un autre administrateur".
- Backend : RLS policy bloque le INSERT si `current_user_role() ≠ 'owner'` et `target_role ∈ ('owner', 'admin', 'accountant')`.

---

## 8. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Création tech avec email déjà existant comme membre d'une autre org | Bloqué : "Cet email est déjà utilisé sur LMS Gestion. Si c'est la même personne, demandez-lui de se connecter et d'accepter votre invitation." |
| Email modifié sur un technicien lié à un membership actif | Modifie le technicien mais pas le membership (deux entités séparées). Toast : "L'email du technicien a été modifié, mais celui du compte associé reste inchangé. Modifiez-le séparément si nécessaire." |
| Désactiver un technicien avec chantiers en cours sans réassigner | Modal de confirmation avec liste des chantiers concernés. Action bloquée tant que pas de choix de réassignation. |
| Désactiver le dernier owner | Bloqué : "Au moins un gérant doit rester actif. Promouvez quelqu'un d'autre avant." |
| Promouvoir un tech sans compte en admin | Bloqué : "Cette personne doit d'abord créer un compte. Invitez-la." |
| Tech avec compte change d'agence | Update technician.agency_id ET memberships.agency_ids (synchronisé). |
| Suppression technicien | Pas de suppression réelle. Désactivation = `status='inactive'` + `termination_date`. Anonymisation possible après 24 mois (RGPD). |
| Doublon technicien (même prénom + nom + agence) | Modal d'avertissement à la création : "Un technicien avec ce nom existe déjà : [lien fiche]. Voulez-vous tout de même créer un nouveau ?" |
| Fournisseur avec SIRET déjà existant | Modal d'avertissement à la création avec lien vers le fournisseur existant. Possibilité de fusionner ou d'ignorer. |
| RIB sans validation IBAN | Validation côté client (algorithme IBAN), refus si invalide. |
| Photo tech > 2 Mo | Erreur upload : "Photo trop volumineuse, maximum 2 Mo. Réduisez la taille avant d'uploader." |
| Tech invité qui refuse l'invitation | Pas d'option directe ("refuser") — il ignore simplement le mail. L'invitation expire à 7j. L'admin voit "non acceptée". |
| Invitation renvoyée à un tech qui a déjà un compte dans l'org | Bloqué : "Cette personne fait déjà partie de l'organisation." |

---

## 9. Critères d'acceptation par fonctionnalité

### 9.1 Création technicien
- ✅ Un owner ou admin peut créer un tech avec prénom, nom, métier, agence.
- ✅ Photo optionnelle, redimensionnée auto en 200×200 px côté serveur.
- ✅ Validation téléphone (format FR) et email.
- ✅ Toggle "Inviter à créer un compte" force email obligatoire.
- ✅ Création + invitation se font dans la même transaction.
- ✅ Le coût horaire est masqué pour les non-autorisés.

### 9.2 Liste équipe
- ✅ Filtres agence, métier, type, statut fonctionnent et se combinent.
- ✅ Recherche full-text instantanée (debounce 200ms).
- ✅ Toggle "Afficher les inactifs" inclut les tech désactivés (grisés).
- ✅ Charge planning visible par couleur (vert <70%, orange 70-100%, rouge >100%).
- ✅ Export CSV reflète les filtres appliqués.

### 9.3 Réassignation
- ✅ La modal liste tous les chantiers et interventions ouverts.
- ✅ Le calcul de surcharge fonctionne (charge actuelle + nouvelle charge).
- ✅ La répartition automatique privilégie même métier + même agence.
- ✅ Les techs repreneurs reçoivent une notification.
- ✅ Activity log liste chaque chantier réassigné.

### 9.4 Promotion membre
- ✅ Seul un owner peut promouvoir en admin/accountant.
- ✅ Step-up auth obligatoire (mot de passe).
- ✅ Email automatique au promu.
- ✅ La session du promu se rafraîchit au prochain refresh (sans déco forcée).

### 9.5 Désactivation technicien
- ✅ Réassignation ou choix explicite de "non assigné" obligatoire.
- ✅ Date de fin saisissable (rétroactive ou future).
- ✅ Si compte lié : option de désactiver le compte (par défaut oui).
- ✅ Compte désactivé invalide les sessions actives.
- ✅ Tech inactif n'apparaît pas dans les selects de planning.

### 9.6 Fournisseurs
- ✅ Validation SIRET (Luhn 14 chiffres) si rempli.
- ✅ Validation IBAN si RIB rempli.
- ✅ Recherche par nom et SIRET.
- ✅ Détection doublon SIRET avec lien vers existant.
- ✅ Lien vers chantiers et factures associés.
- ✅ Désactivation soft (pas de suppression).

### 9.7 RLS et isolation
- ✅ Un admin de Montpellier ne voit pas les techs de Perpignan dans sa liste.
- ✅ Un technician ne voit pas les coûts horaires.
- ✅ Tentative API directe sur un tech d'une autre org → 404.
- ✅ Un tech dépromu ne voit plus l'interface admin.

### 9.8 Documents
- ✅ Upload limité à 50 Mo par tech.
- ✅ Types acceptés : PDF, JPG, PNG, DOCX, XLSX.
- ✅ Documents stockés dans Supabase Storage avec policy par org.

---

## 10. Métriques à suivre (PostHog)

### 10.1 Événements à logger
- `team.technician_created` (props: agency, trades, has_account, is_external)
- `team.technician_updated`
- `team.technician_deactivated` (props: had_active_chantiers, reassigned_count)
- `team.technician_invited_to_account` (props: role)
- `team.member_role_changed` (props: from_role, to_role)
- `team.member_deactivated`
- `team.bulk_import_started` (props: row_count, source)
- `team.bulk_import_completed` (props: success_count, error_count)
- `team.supplier_created` (props: type)
- `team.supplier_updated`
- `team.reassignment_workflow_used` (props: tech_count, mode=single|smart|none)

### 10.2 KPIs
- Nombre moyen de techniciens par organisation (suivi croissance).
- Ratio techniciens avec compte / sans compte (objectif : > 80 % en Phase 2 mobile).
- Taux d'utilisation de la réassignation intelligente (vs choix manuel).
- Délai moyen entre création tech et première intervention assignée.
- Taux de complétion du profil tech (photo + métier + habilitations + cost).

---

## 11. Points ouverts à arbitrer plus tard

- **Calendrier technicien synchronisé Google/Outlook** : prévu Phase 2.
- **Pointage horaire mobile** : Phase 2 avec l'app React Native.
- **Compétences certifiées avec dates d'expiration et alertes** : Phase 3 (notifications J-30 avant expiration habilitation).
- **Géofencing** : alerte si tech hors périmètre attendu — Phase 3.
- **Notation / feedback technicien** : Phase 3, dépend du module avis client.
- **Multi-rôles par agence** : un tech qui est aussi admin sur Perpignan uniquement — possible avec `agency_ids[]` sur memberships.
- **Anonymisation automatique RGPD à 36 mois** : à automatiser via job Inngest récurrent.

---

*Fin de la spec module 02 — Équipe & Membres.*
*Prochaine spec : 03-clients-contacts.md (CRM clients, types syndic/bailleur, contacts multiples).*
