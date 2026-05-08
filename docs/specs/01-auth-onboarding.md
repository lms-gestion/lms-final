# Spec produit — Module 01 : Auth & Onboarding

**Version** : 1.0
**Statut** : À implémenter en Sprint 1-2
**Dépendances** : aucune (module fondateur)
**Sprints concernés** : Sprint 1, Sprint 2

---

## 1. Objectif du module

Permettre à un utilisateur autorisé d'accéder à l'application LMS Gestion en sécurité, dans la bonne organisation et avec le bon rôle. Le module gère :

- la connexion (email/password ou magic link),
- l'authentification multi-facteur (MFA TOTP),
- le système d'invitation par email,
- l'onboarding initial d'une organisation,
- la récupération de mot de passe,
- la déconnexion et la gestion de session,
- le switch entre organisations (Phase 4 ready).

**Hors périmètre du module** :
- OAuth Google/Microsoft (reporté Phase 2).
- SSO entreprise SAML (reporté Phase 4).
- Inscription libre publique (reporté Phase 4 lors de la commercialisation).

---

## 2. Personas concernés

| Persona | Description | Premier flux |
|---|---|---|
| **Gérant (owner)** | Dirigeant qui inscrit l'organisation. Le premier compte créé. | Onboarding complet : crée organisation → invite équipe |
| **Chef d'agence (admin)** | Responsable d'une ou plusieurs agences. Invité par le gérant. | Acceptation invitation → setup compte → MFA |
| **Comptable (accountant)** | Lit toute l'organisation, gère factures. Invité. | Acceptation invitation → setup compte → MFA |
| **Technicien (technician)** | Sur le terrain, accès limité. Invité par admin agence. | Acceptation invitation → setup compte (MFA optionnel) |
| **Lecture seule (viewer)** | Audit, observateur ponctuel. Invité. | Acceptation invitation → setup compte |

---

## 3. Parcours utilisateur (user flows)

### 3.1 Premier login du gérant (création de l'organisation)

Le tout premier owner d'une organisation est créé manuellement par l'équipe LMS Gestion (toi) en Phase 1, car il n'y a pas d'inscription publique.

```
[Toi (admin platform)]
   │
   ▼
   Crée user via Supabase Admin API
   Crée organization "La Maison des Services"
   Crée membership (user, organization, role=owner)
   Envoie email d'invitation au gérant
   │
   ▼
[Gérant reçoit email "Bienvenue sur LMS Gestion"]
   │
   ▼
Clic sur le lien
   │
   ▼
[Écran : Définir son mot de passe]
   - Mot de passe (12 char min, 1 maj, 1 chiffre, 1 spécial)
   - Confirmation mot de passe
   - Validation
   │
   ▼
[Écran : Configurer MFA TOTP] (obligatoire pour owner)
   - QR code à scanner avec Google Authenticator / Authy / 1Password
   - Saisie code TOTP à 6 chiffres
   - Codes de récupération générés (10 codes à imprimer ou sauvegarder)
   │
   ▼
[Écran : Onboarding wizard — Étape 1/4]
   "Bienvenue ! Configurons votre organisation."
   - Nom commercial : "La Maison des Services" (préfilll)
   - Raison sociale
   - SIRET (validation format 14 chiffres + Luhn)
   - N° TVA intra (validation format FR + 11 chiffres)
   - Adresse siège social (autocomplete Google Places)
   │
   ▼
[Étape 2/4 : Logo et identité visuelle]
   - Upload logo (PNG/SVG/JPG, < 2 Mo)
   - Aperçu factures avec logo
   - Couleur principale (préselectionnée bleu marine)
   │
   ▼
[Étape 3/4 : Première agence]
   - Nom : "Montpellier" (préfilll exemple)
   - Code court : "MTP"
   - Adresse
   - Téléphone
   - Email
   - Codes postaux desservis : ['34000', '34070', '34080', '34170', '34970', ...]
   - Métiers : multi-select (Plomberie, Électricité, Toiture, Serrurerie, Menuiserie, Peinture, Maçonnerie, Syndics)
   │
   ▼
[Étape 4/4 : Inviter l'équipe]
   - Saisie d'emails avec rôle assigné
   - Bouton "Ajouter une ligne" pour invitations multiples
   - Bouton "Passer cette étape" (pourra inviter plus tard)
   │
   ▼
[Dashboard d'accueil — première connexion]
   - Toast "Bienvenue, [Prénom] ! Votre organisation est prête."
   - Tour produit interactif optionnel (5 étapes max)
```

