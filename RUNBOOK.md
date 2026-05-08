# RUNBOOK — Procédures opérationnelles

Document de référence pour les incidents, débogages, restaurations.
À garder à portée de main.

---

## 0. Numéros utiles

| Service | URL | Quand l'utiliser |
|---|---|---|
| Vercel | https://vercel.com/dashboard | Status déploiement, logs runtime |
| Supabase | https://supabase.com/dashboard/projects | DB, Auth, Storage, RLS |
| Resend | https://resend.com/emails | Logs emails envoyés |
| Sentry | https://sentry.io | Erreurs runtime |
| PostHog | https://eu.posthog.com | Analytics |
| Status PostgreSQL | https://status.supabase.com | Pannes Supabase |
| Status Vercel | https://www.vercel-status.com | Pannes Vercel |

---

## 1. Problèmes courants

### `pnpm install` échoue

**Symptômes** : erreurs ENOENT, EACCES, mismatch versions.

**Causes possibles** :
1. Reliquat `node_modules` de l'Electron à la racine → supprime-le manuellement (Windows : clic droit → Supprimer).
2. Mauvaise version Node → `nvm use` ou installe Node 20.10+.
3. Cache pnpm corrompu → `pnpm store prune`.
4. Lockfile corrompu → supprime `pnpm-lock.yaml` puis `pnpm install`.

### Migrations Drizzle échouent

```
Error: relation "..." already exists
```
→ Tu as déjà appliqué des migrations partiellement. Solution :
1. `psql $DATABASE_URL` puis `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
2. Re-applique : `pnpm db:migrate` puis `psql $DATABASE_URL -f infra/supabase/rls.sql`.

```
Error: extension "uuid-ossp" does not exist
```
→ Sur Supabase, va dans Database → Extensions → active `uuid-ossp` et `pgcrypto`.

### Login ne fonctionne pas

**Symptôme** : "Identifiant ou mot de passe incorrect" alors que les credentials sont bons.

**Diagnostic** :
1. Va dans Supabase → Authentication → Users : le user existe-t-il ?
2. Si non confirmé (colonne `email_confirmed_at` vide), va dans le user → "Send invitation" ou décoche l'obligation de confirmation.
3. Vérifie les logs : Vercel → Logs ou local console.

### "Aucune organisation" après login

**Symptôme** : redirection en boucle vers `/onboarding`.

**Cause** : pas de `memberships` actif.

**Fix** :
```sql
-- Vérifie la membership
SELECT m.*, o.name FROM memberships m
JOIN organizations o ON o.id = m.organization_id
WHERE user_id = 'TON_UUID';

-- Si rien, soit refais l'onboarding, soit crée manuellement :
INSERT INTO memberships (user_id, organization_id, role, is_active)
VALUES ('USER_UUID', 'ORG_UUID', 'owner', true);
```

### Erreur RLS "permission denied"

**Symptôme** : requêtes tRPC retournent vide ou 403.

**Diagnostic** :
1. Vérifie que le JWT contient `org_id` (Supabase → Authentication → JWT Custom claims).
2. Vérifie les policies : `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public';`
3. Vérifie qu'une membership active existe pour ce user dans cette org.

**Fix temporaire** (DEV uniquement, jamais en prod) :
```sql
ALTER TABLE chantiers DISABLE ROW LEVEL SECURITY;
-- … debug …
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
```

### Sentry inonde de bruit

→ Ajuste les `ignoreErrors` dans `sentry.client.config.ts` et le `tracesSampleRate`.

---

## 2. Procédures d'incident

### Incident niveau P1 — App inaccessible en prod

1. **Vérifier le status** : status.vercel-status.com et status.supabase.com.
2. **Logs Vercel** : Dashboard → Project → Logs → 5 dernières minutes.
3. **Logs Sentry** : derniers événements.
4. **Si Vercel down** : afficher une page de maintenance (à préparer en avance).
5. **Si Supabase down** : pas grand-chose à faire à part attendre + communiquer aux utilisateurs.
6. **Si déploiement cassé** : `vercel rollback` ou re-déploie le commit précédent.

### Incident niveau P2 — Bug fonctionnel bloquant

1. Reproduire en local.
2. Ouvrir une issue GitHub avec étapes de reproduction.
3. Hotfix sur branche `hotfix/...` → PR → merge → deploy auto.

### Restauration backup DB

Supabase fait des backups quotidiens automatiques (Pro plan).

1. Dashboard Supabase → Database → Backups.
2. Choisir le point de restauration.
3. **⚠️ La restauration écrase tout.** Préviens les utilisateurs avant.
4. Après restauration : re-applique les migrations récentes si nécessaire et `infra/supabase/rls.sql`.

### Désactiver l'IA en urgence

Si Claude API explose en coût ou retourne du n'importe quoi :

```sql
UPDATE organization_settings
SET ai_settings = jsonb_set(ai_settings, '{enabled}', 'false')
WHERE organization_id = 'ORG_UUID';
```

Ou globalement par variable d'env Vercel : `ANTHROPIC_API_KEY` → vide → redeploy.

### Bloquer un user immédiatement

```sql
UPDATE memberships SET is_active = false WHERE user_id = 'USER_UUID';
```

Ses sessions actuelles deviennent invalides au prochain refresh JWT (max 1h).

Pour invalider immédiatement :
```sql
DELETE FROM auth.refresh_tokens WHERE user_id = 'USER_UUID';
```

---

## 3. Maintenance hebdomadaire

À faire chaque lundi (ou job automatisé Inngest) :

- [ ] Vérifier les backups Supabase ont bien tourné.
- [ ] Scanner les logs Sentry — résoudre les erreurs récurrentes.
- [ ] Vérifier la consommation Vercel et Supabase (limites plan).
- [ ] Vérifier les jobs Inngest (relances, expiration devis).
- [ ] Test de restauration backup en environnement isolé une fois par mois.

---

## 4. Sécurité

### Rotation d'un secret compromis

Si une clé fuit :
1. **Anthropic** : `console.anthropic.com` → API Keys → révoquer + créer nouvelle → mettre à jour Vercel/local.
2. **Resend** : `resend.com/api-keys` → révoquer + créer nouvelle.
3. **Supabase service_role** : `Settings → API → Reset` → met à jour partout (DANGER, attention coupure).
4. **Anciens .env.local** : supprimer toute trace.

### Audit de sécurité rapide

```bash
pnpm audit
```

Patcher toute vulnérabilité High ou Critical.

---

## 5. Contacts

- **Dev de secours expert** : à compléter (nom + tel + email)
- **Anthropic support** : support@anthropic.com
- **Supabase support** : disponible dans le dashboard

---

*Document à mettre à jour à chaque incident résolu.*
