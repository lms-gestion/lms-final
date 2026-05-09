cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Verification des caracteres casses..." -ForegroundColor Cyan

$badPatterns = @(
  "ð",
  "â†",
  "â€™",
  "Ã©",
  "Ã¨",
  "Ãª",
  "Ã ",
  " "
)

$files = Get-ChildItem ".\apps", ".\packages" -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.md,*.html,*.css -ErrorAction SilentlyContinue |
Where-Object {
  $_.FullName -notmatch "node_modules|\.next|\.turbo|\.git"
}

$found = @()

foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue

  foreach ($pattern in $badPatterns) {
    if ($content -like "*$pattern*") {
      $found += "$($file.FullName) contient $pattern"
    }
  }
}

if ($found.Count -gt 0) {
  Write-Host ""
  Write-Host "Caracteres suspects trouves :" -ForegroundColor Red
  $found | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "OK : aucun caractere casse detecte." -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification Git..." -ForegroundColor Cyan

git status

Write-Host ""
Write-Host "Sauvegarde GitHub..." -ForegroundColor Cyan

git add .
git commit -m "fix encoding and stabilize chantiers kanban"
git push origin main

Write-Host ""
Write-Host "Verification terminee." -ForegroundColor Green
Write-Host "Si git dit 'nothing to commit', c'est normal : tout etait deja sauvegarde." -ForegroundColor Green