### 3.2 Invitation d'un membre

```
[Owner ou Admin connecté]
   │
   ▼
Page "Équipe" → Bouton "+ Inviter un membre"
   │
   ▼
[Modal : Inviter un nouveau membre]
   - Email (obligatoire, validation format)
   - Prénom (optionnel, prérempli si reconnu)
   - Nom (optionnel)
   - Rôle (radio buttons + descriptions)
       ○ Owner (gérant — accès complet) [grisé si pas owner]
       ○ Admin (chef d'agence)
       ○ Comptable (toute l'organisation, factures)
       ○ Technicien (chantiers assignés uniquement)
       ○ Lecture seule
   - Si Admin ou Technicien : multi-select des agences
   - Message personnalisé (optionnel, 200 char max)
   - Bouton "Envoyer l'invitation"
   │
   ▼
[Backend]
   1. Création row dans `invitations` (token unique, expires_at = now + 7 jours)
   2. Envoi email via Resend avec template "invitation"
   3. Toast confirmation à l'inviteur
   4. Ligne ajoutée dans la liste "Équipe → Invitations en attente"
   │
   ▼
[Invité reçoit email]
   Sujet : "[Nom organisation] vous invite à rejoindre LMS Gestion"
   - Bouton CTA : "Accepter l'invitation"
   - Lien expire dans 7 jours
   - Footer : aide, sécurité
   │
   ▼
Clic sur lien d'invitation
   │
   ▼
[Écran : Création de compte]
   - Email pré-rempli (lecture seule)
   - Prénom (pré-rempli si fourni)
   - Nom (pré-rempli si fourni)
   - Téléphone (optionnel)
   - Mot de passe + confirmation
   - Checkbox "J'accepte les CGU et la politique de confidentialité"
   - Bouton "Créer mon compte"
   │
   ▼
[Écran : MFA setup] (obligatoire si rôle = owner/admin/accountant)
   ou skip si technician/viewer (proposé en option)
   │
   ▼
[Dashboard - Première connexion utilisateur]
   - Tour rapide adapté au rôle (3-5 étapes)
   - Toast "Bienvenue dans [Nom organisation], [Prénom] !"
```

### 3.3 Login récurrent

```
[Utilisateur arrive sur l'application]
   │
   ▼
[Écran de login]
   Onglets ou choix : "Mot de passe" / "Lien magique"
   │
   ├─── [Voie 1 : Mot de passe]
   │     - Email
   │     - Mot de passe (œil pour voir/masquer)
   │     - Checkbox "Se souvenir de moi" (session 30 jours)
   │     - Lien "Mot de passe oublié ?"
   │     - Bouton "Se connecter"
   │     │
   │     ▼
   │   [Si MFA activé]
   │     - Saisie code TOTP 6 chiffres
   │     - Lien "Utiliser un code de récupération"
   │     - Bouton "Vérifier"
   │     │
   │     ▼
   │   Login réussi → redirection dashboard
   │
   └─── [Voie 2 : Lien magique]
         - Email
         - Bouton "Recevoir un lien de connexion"
         │
         ▼
       [Toast : "Vérifiez votre email"]
         - Message : "Un lien de connexion a été envoyé à [email]"
         - Lien "Renvoyer" (cooldown 60s)
         │
         ▼
       Clic sur lien dans email
         │
         ▼
       [Si MFA activé : saisie TOTP]
         │
         ▼
       Login réussi
```

### 3.4 Mot de passe oublié

