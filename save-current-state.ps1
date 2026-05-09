cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Sauvegarde de l'etat actuel LMS..." -ForegroundColor Cyan

Write-Host ""
Write-Host "Verification Git..." -ForegroundColor Cyan

if (!(Test-Path ".git")) {
  Write-Host "Depot Git introuvable. Initialisation..." -ForegroundColor Yellow
  git init
  git checkout -b main
  git remote add origin https://github.com/lms-gestion/lms-final.git
}

Write-Host ""
Write-Host "Verification des fichiers sensibles..." -ForegroundColor Cyan

$SensitiveFiles = @(
  ".env",
  ".env.local",
  "apps\web\.env",
  "apps\web\.env.local",
  ".env.local.bak",
  "apps\web\.env.local.bak"
)

foreach ($file in $SensitiveFiles) {
  if (Test-Path $file) {
    Write-Host "OK non versionne attendu : $file" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Verification .gitignore..." -ForegroundColor Cyan

$GitignoreContent = @"
node_modules
.next
.turbo
.env
.env.*
*.bak
"@

$CurrentGitignore = ""
if (Test-Path ".gitignore") {
  $CurrentGitignore = Get-Content ".gitignore" -Raw
}

foreach ($line in $GitignoreContent -split "`n") {
  if ($line.Trim() -ne "" -and $CurrentGitignore -notmatch [regex]::Escape($line.Trim())) {
    Add-Content ".gitignore" $line.Trim()
  }
}

Write-Host ""
Write-Host "Etat Git avant sauvegarde :" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "Ajout des fichiers..." -ForegroundColor Cyan
git add .

Write-Host ""
Write-Host "Commit..." -ForegroundColor Cyan
git commit -m "stable mvp auth clients chantiers planning"

Write-Host ""
Write-Host "Push GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host ""
Write-Host "Creation tag de sauvegarde..." -ForegroundColor Cyan

$TagName = "stable-mvp-" + (Get-Date -Format "yyyyMMdd-HHmm")

git tag $TagName
git push origin $TagName

Write-Host ""
Write-Host "Sauvegarde terminee." -ForegroundColor Green
Write-Host "Branche : main" -ForegroundColor Green
Write-Host "Tag : $TagName" -ForegroundColor Green
Write-Host "Repo : https://github.com/lms-gestion/lms-final" -ForegroundColor Green