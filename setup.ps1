# ═══════════════════════════════════════════════════════════════════
# LMS Gestion — Setup automatique Windows
# Usage : clic droit sur ce fichier → "Exécuter avec PowerShell"
# Ou bien : ouvrir PowerShell ici, taper : .\setup.ps1
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "LMS Gestion — Setup"

function Print-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Print-Step    { param([string]$Text) Write-Host "  ► $Text" -ForegroundColor White }
function Print-OK      { param([string]$Text) Write-Host "  ✓ $Text" -ForegroundColor Green }
function Print-Warning { param([string]$Text) Write-Host "  ⚠ $Text" -ForegroundColor Yellow }
function Print-Error   { param([string]$Text) Write-Host "  ✗ $Text" -ForegroundColor Red }
function Print-Info    { param([string]$Text) Write-Host "  ℹ $Text" -ForegroundColor Cyan }

Print-Title "🚀 LMS Gestion — Installation automatique"

# ─── Étape 1 : Vérifier qu'on est dans le bon dossier ───
$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

if (-not (Test-Path "package.json")) {
    Print-Error "package.json introuvable dans $RepoRoot"
    Print-Error "Place ce script à la racine du projet et réessaye."
    Read-Host "Appuie sur Entrée pour fermer"
    exit 1
}
Print-OK "Dossier projet OK : $RepoRoot"

# ─── Étape 2 : Vérifier Node.js ───
Print-Title "📦 Étape 1/5 — Vérification de Node.js"

$nodeVersion = $null
try {
    $nodeVersion = (& node --version 2>$null) -replace 'v', ''
} catch {}

if (-not $nodeVersion) {
    Print-Error "Node.js n'est pas installé."
    Print-Info "Télécharge la version LTS sur : https://nodejs.org"
    Print-Info "Choisis la version 20.x (ou 22.x), installe, puis relance ce script."

    $openBrowser = Read-Host "Veux-tu ouvrir le site nodejs.org maintenant ? (O/n)"
    if ($openBrowser -ne "n") {
        Start-Process "https://nodejs.org/"
    }
    Read-Host "Appuie sur Entrée pour fermer"
    exit 1
}

$majorVersion = [int]($nodeVersion.Split('.')[0])
if ($majorVersion -lt 20) {
    Print-Error "Node.js trop ancien (v$nodeVersion). Version 20+ requise."
    Print-Info "Mets à jour depuis https://nodejs.org"
    Read-Host "Appuie sur Entrée pour fermer"
    exit 1
}
Print-OK "Node.js v$nodeVersion"

# ─── Étape 3 : Installer pnpm via corepack ───
Print-Title "📦 Étape 2/5 — Installation de pnpm"

$pnpmVersion = $null
try {
    $pnpmVersion = (& pnpm --version 2>$null)
} catch {}

if (-not $pnpmVersion) {
    Print-Step "Activation de corepack (gestionnaire pnpm intégré à Node)..."
    & corepack enable 2>$null
    Print-Step "Installation de pnpm 9.12.0..."
    & corepack prepare pnpm@9.12.0 --activate 2>$null

    try { $pnpmVersion = (& pnpm --version 2>$null) } catch {}

    if (-not $pnpmVersion) {
        Print-Warning "Corepack n'a pas suffi. Tentative avec npm..."
        & npm install -g pnpm@9.12.0
        try { $pnpmVersion = (& pnpm --version 2>$null) } catch {}
    }
}

if (-not $pnpmVersion) {
    Print-Error "Impossible d'installer pnpm automatiquement."
    Print-Info "Lance manuellement : npm install -g pnpm@9.12.0"
    Read-Host "Appuie sur Entrée pour fermer"
    exit 1
}
Print-OK "pnpm v$pnpmVersion"

# ─── Étape 4 : Supprimer l'ancien node_modules de l'Electron ───
Print-Title "🧹 Étape 3/5 — Nettoyage"

if (Test-Path "node_modules") {
    Print-Step "Suppression de l'ancien node_modules (héritage Electron)..."
    try {
        Remove-Item -Recurse -Force node_modules -ErrorAction Stop
        Print-OK "Ancien node_modules supprimé"
    } catch {
        Print-Warning "Impossible de supprimer node_modules (fichiers verrouillés ?)"
        Print-Info "Essaye de fermer Visual Studio Code et tout terminal, puis relance."
    }
} else {
    Print-OK "Pas d'ancien node_modules à nettoyer"
}

# ─── Étape 5 : pnpm install ───
Print-Title "📥 Étape 4/5 — Installation des dépendances (~3-5 min)"
Print-Info "Téléchargement de toutes les librairies. Patience..."

& pnpm install
if ($LASTEXITCODE -ne 0) {
    Print-Error "pnpm install a échoué"
    Print-Info "Voir RUNBOOK.md section 'pnpm install échoue'"
    Read-Host "Appuie sur Entrée pour fermer"
    exit 1
}
Print-OK "Dépendances installées"

# ─── Étape 6 : Configurer .env.local ───
Print-Title "🔐 Étape 5/5 — Configuration des variables"

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Print-OK ".env.local créé depuis .env.example"
} else {
    Print-OK ".env.local existe déjà — pas de modification"
}

# ─── Récap ───
Print-Title "🎉 Installation terminée !"

Write-Host "  Prochaines étapes :" -ForegroundColor White
Write-Host ""
Write-Host "  1. Crée ton compte Supabase (gratuit) :" -ForegroundColor White
Write-Host "     https://supabase.com → New project → région Frankfurt" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Récupère 4 valeurs depuis Supabase :" -ForegroundColor White
Write-Host "     · Project URL → NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Gray
Write-Host "     · anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Gray
Write-Host "     · service_role key → SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Gray
Write-Host "     · Connection string (URI) → DATABASE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Édite le fichier .env.local et colle les valeurs :" -ForegroundColor White
Write-Host "     notepad .env.local" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Initialise la base de données :" -ForegroundColor White
Write-Host "     pnpm db:migrate" -ForegroundColor Yellow
Write-Host "     pnpm db:seed" -ForegroundColor Yellow
Write-Host ""
Write-Host "  5. Lance l'app :" -ForegroundColor White
Write-Host "     pnpm dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  → Puis ouvre http://localhost:3000 dans ton navigateur." -ForegroundColor Cyan
Write-Host ""

$openSetup = Read-Host "Veux-tu ouvrir le guide SETUP.md détaillé maintenant ? (O/n)"
if ($openSetup -ne "n") {
    if (Test-Path "SETUP.md") {
        Start-Process "SETUP.md"
    }
}

$openSupabase = Read-Host "Veux-tu ouvrir Supabase pour créer ton projet ? (O/n)"
if ($openSupabase -ne "n") {
    Start-Process "https://supabase.com/dashboard/projects"
}

$openPreview = Read-Host "Veux-tu ouvrir l'aperçu HTML de l'app maintenant ? (O/n)"
if ($openPreview -ne "n") {
    if (Test-Path "preview.html") {
        Start-Process "preview.html"
    }
}

Write-Host ""
Print-OK "À tout à l'heure !"
Write-Host ""
Read-Host "Appuie sur Entrée pour fermer cette fenêtre"
