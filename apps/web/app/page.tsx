/**
 * Page d'accueil â€” redirige vers le dashboard si connectÃ©, sinon vers /login.
 * Le middleware gÃ¨re dÃ©jÃ  la redirection auth, donc cette page sert de
 * point d'entrÃ©e vers le dashboard.
 */

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // VÃ©rifier si l'onboarding est complÃ©tÃ©
  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, organizations!inner(id)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  if (!memberships || memberships.length === 0) {
    // redirect disabled
  }

  redirect('/dashboard')
}

