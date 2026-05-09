cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Sauvegarde WIP des modifications Claude - Devis..." -ForegroundColor Cyan

Write-Host ""
Write-Host "Etat actuel Git :" -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "Creation branche WIP..." -ForegroundColor Cyan

git checkout -B wip-devis-claude

Write-Host ""
Write-Host "Ajout des fichiers modifies..." -ForegroundColor Cyan

git add .

Write-Host ""
Write-Host "Commit WIP..." -ForegroundColor Cyan

git commit -m "wip devis module from claude"

Write-Host ""
Write-Host "Push branche WIP vers GitHub..." -ForegroundColor Cyan

git push -u origin wip-devis-claude --force

Write-Host ""
Write-Host "Verification des fichiers devis crees/modifies..." -ForegroundColor Cyan

git show --name-only --oneline HEAD

Write-Host ""
Write-Host "Sauvegarde WIP terminee." -ForegroundColor Green
Write-Host "Branche sauvegardee : wip-devis-claude" -ForegroundColor Green
Write-Host "Repo : https://github.com/lms-gestion/lms-final/tree/wip-devis-claude" -ForegroundColor Green
Write-Host ""
Write-Host "Important : main reste ton etat stable. On continuera le module Devis depuis cette branche WIP." -ForegroundColor Yellow