```
[Lien "Mot de passe oublié" sur écran login]
   │
   ▼
[Écran : Réinitialiser le mot de passe]
   - Email
   - Bouton "Envoyer le lien de réinitialisation"
   │
   ▼
[Toast confirmation discret]
   "Si cet email existe, vous recevrez un lien dans quelques instants."
   (Volontairement neutre pour ne pas révéler l'existence du compte)
   │
   ▼
[Email reçu]
   Sujet : "Réinitialisation de votre mot de passe LMS Gestion"
   - Lien valable 1 heure
   - "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email"
   │
   ▼
Clic sur lien
   │
   ▼
[Écran : Nouveau mot de passe]
   - Nouveau mot de passe
   - Confirmation
   - Bouton "Mettre à jour"
   │
   ▼
[Login automatique + toast succès]
   - Email envoyé en parallèle au user : "Votre mot de passe a été modifié"
   - Si MFA activé : passage à l'étape MFA
```

### 3.5 Configuration MFA (depuis paramètres)

Pour les rôles où MFA est obligatoire, c'est forcé dès le premier login.
Pour les autres, accessible depuis Paramètres → Sécurité.

```
[Paramètres → Sécurité → "Activer l'authentification à deux facteurs"]
   │
   ▼
[Étape 1 : Re-authentification]
   - Saisie du mot de passe actuel
   - "Pour votre sécurité, confirmez votre identité"
   │
   ▼
[Étape 2 : Setup TOTP]
   - QR code (taille 250×250)
   - Clé secrète en texte (au cas où app sans QR scanner)
   - Liste apps recommandées : Google Authenticator, Authy, 1Password, Microsoft Authenticator
   │
   ▼
[Étape 3 : Vérification]
   - Saisie code TOTP 6 chiffres
   - Validation (3 essais max, sinon retour étape 2)
   │
   ▼
[Étape 4 : Codes de récupération]
   - 10 codes à 8 caractères, à imprimer ou copier
   - Bouton "Télécharger en PDF"
   - Bouton "Copier dans le presse-papier"
   - Avertissement : "Conservez ces codes en lieu sûr. Ils permettent d'accéder à votre compte si vous perdez votre appareil MFA."
   - Checkbox obligatoire : "J'ai sauvegardé mes codes de récupération"
   - Bouton "Activer la 2FA" (grisé tant que checkbox non cochée)
   │
   ▼
[Toast succès]
   - Email envoyé : "MFA activée sur votre compte"
   - Log d'activité ajouté
```

### 3.6 Switch d'organisation (Phase 4 ready)

Pour Phase 1 : un user n'appartient qu'à une organisation. Ce parcours sera implémenté en Phase 4 mais l'UI doit déjà avoir le sélecteur (caché si une seule org).

```
[Sidebar → Bouton organisation actuelle (avec chevron)]
   │
   ▼
[Popup : Mes organisations]
   - Liste des organisations avec rôle pour chacune
   - Indicateur "actuelle"
   - Bouton "Créer une nouvelle organisation" (Phase 4)
   │
   ▼
Clic sur autre organisation
   │
   ▼
[Loading bref]
   - Refresh des données
   - Toast "Vous êtes maintenant connecté à [Nom organisation]"
```

### 3.7 Déconnexion

```
[Sidebar → Avatar utilisateur → Menu → Déconnexion]
   │
   ▼
[Confirmation modal]
   "Voulez-vous vraiment vous déconnecter ?"
   - Bouton "Annuler"
   - Bouton "Déconnexion"
   │
   ▼
   - Suppression session côté serveur
   - Suppression cookie
   - Redirection vers /login
   - Toast "À bientôt !"
```

---

## 4. Écrans détaillés

### 4.1 Écran : Login

**URL** : `/login`
**Layout** : Centré sur fond bleu marine dégradé. Carte glassmorphism (cohérent avec l'écran login actuel de l'Electron).

**Composants** :
- Logo LMS centré en haut.
- Titre : "LA MAISON **DES SERVICES**" (or sur la 2ᵉ ligne).
- Sous-titre : "Espace Gestion Interne".
- Toggle entre 2 modes :
  - **Mot de passe**
    - Champ email (icône ✉️, autocomplete email).
    - Champ mot de passe (œil show/hide, autocomplete current-password).
    - Checkbox "Se souvenir de moi".
    - Lien "Mot de passe oublié ?"
    - Bouton CTA orange "Connexion →".
  - **Lien magique**
    - Champ email.
    - Bouton CTA orange "Recevoir un lien de connexion".
    - Note : "Un lien de connexion à usage unique sera envoyé à votre email."
