# 👋 Bienvenue ! Par où commencer ?

Tu as 3 options selon ce que tu veux faire **maintenant** :

---

## 🎨 Option 1 — Voir l'app sans rien installer (30 secondes)

**Double-clique sur** `preview.html` à la racine du dossier.

Tu verras un aperçu fonctionnel des écrans clés (login, onboarding, dashboard, kanban, clients, factures, invitation) directement dans ton navigateur. C'est un mockup statique mais visuellement fidèle.

---

## ⚙️ Option 2 — Lancer la vraie app en local (recommandé, ~45 min)

**Double-clique sur** `setup.ps1`.

Si Windows demande une autorisation pour exécuter le script :
1. Clic droit sur `setup.ps1` → **Propriétés** → coche **Débloquer** → OK.
2. Re-double-clique.

Sinon ouvre PowerShell dans ce dossier et tape :
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Le script :
- vérifie Node.js (te guide pour l'installer si besoin),
- installe pnpm automatiquement,
- nettoie l'ancien node_modules,
- installe toutes les dépendances,
- prépare ton fichier `.env.local`,
- te guide vers Supabase pour finir la config.

À la fin tu auras juste à :
1. Créer un compte gratuit sur [supabase.com](https://supabase.com) (région Frankfurt).
2. Coller 4 valeurs dans `.env.local`.
3. Taper `pnpm db:migrate` puis `pnpm dev`.

→ App live sur http://localhost:3000

---

## 📚 Option 3 — Lire les specs avant de coder

Tout est dans `docs/` :
- `CADRAGE-PHASE-1.md` — décisions techniques et roadmap (16 sprints).
- `specs/01-auth-onboarding.md` à `12-recherche-vue-ensemble.md` — spec produit complète (~700 pages).

Pour les ouvrir formatés : clic droit → Ouvrir avec → Chrome.

---

## 🆘 En cas de problème

- `RUNBOOK.md` — procédures pour les bugs courants.
- `SETUP.md` — guide de setup détaillé (alternative au script).
- Ton dev de secours expert.

---

*Bon courage et bonne route avec LMS Gestion !*
