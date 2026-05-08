cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Nettoyage fichiers debug..." -ForegroundColor Cyan

$debugFiles = @(
  "check-env.ps1",
  "debug-onboarding.ps1",
  "disable-onboarding-redirects.ps1",
  "find-onboarding-loop.ps1",
  "fix-app-layout-onboarding.ps1",
  "fix-layout-debug-auth.ps1",
  "fix-onboarding-loop-final.ps1",
  "fix-onboarding-loop.ps1",
  "repair-onboarding-loop.js",
  "repair-onboarding-loop.ps1",
  "sync-clean-run.ps1",
  "onboarding-debug.txt"
)

foreach ($file in $debugFiles) {
  Remove-Item $file -Force -ErrorAction SilentlyContinue
}

Write-Host "Ajout git..." -ForegroundColor Cyan

git add .

Write-Host "Commit..." -ForegroundColor Cyan

git commit -m "fix auth onboarding membership flow"

Write-Host "Push..." -ForegroundColor Cyan

git push origin main

Write-Host ""
Write-Host "Commit propre termine." -ForegroundColor Green