- Footer : "LMS Gestion v0.1.0 — La Maison des Services".

**États** :
- Default
- Loading (spinner sur bouton CTA, champs disabled)
- Erreur (message rouge sous le bouton, ne révèle pas si email existe)
- Succès (transition vers MFA ou dashboard)

**Validation côté client** :
- Email : regex format valide.
- Mot de passe : non vide.

**Validation côté serveur** :
- Rate limiting : 5 tentatives / 15 min par IP, 10 tentatives / heure par email.
- Au-delà : lockout 15 min, message "Trop de tentatives, réessayez plus tard".
- Captcha (Turnstile Cloudflare) après 3 échecs consécutifs sur le même email.

**Messages d'erreur** :
- "Identifiant ou mot de passe incorrect." (jamais "email inconnu" pour ne pas énumérer)
- "Trop de tentatives. Réessayez dans 15 minutes."
- "Votre compte a été désactivé. Contactez votre administrateur."
- "Erreur de connexion. Réessayez dans quelques instants." (erreur réseau)

### 4.2 Écran : Vérification MFA

**URL** : `/login/mfa`
**Layout** : même fond bleu marine, carte centrée.

**Composants** :
- Icône bouclier 🛡️.
- Titre : "Code de vérification".
- Sous-titre : "Saisissez le code à 6 chiffres généré par votre application d'authentification."
- 6 inputs séparés (un par chiffre), navigation flèches/auto-focus sur saisie.
- Lien "Utiliser un code de récupération" (popup).
- Bouton CTA "Vérifier".
- Lien "Se déconnecter" en bas.

**États** :
- Default
- Loading (spinner)
- Erreur (champs en rouge, message)
- Succès (redirection)

**Validation** :
- 6 chiffres exactement.
- 3 essais max, puis lockout 5 min.

### 4.3 Écran : Définir le mot de passe (depuis invitation)

**URL** : `/invitation/:token`

