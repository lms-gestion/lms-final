cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Correction layout AppShell user.fullName..." -ForegroundColor Cyan

$File = "apps\web\app\(app)\layout.tsx"

if (!(Test-Path $File)) {
  Write-Host "ERREUR : fichier layout introuvable" -ForegroundColor Red
  exit 1
}

$Content = [System.IO.File]::ReadAllText($File)

$Content = $Content.Replace(
  "name: profile?.full_name ?? user.email ?? 'Utilisateur',",
  "fullName: profile?.full_name ?? user.email ?? 'Utilisateur',"
)

$Content = $Content.Replace(
  'name: profile?.full_name ?? user.email ?? "Utilisateur",',
  'fullName: profile?.full_name ?? user.email ?? "Utilisateur",'
)

[System.IO.File]::WriteAllText($File, $Content, [System.Text.Encoding]::UTF8)

Write-Host "Nettoyage cache..." -ForegroundColor Cyan

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Verification build..." -ForegroundColor Cyan

pnpm --filter "@lms/web" build *> build-after-layout-fix.txt

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK : build reussi." -ForegroundColor Green

  git add .
  git commit -m "fix app layout user fullname prop"
  git push origin wip-devis-claude

  Write-Host ""
  Write-Host "Correction sauvegardee sur wip-devis-claude." -ForegroundColor Green
} else {
  Write-Host "ERREUR : build encore en echec. Ouverture du rapport..." -ForegroundColor Red
  notepad .\build-after-layout-fix.txt
  exit 1
}