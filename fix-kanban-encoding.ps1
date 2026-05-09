cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Correction encodage Kanban..." -ForegroundColor Cyan

$Router = "apps\web\lib\trpc\routers\chantiers.ts"

if (!(Test-Path $Router)) {
  Write-Host "ERREUR : fichier chantiers.ts introuvable" -ForegroundColor Red
  exit 1
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
$Content = [System.IO.File]::ReadAllText($Router, [System.Text.Encoding]::UTF8)

# Supprime les emojis des colonnes par defaut pour eviter les caracteres casses
$Content = [regex]::Replace($Content, "emoji:\s*'[^']*'", "emoji: null")
$Content = [regex]::Replace($Content, 'emoji:\s*"[^"]*"', "emoji: null")

[System.IO.File]::WriteAllText($Router, $Content, $Utf8NoBom)

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan

git add apps\web\lib\trpc\routers\chantiers.ts
git commit -m "fix kanban column encoding"
git push origin main

Write-Host ""
Write-Host "Correction code terminee." -ForegroundColor Green
Write-Host "Il reste a lancer le script SQL Supabase ci-dessous." -ForegroundColor Yellow