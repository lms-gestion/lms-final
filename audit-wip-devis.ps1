cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Audit branche WIP Devis..." -ForegroundColor Cyan

Write-Host ""
Write-Host "Verification branche actuelle..." -ForegroundColor Cyan
git branch --show-current

Write-Host ""
Write-Host "Passage sur wip-devis-claude..." -ForegroundColor Cyan
git checkout wip-devis-claude

Write-Host ""
Write-Host "Nettoyage cache..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Verification fichiers Devis..." -ForegroundColor Cyan

$files = @(
  "apps\web\lib\trpc\routers\quotes.ts",
  "apps\web\app\(app)\devis\page.tsx",
  "apps\web\app\(app)\devis\quotes-list-client.tsx",
  "apps\web\app\(app)\devis\new\page.tsx",
  "apps\web\app\(app)\devis\new\quote-create-client.tsx",
  "apps\web\app\(app)\devis\[id]\page.tsx",
  "apps\web\app\(app)\devis\[id]\quote-detail-client.tsx"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    Write-Host "OK : $file" -ForegroundColor Green
  } else {
    Write-Host "MANQUANT : $file" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Recherche caracteres casses..." -ForegroundColor Cyan

$badPatterns = @("ð", "â†", "â€™", "Ã©", "Ã¨", "Ãª", "Ã ", " ")
$found = @()

Get-ChildItem ".\apps\web\app\(app)\devis", ".\apps\web\lib\trpc\routers" -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | ForEach-Object {
  $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
  foreach ($pattern in $badPatterns) {
    if ($content -like "*$pattern*") {
      $found += "$($_.FullName) contient $pattern"
    }
  }
}

if ($found.Count -gt 0) {
  Write-Host "Caracteres suspects trouves :" -ForegroundColor Red
  $found | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "OK : aucun caractere casse detecte." -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification TypeScript / build..." -ForegroundColor Cyan

pnpm --filter @lms/web build *> audit-wip-devis-output.txt

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK : build web reussi." -ForegroundColor Green
} else {
  Write-Host "ERREUR : build web en echec. Ouverture du rapport..." -ForegroundColor Red
  notepad .\audit-wip-devis-output.txt
  exit 1
}

Write-Host ""
Write-Host "Audit termine avec succes." -ForegroundColor Green
Write-Host "Tu peux maintenant tester :" -ForegroundColor Green
Write-Host "npm run dev" -ForegroundColor Green
Write-Host "http://localhost:3000/devis" -ForegroundColor Green