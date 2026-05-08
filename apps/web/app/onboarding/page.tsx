import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { OnboardingWizard } from './onboarding-wizard'

export const metadata = { title: 'Bienvenue' }

export default async function OnboardingPage() {
  const supabase = createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (memberships && memberships.length > 0) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-blue">Bienvenue sur LMS Gestion</h1>
          <p className="text-muted-foreground mt-2">
            Configurons votre organisation en 4 étapes simples.
          </p>
        </div>
        <OnboardingWizard userEmail={user.email ?? ''} />
      </div>
    </div>
  )
}
