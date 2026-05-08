import { createSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DebugAuthPage() {
  const supabase = createSupabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: publicUser } = user
    ? await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
    : { data: null }

  const { data: memberships } = user
    ? await supabase.from('memberships').select('*').eq('user_id', user.id)
    : { data: null }

  return (
    <main style={{ padding: 32, fontFamily: 'Arial' }}>
      <h1>Debug Auth</h1>

      <h2>Auth user</h2>
      <pre>{JSON.stringify(user, null, 2)}</pre>

      <h2>Public user</h2>
      <pre>{JSON.stringify(publicUser, null, 2)}</pre>

      <h2>Memberships</h2>
      <pre>{JSON.stringify(memberships, null, 2)}</pre>

      <p>
        Si memberships est vide, le compte connectÃ© nâ€™est pas celui qui a le membership owner.
      </p>
    </main>
  )
}
