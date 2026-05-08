# Spec produit — Module 11 : Notifications & Audit

**Version** : 1.0
**Statut** : Module transversal, à implémenter incrémentalement (fondations Sprint 1, finalisation Sprint 14)
**Dépendances** : Tous les modules métier
**Sprints concernés** : 1, 14 (et incrémental)

---

## 1. Objectif du module

Module transversal qui regroupe deux fonctions critiques :

**A. Notifications** : informer les utilisateurs des événements pertinents (chantier urgent, devis accepté, facture en retard, BI signé...) à travers plusieurs canaux (in-app, email, push Phase 2 mobile, SMS Phase 2). Système préférentiel par utilisateur, par type d'événement, par canal.

**B. Audit** : journal consolidé et requêtable de toutes les actions sensibles, pour traçabilité légale, conformité RGPD, support et investigation incidents.

Le module couvre :

- le **catalogue des événements** notifiables (~40 types).
- la **livraison multi-canal** : in-app (temps réel), email (Resend), push (Phase 2), SMS (Phase 2).
- les **préférences utilisateur** : par type, par canal, avec defaults raisonnables.
- les **digests** quotidiens (8h) et hebdomadaires (lundi 8h) pour réduire la fréquence.
- le **mark as read / unread** + actions bulk.
- la **deep link navigation** (clic sur notif ouvre l'entité concernée).
- la **temps réel** via Supabase Realtime.
- le **rate limiting** pour éviter le bombardement.
- le **journal d'audit** unifié (table `activity_logs`).
- la **recherche full-text** et filtres avancés sur l'audit.
- l'**export** d'audit pour conformité.
- la **rétention** : 24 mois pour audit, 90 jours pour notifs.
- le **diff before/after** sur les modifications.

**Hors périmètre du module** :
- Notifications push mobile natives (Phase 2 avec React Native).
- SMS automatiques aux clients (Phase 2 avec OVH/Twilio).
- Notification widget complexe (rich content, actions inline) — Phase 3.
- Intégration Slack / Teams pour notifs équipe (Phase 4).
- Notifications par webhook sortant (Phase 4).
- IA pour résumer / prioriser les notifs (Phase 4).

---

## 2. Architecture du système de notifications

### 2.1 Vue d'ensemble

```
┌────────────────────────────────────────────────────┐
│  Producteurs d'événements                          │
│  (modules métier émettent des events)              │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│  Event Bus (Inngest)                               │
│  • Reçoit l'event {type, org_id, payload}         │
│  • Détermine les destinataires concernés           │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│  Pour chaque destinataire :                        │
│  Lookup `notification_preferences`                 │
│  → quel canal envoyer ? (in-app / email / push)    │
│  → digest immédiat ou agrégé ?                     │
└────────────────────┬───────────────────────────────┘
                     │
        ┌────────────┼────────────┬───────────┐
        ▼            ▼            ▼           ▼
    ┌───────┐    ┌──────┐    ┌──────┐    ┌──────┐
    │In-app │    │Email │    │Push  │    │Digest│
    │(DB)   │    │Resend│    │Phase2│    │queue │
    └───┬───┘    └──┬───┘    └──┬───┘    └──┬───┘
        │           │            │           │
        ▼           ▼            ▼           ▼
    Realtime    Sent         Pending      Job 8h
    broadcast              (mobile)     (digest)
```

### 2.2 Tables

**`notifications`** (cf. cadrage §4.3) :
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | |
| `organization_id` | UUID | |
| `user_id` | UUID | Destinataire |
| `type` | TEXT | Code événement (ex : `chantier.urgent_unassigned`) |
| `severity` | TEXT | `info`, `warning`, `error`, `success` |
| `title` | TEXT | Titre affiché |
| `body` | TEXT | Corps |
| `link` | TEXT | URL relative pour deep-link |
| `entity_type` | TEXT | `chantier`, `invoice`, `quote`... |
| `entity_id` | UUID | ID de l'entité |
| `is_read` | BOOLEAN | |
| `read_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `delivered_channels` | TEXT[] | `['in-app', 'email']` (pour audit) |
| `metadata` | JSONB | Contexte additionnel |

**`notification_preferences`** :
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | |
| `organization_id` | UUID | |
| `event_type` | TEXT | Code événement |
| `in_app` | BOOLEAN | |
| `email` | BOOLEAN | |
| `push` | BOOLEAN | |
| `email_mode` | TEXT | `immediate`, `daily_digest`, `weekly_digest`, `disabled` |
| `quiet_hours_start` | TIME | Pas d'email ni push pendant cette plage |
| `quiet_hours_end` | TIME | |

**`activity_logs`** (cf. cadrage §4.3) — déjà détaillé.

### 2.3 Catalogue des événements

| Code | Description | Canaux par défaut | Sévérité |
|---|---|---|---|
| `auth.login_succeeded` | Connexion réussie | in-app | info |
| `auth.login_failed` | Tentative échouée | (dans logs uniquement) | warning |
| `auth.password_changed` | Mot de passe modifié | email | info |
| `auth.mfa_enabled` | MFA activée | email | info |
| `auth.new_device_login` | Nouvelle connexion détectée | email | warning |
| `auth.invitation_sent` | Invitation envoyée | (interne logs) | info |
| `auth.invitation_accepted` | Invitation acceptée par invité | in-app | success |
| `team.technician_created` | Tech ajouté | in-app | info |
| `team.technician_deactivated` | Tech désactivé | in-app + email aux admins | warning |
| `team.role_changed` | Rôle modifié | email + in-app | warning |
| `client.created` | Client créé | in-app | info |
| `client.archived` | Client archivé | in-app | info |
| `chantier.created` | Nouveau chantier | in-app (admin/tech assigné) | info |
| `chantier.urgent_assigned` | Urgence assignée | in-app + email + push | warning |
| `chantier.urgent_unassigned` | Urgence non assignée 30 min | in-app + email | warning |
| `chantier.urgent_unassigned_60min` | Urgence non assignée 1h | in-app + email + push | error |
| `chantier.deadline_approaching` | Échéance < 3j | in-app | warning |
| `chantier.deadline_overdue` | Échéance dépassée | in-app + email | warning |
| `chantier.completed` | Chantier terminé | in-app | success |
| `intervention.created` | Intervention planifiée | in-app + email tech | info |
| `intervention.modified` | Intervention modifiée | in-app + email tech | info |
| `intervention.cancelled` | Intervention annulée | in-app + email tech | warning |
| `intervention.reminder_d1` | Rappel J-1 | email | info |
| `intervention.reminder_h1` | Rappel H-1 | push (Phase 2) | info |
| `intervention.started` | Intervention démarrée | in-app admin | info |
| `intervention.completed` | Intervention terminée | in-app admin | success |
| `intervention.late_start` | Pas démarrée 30min après scheduled | in-app + email tech | warning |
| `quote.sent` | Devis envoyé | in-app | info |
| `quote.viewed_by_client` | Client a consulté le devis | in-app + email émetteur | info |
| `quote.accepted` | Devis accepté | in-app + email | success |
| `quote.refused` | Devis refusé | in-app + email | warning |
| `quote.expired` | Devis expiré | digest quotidien | info |
| `quote.relance_1_sent` | Relance envoyée | (interne) | info |
| `invoice.sent` | Facture envoyée | in-app | info |
| `invoice.viewed_by_client` | Client a consulté facture | in-app | info |
| `invoice.paid` | Facture payée | in-app + email | success |
| `invoice.partially_paid` | Paiement partiel | in-app | info |
| `invoice.overdue` | Facture en retard | in-app + email | warning |
| `invoice.formal_notice_generated` | Mise en demeure générée | email comptable | warning |
| `bi.created` | BI créé | in-app | info |
| `bi.signed` | BI signé | in-app + email comptable | success |
| `bi.refused` | BI refusé | in-app + email + push | error |
| `ai.cap_warning` | Cap IA 80 % atteint | in-app owner | warning |
| `ai.cap_reached` | Cap IA 100 % atteint | in-app + email owner | warning |
| `system.backup_failed` | Backup échoué | email owners | error |
| `system.import_completed` | Import IA terminé | in-app | success |

---

## 3. Personas concernés

| Persona | Cas d'usage |
|---|---|
| **Tous les utilisateurs** | Reçoivent et configurent leurs notifs |
| **Owner / Admin** | Plus de notifs (urgences, événements critiques organisation) |
| **Comptable** | Notifs centrées paiements et factures |
| **Technicien** | Notifs centrées ses interventions et chantiers |

---

## 4. Parcours utilisateur

### 4.1 Réception d'une notification temps réel

```
[Évenement métier déclenche notif]
   │
   ▼
[Backend Inngest job]
   - Détermine les destinataires
   - Pour chaque destinataire :
       • Lookup notification_preferences
       • Si in_app=true : insert dans `notifications`
       • Si email=true et email_mode='immediate' : envoie via Resend
       • Si email_mode='daily_digest' : ajoute à la queue digest
       • Si push=true (Phase 2) : envoie push
   - Émet event Realtime sur le canal `notifications:user_{id}`
   │
   ▼
[Frontend (utilisateur connecté)]
   - Subscribed au canal Realtime
   - Reçoit l'event
   - Affiche un toast subtil (3s) avec icône, titre, action
   - Incrémente le compteur dans la cloche du header
   - Joue un son discret (optionnel, paramétrable)
```

### 4.2 Consulter ses notifications

```
[Cloche du header (en haut à droite) — badge avec compteur non lus]
   │
   ▼
[Clic ouvre un dropdown panel — largeur 380 px]
   - Header : "Notifications" + compteur + lien "Marquer tout comme lu"
   - Onglets : "Toutes" / "Non lues" / "Mentionnées"
   - Liste virtualisée des notifs (lazy load par 20)
       • Icône type
       • Titre
       • Body (1-2 lignes)
       • Date relative ("il y a 5 min")
       • Pastille bleue si non lu
   - Au clic : marque comme lu + navigue vers entité concernée
   - Footer : "Voir toutes" → page dédiée
```

### 4.3 Page Notifications (vue complète)

```
[Cloche → "Voir toutes" ou /notifications]
   │
   ▼
[Page Notifications]
   - Filtres : type, période, statut (lu/non lu).
   - Recherche full-text.
   - Tableau ou liste plus aérée que le dropdown.
   - Actions bulk :
       • Marquer comme lu / non lu.
       • Supprimer.
   - Pagination.
```

### 4.4 Configuration des préférences

Cf. module 10 §5.5. Pour rappel :
- Page `/settings/notifications`.
- Tableau des types d'événements.
- Pour chaque type : 3 toggles (in-app / email / push).
- Pour email : dropdown mode (immédiat / digest quotidien / digest hebdo / désactivé).
- Plage horaire silencieuse paramétrable (par défaut 22h-7h).
- Préset rapides : "Tout activer", "Mode minimal" (urgences seulement), "Mode digest seulement".

### 4.5 Réception d'un digest

```
[Job Inngest 8h00 chaque jour]
   - Pour chaque user avec event_type ∈ digest_quotidien :
       • Récupère toutes les notifs du dernier jour
       • Génère un email récap :
           - Section "À traiter aujourd'hui" (urgences, échéances proches).
           - Section "Hier soir / cette nuit" (créations, modifications).
           - Section "Statistiques" (devis envoyés, factures payées...).
       • Envoie via Resend
   - Marque les notifs incluses comme `delivered_channels += ['email_digest']`
```

### 4.6 Notification cross-domain (mention dans une note)

```
[User A écrit dans une note du chantier CH-2026-0042 :]
   "@Marie peux-tu vérifier ce point demain ?"
   │
   ▼
[Auto-detection @mention]
   - Match user "Marie Leroy" dans l'organisation
   - Création notif type `mention.in_note`
   │
   ▼
[Marie reçoit notif in-app + email]
   - Titre : "User A vous a mentionnée dans une note"
   - Body : "[chantier CH-2026-0042 — Foncia Les Oliviers]"
   - Lien : ouvre le chantier sur l'onglet Notes
```

---

## 5. Système de digest

### 5.1 Modes

- **`immediate`** : envoi immédiat dès l'événement.
- **`daily_digest`** : agrégé en 1 email envoyé à 8h le lendemain.
- **`weekly_digest`** : agrégé en 1 email lundi 8h.
- **`disabled`** : aucun envoi email pour ce type.

### 5.2 Template digest quotidien

```
Sujet : 📋 Votre récap LMS du [date]

Bonjour [Prénom],

Voici ce qui s'est passé hier sur votre organisation :

🚨 URGENCES — 2 nouvelles
   • [client] - [titre] - [agence] [Lien]
   • [client] - [titre] - [agence] [Lien]

🏗️ CHANTIERS — 5 créés, 3 terminés
   [tableau compact]

📄 DEVIS — 2 envoyés, 1 accepté !
   • Devis [ref] accepté par [client] : [montant] [Lien]

💶 FACTURES — 3 émises, 4 payées (8 200 €), 2 en retard
   À relancer aujourd'hui :
   • [ref] [client] [montant] [retard]
   [...]

📋 BONS D'INTERVENTION — 1 signé, 0 refusé

Bonne journée !

Configurer mes préférences | Désactiver les digests
```

### 5.3 Template digest hebdomadaire

Plus statistique, agrégé sur la semaine.
Sections : KPI semaine, top performers, chantiers à surveiller, prévisionnel semaine suivante.

---

## 6. Système d'audit

### 6.1 Sources d'événements

Tout module métier émet des entrées dans `activity_logs` lors d'actions modifiant l'état :
- Création / modification / suppression d'entité.
- Changement de statut.
- Connexion / déconnexion.
- Modification paramètres sensibles.
- Exports.
- Actions IA.

### 6.2 Format d'une entrée audit

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid",
  "user_email_snapshot": "...",
  "entity_type": "chantier",
  "entity_id": "uuid",
  "entity_reference": "CH-2026-0042",
  "action": "status_changed",
  "changes": {
    "status": { "before": "en_cours", "after": "terminé" }
  },
  "context": {
    "method": "drag_kanban",
    "page": "/chantiers"
  },
  "ip_address": "1.2.3.4",
  "user_agent": "Mozilla/...",
  "created_at": "2026-05-06T14:32:11Z"
}
```

### 6.3 Page Journal d'audit

**URL** : `/settings/audit`

**Layout** : tableau dense + filtres latéraux.

**Filtres** :
- Période (date range).
- Type d'entité (multi-select).
- Action (multi-select).
- Utilisateur (autocomplete).
- Référence d'entité (recherche).
- Adresse IP.
- Plage horaire.

**Recherche full-text** : sur `entity_reference`, `user_email_snapshot`, contenu changes.

**Tableau** :

| Colonne | Contenu |
|---|---|
| Date / Heure | Format complet |
| Utilisateur | Avatar + nom + email |
| Action | Chip coloré |
| Entité | Type + référence (lien si pas archivé) |
| Changements | Résumé court + bouton "Voir détail" |
| IP | Tooltip avec géoloc approximative |
| Contexte | Méthode (drag, fiche, API...) |

**Détail au clic** : modal avec diff JSON before/after coloré (vert ajouté, rouge supprimé, jaune modifié).

**Export** : bouton "📤 Exporter" → CSV ou JSON de la sélection.

### 6.4 Catégories d'actions

| Catégorie | Actions | Exemples |
|---|---|---|
| **CRUD** | `created`, `updated`, `deleted`, `archived`, `restored` | Sur toute entité |
| **Statut** | `status_changed` | Chantier → terminé |
| **Auth** | `login_succeeded`, `login_failed`, `logout`, `mfa_*`, `password_changed` | |
| **Membres** | `member_invited`, `member_role_changed`, `member_deactivated` | |
| **Documents** | `document_uploaded`, `document_deleted` | |
| **Financial** | `quote_sent`, `quote_accepted`, `invoice_issued`, `payment_recorded`, `credit_note_created` | |
| **Sensitive** | `sensitive_field_modified`, `data_exported`, `bulk_action_performed` | SIRET, CGV, mass actions |
| **System** | `backup_started`, `import_completed`, `migration_run` | |

### 6.5 Rétention et anonymisation

- **Notifications** : conservées 90 jours, purge auto (job Inngest mensuel).
- **Activity logs** : conservés 24 mois (RGPD pour la plupart).
- **Logs financiers** (factures, paiements) : conservés 10 ans (obligation légale).
- **Anonymisation** : après 24 mois pour les logs non financiers, `user_id` → hash, `user_email_snapshot` → null, `ip_address` → CIDR /24.

### 6.6 Cas d'usage de l'audit

**Investigation incident** :
- "Qui a modifié le SIRET de l'organisation hier ?"
- Filtre : entity_type='organization', action='updated', period='hier'.

**Réponse à demande RGPD** :
- "Tout ce qui concerne user X" → filter user_id = X, export complet.

**Conformité fiscale** :
- "Toutes les modifications de factures sur 2025" → export FEC complet.

**Suivi de performance** :
- "Combien de chantiers chaque utilisateur a créé ce mois ?" → agrégation.

**Détection de fraude** :
- Pattern : modifications de prix unitaire après émission, suppressions massives.

---

## 7. Matrice rôles × permissions

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Recevoir notifs personnelles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configurer ses préférences | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir notifs reçues | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir audit organisation complet | ✅ | ❌ | ✅ | ❌ | ❌ |
| Voir audit de ses agences | ✅ | ✅ | ✅ | ❌ | ✅ (limité) |
| Voir actions d'autres users dans audit | ✅ | ✅ ses agences | ✅ | ❌ | ✅ (limité) |
| Voir détails diff sensibles (SIRET, RIB...) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Exporter audit | ✅ | ❌ | ✅ | ❌ | ❌ |
| Anonymiser logs anciens | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Workflows clés

### 8.1 Émission d'événement par les modules métier

API interne unifiée pour tous les modules :

```typescript
// packages/notifications/emit.ts
export async function emitEvent(opts: {
  type: EventType,
  organizationId: string,
  payload: Record<string, any>,
  excludeUserId?: string,  // Pour éviter de notifier l'auteur de l'action
}) {
  // 1. Détermination des destinataires selon le type
  const recipients = await resolveRecipients(opts.type, opts.organizationId, opts.payload)

  // 2. Pour chaque destinataire, lookup préférences et dispatch
  for (const recipientId of recipients) {
    const prefs = await getPreferences(recipientId, opts.type)
    await dispatchToChannels(opts, recipientId, prefs)
  }

  // 3. Insert activity_log si action sensible
  if (opts.payload.activityLog) {
    await insertActivityLog(opts.payload.activityLog)
  }
}
```

Tous les modules métier appellent `emitEvent(...)` après une action — couplage faible.

### 8.2 Rate limiting et anti-flood

Pour éviter de submerger un utilisateur :
- Maximum 50 notifs in-app / heure / utilisateur. Au-delà : agrégation auto en "X événements similaires".
- Maximum 5 emails immédiats / heure / utilisateur sur un même type. Au-delà : passage en digest.
- Pas de notifs en doublon dans une fenêtre de 1 minute (deduplication par `(user_id, type, entity_id)`).

### 8.3 Quiet hours (heures silencieuses)

Pendant la plage configurée par utilisateur (par défaut 22h-7h) :
- Pas d'email immédiat (ajouté au digest matinal).
- Pas de push (Phase 2).
- In-app reste actif (l'utilisateur peut éteindre la cloche).

### 8.4 Recovery après downtime

Si Resend est down ou Inngest a un backlog :
- Job de retry avec backoff exponentiel.
- Limite : 5 tentatives sur 1 heure.
- Échec définitif → entry dans `notifications` avec `delivered_channels=['failed']` + alerte admin.

### 8.5 Détection de pattern suspect dans l'audit

Job hebdo qui scanne `activity_logs` :
- > 100 modifications par 1 user en 1 heure → alerte.
- Suppressions > 10 / 1 heure → alerte.
- Connexions échouées > 20 / IP / 1 heure → alerte sécurité.
- Login depuis pays inhabituel → alerte (sans bloquer).

---

## 9. Composants UI

### 9.1 Cloche header

- Position : header top-right, à côté de l'avatar utilisateur.
- État sans notifs : icône grise.
- État avec notifs non lues : icône colorée + badge avec compteur (max "9+").
- Animation pulse à l'arrivée d'une nouvelle notif.
- Clic ouvre dropdown.

### 9.2 Toast notification

- Apparait en bas à droite (4s par défaut).
- Couleur selon sévérité (info bleu, warning orange, success vert, error rouge).
- Action principale en bouton (ex : "Voir le chantier").
- Bouton fermer.
- Empilable jusqu'à 3 toasts simultanés.

### 9.3 Dropdown notifications

- Width 380 px.
- Header avec actions.
- Onglets (Toutes / Non lues / Mentions).
- Liste virtualisée.
- Footer avec lien vers page complète.

### 9.4 Page notifications complète

- Layout 2 colonnes : sidebar filtres + liste centrale.
- Tableau aéré pour confort.
- Bouton "Préférences" en haut.

### 9.5 Page audit

- Tableau dense (info admin).
- Filtres avancés latéraux.
- Modal détail diff par ligne.
- Export top right.

---

## 10. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Email invalide / bounce | Marker `notifications.delivered_channels=['email_bounced']`. Plus d'envoi email à cet utilisateur jusqu'à correction. Notification interne admin. |
| User désactivé reçoit un événement | Aucune notif envoyée. |
| Notif déclenchée par l'auteur de l'action | Auteur exclu par défaut sauf cas spécifiques (ex : confirmation de paiement). |
| Burst d'événements (100 chantiers créés en masse) | Agrégation auto : "X chantiers ont été créés". |
| Resend down | Retry avec backoff. Si > 1h : passage en mode digest auto. |
| Realtime down | Polling 30s en fallback. UI affiche "Connexion en cours" subtil. |
| User connecté sur 3 onglets | Tous reçoivent la notif. Mark as read se propage. |
| Notif sur entité supprimée entre temps | Lien tombe en 404 — affiche message "Cette ressource n'est plus accessible". |
| Quiet hours qui chevauchent minuit | Gestion correcte (22h-7h = OK). |
| User change de fuseau horaire | Conversion automatique de la plage quiet_hours. |
| Audit log avec changes JSONB très gros | Tronqué à 10 Ko par log. Ajout d'un flag `truncated=true`. |
| Recherche audit retourne >10 000 résultats | Limite à 10 000 affichés, message "Affinez les filtres pour voir plus". |
| Import audit corrompu | Quarantine du log + alerte admin. |

---

## 11. Critères d'acceptation

### 11.1 Notifications
- ✅ Catalogue de 40+ événements implémenté.
- ✅ Préférences par type / canal / mode.
- ✅ Cloche header avec badge temps réel.
- ✅ Dropdown panel fonctionnel.
- ✅ Page complète avec filtres.
- ✅ Mark as read individuel et bulk.
- ✅ Digests quotidien et hebdo envoyés via Inngest.
- ✅ Quiet hours respectées.
- ✅ Rate limiting en place.

### 11.2 Realtime
- ✅ Notif visible dans la cloche < 1s après événement.
- ✅ Toast affiché simultanément.
- ✅ Compteur badge mis à jour en temps réel.

### 11.3 Audit
- ✅ Tous les modules émettent leurs events vers `activity_logs`.
- ✅ Page audit avec filtres avancés.
- ✅ Diff before/after lisible.
- ✅ Recherche full-text < 500 ms.
- ✅ Export CSV / JSON.

### 11.4 Rétention
- ✅ Job mensuel purge notifs > 90j.
- ✅ Job mensuel anonymise logs > 24 mois.
- ✅ Logs financiers conservés 10 ans (jamais purgés).

### 11.5 RGPD
- ✅ Anonymisation correcte des logs anciens.
- ✅ Export complet utilisateur inclut ses notifs et son audit.
- ✅ Suppression compte anonymise les logs liés.

### 11.6 Permissions
- ✅ Audit visible selon rôle.
- ✅ Champs sensibles masqués dans diff selon rôle.
- ✅ RLS bloque accès cross-organisation.

### 11.7 Performance
- ✅ Page notif charge < 1s pour 1000 notifs.
- ✅ Recherche audit < 500 ms sur 100k entrées.
- ✅ Realtime < 1s.

---

## 12. Métriques (PostHog)

### 12.1 Événements
- `notification.delivered` (props: type, channel, severity)
- `notification.opened` (props: type, time_since_received_minutes)
- `notification.bulk_marked_read` (props: count)
- `notification.preferences_updated` (props: type)
- `notification.email_bounced`
- `digest.sent` (props: type=daily|weekly, items_count)
- `audit.viewed`
- `audit.searched` (props: filter_type)
- `audit.exported` (props: format, row_count)

### 12.2 KPIs
- Taux d'ouverture des notifs in-app (objectif > 70 %).
- Délai moyen réception → ouverture.
- Taux de désactivation par type (KPI qualité — si trop haut, le type est mal calibré).
- Adoption digest vs immédiat.
- Volume d'audit logs/mois (suivi croissance).
- Temps moyen de recherche audit.

---

## 13. Points ouverts à arbitrer plus tard

- **Push notifications mobiles natives** : Phase 2 avec React Native + Expo Push.
- **SMS notifications** (urgences uniquement) : Phase 2.
- **Slack / Teams / Discord intégration** : Phase 4.
- **Webhooks sortants** : Phase 4 pour intégrations clients.
- **Notifications enrichies** : Inline actions ("Accepter / Refuser" depuis la notif elle-même) — Phase 3.
- **Résumé IA des événements** : "Ta semaine en 3 lignes" — Phase 4.
- **Priorisation IA** : ordonner les notifs par importance — Phase 4.
- **Notifications sonores configurables** : choix de sons par type — Phase 3.
- **Mode "Ne pas déranger"** programmable (vacances, weekends) — Phase 3.
- **Activity feed organisation** : flux Twitter-like des actions internes — Phase 3.
- **Audit avec blockchain** pour preuve immuable (Phase 5, marketing).
- **Détection d'anomalies par ML** : pattern inhabituel = alerte — Phase 5.

---

*Fin de la spec module 11 — Notifications & Audit.*
*Prochaine spec : 12-recherche-vue-ensemble.md (recherche globale Ctrl+K, dashboard, monitoring temps réel, vue d'ensemble produit).*