**Composants** :
- Bandeau supérieur : "[Nom organisation] vous invite à rejoindre LMS Gestion".
- Logo organisation invitante (si configuré).
- Carte avec champs :
  - Email (lecture seule, pré-rempli).
  - Prénom (pré-rempli si fourni dans l'invitation).
  - Nom (pré-rempli si fourni).
  - Téléphone (optionnel).
  - Mot de passe + indicateur de force (faible / moyen / fort).
  - Confirmation mot de passe.
  - Checkbox "J'accepte les CGU et la politique de confidentialité" (liens vers les pages publiques).
- Bouton CTA "Créer mon compte".

**Indicateur force mot de passe** :
- Faible : < 8 chars OU pas de mix maj/min/chiffre — barre rouge.
- Moyen : 8-11 chars avec mix — barre orange.
- Fort : 12+ chars avec maj + min + chiffre + spécial — barre verte.

**Politique de mot de passe** :
- Minimum 12 caractères.
- Au moins une majuscule.
- Au moins un chiffre.
- Au moins un caractère spécial.
- Pas dans le top 10 000 mots de passe communs (vérification via la table `pwned-passwords` simplifiée ou API HaveIBeenPwned k-anonymity).

**Erreurs spécifiques** :
- "Lien d'invitation expiré" → bouton "Demander une nouvelle invitation".
- "Cette invitation a déjà été utilisée" → bouton "Aller à la connexion".
- "Cet email est déjà associé à un compte" → bouton "Se connecter".

### 4.4 Écran : Configuration MFA TOTP

**URL** : `/onboarding/mfa-setup`

**Composants** :
- Stepper en haut (1/3 Setup, 2/3 Vérification, 3/3 Codes de récup).
- **Étape 1 — Setup** :
  - Titre : "Configurer l'authentification à deux facteurs".
  - Description : "Pour la sécurité de votre compte et de l'organisation, vous devez configurer la 2FA."
  - QR code (250×250).
  - Clé secrète en monospace + bouton copy.
  - Liste applis recommandées avec liens stores.
  - Bouton "J'ai scanné le code →".
- **Étape 2 — Vérification** :
  - 6 inputs pour le code TOTP.
  - Bouton "Vérifier".
- **Étape 3 — Codes de récupération** :
  - Liste de 10 codes en grid 2×5.
  - Bouton "Télécharger PDF" (génère un PDF imprimable).
  - Bouton "Copier".
  - Avertissement encadré orange.
  - Checkbox obligatoire : "Je confirme avoir sauvegardé mes codes de récupération en lieu sûr".
  - Bouton "Activer la 2FA" (grisé tant que checkbox décochée).

### 4.5 Écran : Onboarding wizard (4 étapes)

**URL** : `/onboarding/setup`

Layout : centré, max-width 720px, fond clair, carte avec stepper visible en haut.

**Étape 1/4 : Informations légales**
- Nom commercial (text)
- Raison sociale (text, requis)
- Forme juridique (select : SAS, SARL, SA, EURL, SASU, Auto-entrepreneur, Association, Autre)
- SIRET (input avec formatage automatique XXX XXX XXX XXXXX, validation Luhn 14 chiffres)
- N° TVA intra (input, format FR + 11 chiffres, validation algorithmique)
- Code APE/NAF (optionnel, autocomplete depuis liste officielle)
- Adresse siège social (autocomplete Google Places restreint FR)

**Étape 2/4 : Identité visuelle**
- Upload logo (drop zone, PNG/SVG/JPG, < 2 Mo, redimensionnement auto)
- Couleur principale (color picker, défaut #0F2644)
- Couleur secondaire (color picker, défaut #F5A623)
- Aperçu en temps réel d'une mini-facture avec ces éléments

**Étape 3/4 : Première agence**
- Nom (text, ex : "Montpellier")
- Code court (text, 3 lettres maj, ex : "MTP")
- Adresse
- Téléphone
- Email
- Codes postaux desservis (chips additionnables, ex : "34000, 34070, ...")
- Métiers (multi-select avec chips emoji : 🔧 Plomberie, ⚡ Électricité, etc.)
- Bouton "Ajouter une autre agence ?" (peut être fait plus tard depuis paramètres)

**Étape 4/4 : Inviter l'équipe**
- Section "Inviter votre équipe (optionnel)"
- Pour chaque ligne : email, prénom (optionnel), nom (optionnel), rôle (select)
- Bouton "+ Ajouter une ligne"
- Bouton "Passer cette étape"
- Bouton "Envoyer les invitations et terminer"

**Validation par étape** :
- Étape 1 : SIRET et raison sociale obligatoires, validation format.
- Étape 2 : tout optionnel, on peut passer.
- Étape 3 : nom + adresse + métiers obligatoires.
- Étape 4 : tout optionnel.

**Persistance** :
- Chaque étape sauvegarde en draft dans `organizations.settings.onboarding_state`.
- Permet de reprendre au même endroit en cas d'abandon.

---

## 5. Matrice rôles × permissions du module Auth

| Action | owner | admin | accountant | technician | viewer |
|---|---|---|---|---|---|
| Se connecter | ✅ | ✅ | ✅ | ✅ | ✅ |
| MFA obligatoire | ✅ | ✅ | ✅ | ❌ | ❌ |
| Inviter un membre owner | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un accountant | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inviter un technician | ✅ | ✅ (sur ses agences) | ❌ | ❌ | ❌ |
| Inviter un viewer | ✅ | ✅ | ❌ | ❌ | ❌ |
| Révoquer un membre | ✅ | ✅ (sauf owner) | ❌ | ❌ | ❌ |
| Modifier le rôle d'un membre | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir la liste des membres | ✅ | ✅ | ✅ | ❌ | ✅ |
| Modifier les paramètres organisation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir le journal d'audit | ✅ | ✅ (de son périmètre) | ❌ | ❌ | ❌ |
| Supprimer l'organisation | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Templates email (Resend)

Tous les emails partagent un template de base : en-tête avec logo organisation, footer avec mentions légales et lien désinscription. Variables `{{}}`.

### 6.1 Email : Invitation à rejoindre

```
Sujet : {{org_name}} vous invite à rejoindre LMS Gestion

Bonjour {{first_name|"là"}},

{{inviter_name}} ({{inviter_role}}) vous invite à rejoindre {{org_name}}
sur LMS Gestion en tant que {{role_label}}.

{{#if message}}
> {{message}}
{{/if}}

[ Accepter l'invitation ]

Ce lien est valable 7 jours et expire le {{expiry_date}}.

Si vous ne connaissez pas {{inviter_name}} ou si vous pensez que cet
email a été envoyé par erreur, ignorez-le simplement.

—
LMS Gestion · La Maison des Services
{{footer}}
```

### 6.2 Email : Bienvenue après création de compte

```
Sujet : Bienvenue sur LMS Gestion, {{first_name}} !

Bonjour {{first_name}},

Votre compte sur LMS Gestion est maintenant actif.

Vous êtes connecté à : {{org_name}}
Votre rôle : {{role_label}}
{{#if agencies}}Vos agences : {{agencies_list}}{{/if}}

[ Aller à mon tableau de bord ]

Quelques liens utiles :
- Centre d'aide : {{help_url}}
- Politique de confidentialité : {{privacy_url}}

Bonne utilisation !
—
L'équipe LMS Gestion
```

### 6.3 Email : Demande de réinitialisation mot de passe

```
Sujet : Réinitialisation de votre mot de passe LMS Gestion

Bonjour,

Vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe
du compte associé à cet email.

[ Réinitialiser mon mot de passe ]

Ce lien expire dans 1 heure.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email :
votre mot de passe restera inchangé.

—
LMS Gestion
```

### 6.4 Email : Lien magique de connexion

```
Sujet : Votre lien de connexion à LMS Gestion

Bonjour,

Voici votre lien de connexion à LMS Gestion. Il est valable 15 minutes
et à usage unique.

[ Se connecter ]

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

—
LMS Gestion
```

### 6.5 Email : MFA activée

```
Sujet : 🛡️ Authentification à deux facteurs activée

Bonjour {{first_name}},

L'authentification à deux facteurs vient d'être activée sur votre
compte LMS Gestion.

Date : {{datetime}}
Appareil : {{device}}
Adresse IP : {{ip}}

Si ce n'était pas vous, contactez immédiatement votre administrateur
et changez votre mot de passe.

—
LMS Gestion
```

### 6.6 Email : Mot de passe modifié

```
Sujet : Votre mot de passe a été modifié

Bonjour {{first_name}},

Votre mot de passe LMS Gestion a été modifié.

Date : {{datetime}}
Adresse IP : {{ip}}

Si ce n'était pas vous, votre compte est peut-être compromis.
Réinitialisez immédiatement votre mot de passe :

[ Réinitialiser mon mot de passe ]

—
LMS Gestion
```

### 6.7 Email : Nouvelle connexion détectée

Envoyé si connexion depuis une nouvelle IP ou un nouveau device.

```
Sujet : Nouvelle connexion à votre compte LMS Gestion

Bonjour {{first_name}},

Une nouvelle connexion a été détectée sur votre compte.

Date : {{datetime}}
Localisation approximative : {{location}}
Navigateur : {{browser}}
Adresse IP : {{ip}}

Si c'était vous, vous pouvez ignorer cet email.

Sinon, [ Sécurisez votre compte ] immédiatement.

—
LMS Gestion
```

---

## 7. Sécurité et obligations

### 7.1 Hashage et stockage
- Mots de passe : bcrypt cost 12 (géré par Supabase Auth).
- Codes de récupération MFA : hashés en SHA-256, comparaison à temps constant.
- Tokens d'invitation : 32 bytes random + base64url, hashés en DB.
- Tokens de reset password : 32 bytes random, expirent à 1h, à usage unique.

### 7.2 Rate limiting
- Login : 5 tentatives / 15 min par IP, 10 / heure par email, lockout 15 min après dépassement.
- Magic link : 3 demandes / 10 min par email.
- Reset password : 3 demandes / heure par email.
- Inscription via invitation : 5 / heure par IP.
- Implémentation : Upstash Redis avec sliding window.

### 7.3 Sessions
- JWT signé par Supabase, durée 1h.
- Refresh token rotation, durée 7 jours par défaut.
- Si "Se souvenir de moi" coché : refresh token 30 jours.
- Sessions stockées avec metadata (IP, user-agent, dernière activité).
- Page "Sessions actives" en paramètres → possibilité de révoquer.
- Inactivité 60 min sur l'UI → modal de re-connexion (config par organisation).

### 7.4 Step-up authentication
Re-saisie du mot de passe ou TOTP exigée pour :
- Modifier le mot de passe.
- Activer/désactiver MFA.
- Changer l'email de l'organisation.
- Supprimer un membre owner.
- Supprimer l'organisation.
- Exporter toutes les données.

### 7.5 Audit log
Toutes ces actions sont loggées dans `activity_logs` :
- Login réussi (info).
- Login échoué (info, masque le mot de passe).
- Logout (info).
- Mot de passe modifié (info).
- MFA activé / désactivé (info).
- Invitation envoyée (info).
- Invitation acceptée (info).
- Invitation révoquée (info).
- Membre supprimé (warning).
- Tentative login après lockout (warning).
- Reset password demandé (info).

### 7.6 RGPD
- Cookie de session : strict, http-only, secure, sameSite=lax.
- Pas de tracker tiers sans consentement explicite.
- Page "Mes données" :
  - Export de toutes les données utilisateur (JSON).
  - Suppression de compte (anonymisation des entités liées).
- Délai de conservation des comptes inactifs : 24 mois après dernière connexion → email de relance puis suppression à 36 mois.
- Logs IP : conservés 12 mois maximum.

---

## 8. États d'erreur et edge cases

| Cas | Comportement attendu |
|---|---|
| Lien d'invitation périmé (>7j) | Page dédiée : "Cette invitation a expiré. Demandez à votre administrateur d'en envoyer une nouvelle." + bouton contact admin |
| Lien d'invitation déjà utilisé | "Cette invitation a déjà été acceptée. Connectez-vous." → CTA login |
| Email invité = email existant dans une autre org | "Cet email est déjà associé à un compte. Connectez-vous puis acceptez l'invitation depuis votre tableau de bord." |
| Email invité = email existant dans la même org | Au moment de l'invitation côté admin : message "Cette personne fait déjà partie de l'organisation" |
| User désactivé tente de se connecter | "Votre compte a été désactivé. Contactez {{org_admin_email}} pour plus d'informations." |
| MFA setup interrompu (page fermée avant validation) | À la reconnexion suivante : reprise au même endroit |
| Perte de l'appareil MFA | Code de récupération à saisir sur l'écran MFA. Si plus de codes : contact admin platform (toi) pour reset manuel |
| Mot de passe dans la liste des plus communs | Message en temps réel : "Ce mot de passe est trop commun, choisissez-en un autre" |
| Email invalide à l'invitation | Validation côté admin : email invité est rejeté avec message |
| Suppression du dernier owner | Bloqué : "Au moins un owner doit rester dans l'organisation. Promouvez quelqu'un d'autre avant de vous supprimer." |
| Token de reset utilisé 2× | Le 2ᵉ usage retourne erreur "Lien expiré ou déjà utilisé" |
| Login depuis pays inattendu | Email "nouvelle connexion détectée" envoyé (pas de blocage automatique pour éviter les faux positifs) |

---

## 9. Critères d'acceptation par fonctionnalité

### 9.1 Login email/password
- ✅ Un user actif peut se connecter avec email + password valides.
- ✅ Un user désactivé est rejeté avec message générique.
- ✅ Un email inconnu retourne le même message qu'un mot de passe incorrect.
- ✅ Après 5 échecs, lockout 15 min.
- ✅ "Se souvenir de moi" prolonge la session à 30 jours.
- ✅ Le mot de passe peut être affiché/masqué.
- ✅ Pression sur Enter dans le champ password déclenche la connexion.

### 9.2 Login magic link
- ✅ Un email valide reçoit un lien dans < 30 secondes.
- ✅ Le lien expire après 15 min.
- ✅ Le lien est à usage unique.
- ✅ Un email invalide retourne le même message que valide (pas d'énumération).
- ✅ Cooldown de 60s entre 2 demandes.

### 9.3 MFA TOTP
- ✅ Le QR code est valide pour Google Authenticator, Authy, 1Password.
- ✅ La clé secrète est lisible et copiable.
- ✅ Les 10 codes de récupération sont uniques et à usage unique.
- ✅ Le téléchargement PDF des codes fonctionne.
- ✅ Désactiver la MFA exige saisie mot de passe + code TOTP.
- ✅ 3 essais MFA échoués → lockout 5 min.

### 9.4 Invitation
- ✅ Un owner peut inviter tous les rôles.
- ✅ Un admin peut inviter admin, technician, viewer mais pas owner ni accountant.
- ✅ Le lien d'invitation est valide 7 jours.
- ✅ Le lien est à usage unique.
- ✅ L'invité voit le nom de l'organisation et de l'inviteur dans l'email et la page d'acceptation.
- ✅ Une invitation peut être révoquée par l'inviteur tant qu'elle n'est pas acceptée.
- ✅ La liste "Invitations en attente" est visible côté admin.

### 9.5 Onboarding
- ✅ Un owner nouvellement créé est forcé de compléter l'onboarding avant d'accéder à l'app.
- ✅ Le wizard sauvegarde l'état après chaque étape.
- ✅ SIRET invalide est rejeté avec message clair.
- ✅ Le logo uploadé est redimensionné automatiquement.
- ✅ Au moins une agence doit être créée.
- ✅ Les invitations envoyées à l'étape 4 partent en background (Inngest), pas bloquant.

### 9.6 Reset password
- ✅ Toute demande retourne le même message générique.
- ✅ Le lien expire dans 1h.
- ✅ Le lien est à usage unique.
- ✅ Le nouveau mot de passe respecte la politique.
- ✅ Un email de confirmation est envoyé après changement.
- ✅ Toutes les sessions actives sont invalidées après reset.

### 9.7 RLS et isolation
- ✅ Un user ne voit jamais les données d'une autre organisation, même via l'API.
- ✅ Un technician ne voit que ses chantiers (test sur la table chantiers).
- ✅ Un admin d'une agence ne voit pas les agences hors de son périmètre.
- ✅ Test : tentative d'accès direct à une URL de ressource d'autre org → 404.

---

## 10. Métriques à suivre (PostHog)

### 10.1 Événements à logger
- `auth.login_attempted` (props: method=password|magic_link, success=bool)
- `auth.login_succeeded` (props: method, mfa_required=bool)
- `auth.login_failed` (props: method, reason=invalid_credentials|locked|disabled)
- `auth.password_reset_requested`
- `auth.password_reset_completed`
- `auth.mfa_enabled`
- `auth.mfa_disabled`
- `auth.mfa_verified` (props: method=totp|recovery_code)
- `auth.invitation_sent` (props: role)
- `auth.invitation_accepted` (props: hours_to_accept)
- `auth.invitation_expired`
- `auth.onboarding_started`
- `auth.onboarding_step_completed` (props: step=1|2|3|4)
- `auth.onboarding_completed` (props: total_duration_seconds)
- `auth.logout`

### 10.2 KPIs
- Taux d'invitations acceptées sous 48h (objectif : > 70 %).
- Taux de complétion de l'onboarding (objectif : > 90 %).
- Adoption MFA chez les rôles non obligatoires (objectif : > 30 % à 3 mois).
- Nombre de resets password par mois (alerte si > 20 % des users).
- Délai moyen first login → première création d'entité (chantier, client, etc.).

---

## 11. Points ouverts à arbitrer plus tard

- **OAuth Google/Microsoft** : à activer en Phase 2, prévoir le branchement Supabase dès maintenant pour ne pas avoir à modifier la table `users`.
- **SSO entreprise (SAML)** : Phase 4, pour les gros syndics qui ont leur IdP.
- **Magic link sur mobile (deeplink)** : à tester quand l'app React Native arrive (Phase 2).
- **Politique de mot de passe configurable par organisation** : décision à prendre en Phase 4 (certains clients voudront imposer une politique plus stricte).
- **Self-service de l'admin pour reset MFA d'un user** : aujourd'hui ça repasse par toi (admin platform). À automatiser quand le volume le justifiera.
- **Sessions actives visibles et révocables par l'utilisateur** : prévu Phase 1 sprint 14 si temps, sinon Phase 2.

---

*Fin de la spec module 01 — Auth & Onboarding.*
*Prochaine spec : 02-equipe-membres.md (gestion des membres et techniciens).*
