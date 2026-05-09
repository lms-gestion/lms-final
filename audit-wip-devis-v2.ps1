cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Audit branche WIP Devis..." -ForegroundColor Cyan

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
Write-Host "Recherche caracteres suspects simples..." -ForegroundColor Cyan

$found = @()
$searchPaths = @(
  "apps\web\app\(app)\devis",
  "apps\web\lib\trpc\routers"
)

foreach ($path in $searchPaths) {
  if (Test-Path $path) {
    Get-ChildItem $path -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue | ForEach-Object {
      $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue

      if ($content -match "Ã|Â|ð| ") {
        $found += $_.FullName
      }
    }
  }
}

if ($found.Count -gt 0) {
  Write-Host "Fichiers suspects trouves :" -ForegroundColor Red
  $found | Sort-Object -Unique | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "OK : aucun caractere suspect simple detecte." -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification TypeScript / build..." -ForegroundColor Cyan

pnpm --filter "@lms/web" build *> audit-wip-devis-output.txt

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK : build web reussi." -ForegroundColor Green
} else {
  Write-Host "ERREUR : build web en echec. Ouverture du rapport..." -ForegroundColor Red
  notepad .\audit-wip-devis-output.txt
  exit 1
}

Write-Host ""
Write-Host "Audit termine avec succes." -ForegroundColor Green
Write-Host "Tu peux maintenant lancer : npm run dev" -ForegroundColor Green
Write-Host "Puis tester : http://localhost:3000/devis" -ForegroundColor Green