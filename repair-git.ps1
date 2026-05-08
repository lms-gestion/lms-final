cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Suppression ancien depot Git..." -ForegroundColor Cyan
Remove-Item ".git" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Initialisation Git..." -ForegroundColor Cyan
git init

Write-Host "Creation branche main..." -ForegroundColor Cyan
git checkout -b main

Write-Host "Ajout remote GitHub..." -ForegroundColor Cyan
git remote add origin https://github.com/lms-gestion/lms-final.git

Write-Host "Verification .gitignore..." -ForegroundColor Cyan

@"
node_modules
.next
.turbo
.env
.env.*
*.bak
"@ | Set-Content ".gitignore" -Encoding UTF8

Write-Host "Ajout fichiers..." -ForegroundColor Cyan
git add .

Write-Host "Premier commit..." -ForegroundColor Cyan
git commit -m "stable working LMS setup"

Write-Host "Push GitHub..." -ForegroundColor Cyan
git push -u origin main --force

Write-Host ""
Write-Host "Depot Git repare et pousse." -ForegroundColor Green