cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Nettoyage des fichiers secrets..." -ForegroundColor Cyan

# Supprime les backups contenant les secrets
Remove-Item ".env.local.bak" -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.env.local.bak" -Force -ErrorAction SilentlyContinue

# Ajoute les fichiers sensibles au .gitignore
@"
.env
.env.*
!.env.example
*.bak
"@ | Set-Content ".gitignore" -Encoding UTF8

# Supprime l'ancien historique Git local
Remove-Item ".git" -Recurse -Force -ErrorAction SilentlyContinue

# Recrée un dépôt propre
git init
git branch -M main
git add .
git commit -m "clean project without secrets"

# Reconnecte au repo GitHub existant
git remote add origin https://github.com/lms-gestion/lms-final.git

# Force push propre
git push -u origin main --force

Write-Host ""
Write-Host "Push propre termine." -ForegroundColor Green