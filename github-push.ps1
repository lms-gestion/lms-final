$RepoName = "lms-final"

Write-Host "Verification GitHub CLI..." -ForegroundColor Cyan

if (!(Get-Command gh -ErrorAction SilentlyContinue)) {

    Write-Host "Installation GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --source winget

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host "Connexion GitHub..." -ForegroundColor Cyan
gh auth login

cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Creation repo GitHub..." -ForegroundColor Cyan

gh repo create $RepoName `
  --public `
  --source=. `
  --remote=origin `
  --push

Write-Host ""
Write-Host "Projet pousse sur GitHub avec succes." -ForegroundColor Green