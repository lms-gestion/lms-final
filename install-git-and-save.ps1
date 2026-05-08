Write-Host "Installation de Git..." -ForegroundColor Cyan

winget install --id Git.Git -e --source winget

Write-Host "Git installe. Redemarrage du PATH..." -ForegroundColor Green

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

cd "C:\Users\Shoks\Desktop\lms-final"

git init
git add .
git commit -m "working auth + supabase setup"
git branch -M main

Write-Host ""
Write-Host "Sauvegarde locale Git terminee." -ForegroundColor Green
Write-Host "Tu peux fermer cette fenetre."