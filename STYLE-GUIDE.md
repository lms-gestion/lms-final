# Style Guide — UI / UX

Référence visuelle pour garder une cohérence à travers tous les écrans.

---

## Charte graphique

### Couleurs principales

| Token | Hex | Usage |
|---|---|---|
| `--brand-blue` | `#0F2644` | Couleur primaire, headers, boutons principaux |
| `--brand-dark` | `#07172f` | Sidebar fond, dégradés foncés |
| `--brand-dark2` | `#09265a` | Sidebar dégradé intermédiaire |
| `--brand-blue-mid` | `#1554a6` | Liens, états hover |
| `--brand-gold` | `#F5A623` | CTA, badges premium, accent |
| `--brand-orange` | `#F97316` | Boutons d'action, urgence légère |
| `--brand-orange-dark` | `#ea580c` | États hover des boutons orange |
| `--brand-blue-light` | `#e8f2ff` | Background cards info, hovers |

### Couleurs sémantiques

| Token | Hex | Usage |
|---|---|---|
| Vert succès | `#16a34a` | Confirmations, badges "payée", "terminé" |
| Orange warning | `#f59e0b` | Avertissements, échéances proches |
| Rouge erreur | `#dc2626` | Urgences, factures en retard, suppressions |
| Cyan info | `#0ea5e9` | Statuts neutres, "nouveau" |

### Typographie

- **Police principale** : Inter (Google Fonts, variable font pour 100-900)
- **Tailles standard** :
  - `text-xs` (12px) : labels, badges, méta
  - `text-sm` (14px) : corps standard
  - `text-base` (16px) : textes lus longs
  - `text-lg` (18px) à `text-3xl` (30px) : titres
- **Hiérarchie** :
  - h1 : 24px / 700 / tracking-tight
  - h2 : 20px / 700
  - h3 : 16px / 600
  - body : 14px / 400

### Espacements

Système basé sur **4px** (Tailwind défaut).
- Écran à écran : 24px (`p-6`)
- Card padding : 24px (`p-6`)
- Form gap : 16px (`gap-4`)
- Button padding : `px-4 py-2`
- Inline gap : 8px (`gap-2`)

### Border radius

- **Card** : `rounded-lg` (8px)
- **Button** : `rounded-md` (6px)
- **Input** : `rounded-md` (6px)
- **Badge / chip** : `rounded-full`
- **Avatar** : `rounded-full`

### Ombres

| Token | Tailwind | Usage |
|---|---|---|
| `--sh` | `shadow-sm` | Cards de base |
| `--shm` | `shadow-md` | Hover cards |
| `--shl` | `shadow-xl` | Modals, popovers |

---

## Composants

### Boutons

```tsx
<Button>Default (bleu marine)</Button>
<Button variant="orange">Action principale (CTA)</Button>
<Button variant="outline">Secondaire</Button>
<Button variant="ghost">Tertiaire (peu visible)</Button>
<Button variant="destructive">Suppression</Button>
```

Tailles : `default | sm | lg | xl | icon`.

### Statuts (chips)

| Type | Class | Usage |
|---|---|---|
| `b-blue` | bg-blue-100 text-blue-700 | Information neutre |
| `b-green` | bg-green-100 text-green-700 | Succès, payé, terminé |
| `b-amber` | bg-amber-100 text-amber-800 | Attention, en attente |
| `b-red` | bg-red-100 text-red-700 | Erreur, urgence, en retard |
| `b-gray` | bg-slate-100 text-slate-700 | Neutre, archivé |
| `b-orange` | bg-orange-100 text-orange-700 | Action requise |

### Avatars

- Photo si disponible, sinon initiales en chiffres blancs sur fond couleur déterministe (cf. `getColorForName()`).
- Tailles : 20px (kanban), 28px (sidebar), 32px (fiches), 48px (settings profile).

### Formulaires

- Labels au-dessus, `text-xs font-bold uppercase tracking-wider`.
- Inputs : 40px de hauteur (`h-10`), `rounded-md`, border-input.
- Erreurs : message rouge sous le champ, en `text-xs`.
- Champs requis : asterisque rouge `*` après le label.

### Tableaux

- Header : `bg-muted`, font-bold, uppercase, tracking-wider, text-xs.
- Lignes : hover bleu très clair, cursor-pointer si cliquables.
- Padding cellule : `px-4 py-2.5`.

### Cards

- `border` + `bg-card` + `rounded-lg` + `shadow-sm`.
- Header en haut avec titre h3 + actions à droite.
- Padding 24px.

---

## Iconographie

- **Lucide React** uniquement (pas d'autres bibliothèques).
- Tailles : 14, 16, 20, 24, 32px selon contexte.
- Couleur : hérite du parent par défaut.
- Strokes : `strokeWidth={1.5}` ou `2` selon importance.

### Métiers (emoji standardisés)

🔧 Plomberie · ⚡ Électricité · 🏠 Toiture · 🔒 Serrurerie · 🪵 Menuiserie · 🎨 Peinture · 🧱 Maçonnerie · 🏢 Syndics

---

## Tonalité

- **Tutoiement** côté admin/owner (équipe interne).
- **Vouvoiement** côté pages publiques (clients, devis, factures).
- Phrases courtes, voix active.
- Pas de jargon technique sauf en paramètres avancés.
- Les erreurs expliquent ce qu'il faut faire, pas juste ce qui s'est passé.

### Exemples

Bon ✅ : "Saisissez un email valide pour continuer."
Mauvais ❌ : "Validation échouée."

Bon ✅ : "Cette facture est émise et ne peut plus être modifiée. Pour corriger, créez un avoir."
Mauvais ❌ : "Modification interdite."

---

## Accessibilité (a11y)

- Tous les inputs ont un `<label>` associé.
- Les images ont un `alt` (sauf décoratives → `alt=""`).
- Contraste WCAG AA minimum (4.5:1 sur texte normal, 3:1 sur grand texte).
- Navigation clavier complète (focus visible).
- ARIA labels sur les boutons icon-only.
- Pas de `outline: none` sans focus alternatif.

---

## Mobile

- Mobile-first sur les pages publiques (`/q/`, `/i/`, `/bi/`, `/invitation/`).
- Sidebar repliée sur mobile, drawer animé.
- Touch targets : 44×44px minimum.
- FAB orange en bas à droite pour actions principales.
- Largeur max contenu : 1400px sur desktop (`container 2xl`).

---

*À enrichir au fur et à mesure des sprints.*
