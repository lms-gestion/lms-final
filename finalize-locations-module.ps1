cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Nettoyage fichiers debug temporaires..." -ForegroundColor Cyan

$debugFiles = @(
  "debug-onboarding.ps1",
  "disable-onboarding-redirects.ps1",
  "find-onboarding-loop.ps1",
  "fix-app-layout-onboarding.ps1",
  "fix-layout-debug-auth.ps1",
  "fix-onboarding-loop-final.ps1",
  "fix-onboarding-loop.ps1",
  "onboarding-debug.txt",
  "repair-onboarding-loop.js",
  "repair-onboarding-loop.ps1",
  "sync-clean-run.ps1",
  "check-env.ps1"
)

foreach ($file in $debugFiles) {
  Remove-Item $file -Force -ErrorAction SilentlyContinue
}

Remove-Item "apps\web\app\debug-auth" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Remise au propre du layout app..." -ForegroundColor Cyan

$Layout = "apps\web\app\(app)\layout.tsx"

@'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServer()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('id, user_id, organization_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    redirect('/onboarding')
  }

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', membership.organization_id)
    .maybeSingle()

  if (organizationError || !organization) {
    redirect('/onboarding')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email ?? profile?.email ?? '',
        name: profile?.full_name ?? user.email ?? 'Utilisateur',
        avatarUrl: profile?.avatar_url ?? null,
      }}
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: membership.role,
      }}
    >
      {children}
    </AppShell>
  )
}
'@ | Set-Content $Layout -Encoding UTF8

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan

git add .
git commit -m "add client locations module and clean auth debug"
git push origin main

Write-Host ""
Write-Host "Projet nettoye et sauvegarde." -ForegroundColor Green
Write-Host "Relance maintenant : npm run dev" -ForegroundColor Green