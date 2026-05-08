'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Mail, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowser } from '@/lib/supabase/client'

type Mode = 'password' | 'magic'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') ?? '/'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const magicLinkMutation = trpc.auth.magicLink.useMutation()

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createSupabaseBrowser()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error('Identifiant ou mot de passe incorrect.')
        return
      }
      router.push(redirect)
      router.refresh()
    } catch (err) {
      toast.error('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await magicLinkMutation.mutateAsync({ email })
      setMagicSent(true)
    } catch {
      // On reste générique
      setMagicSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (magicSent) {
    return (
      <div className="text-center py-8">
        <Mail className="mx-auto h-12 w-12 text-[#F5A623] mb-4" />
        <h3 className="text-white text-lg font-semibold mb-2">Vérifiez votre email</h3>
        <p className="text-white/60 text-sm mb-6">
          Si l'adresse <strong>{email}</strong> existe, un lien de connexion lui a été envoyé.
          Le lien expire dans 15 minutes.
        </p>
        <button
          onClick={() => {
            setMagicSent(false)
            setEmail('')
          }}
          className="text-[#F5A623] hover:underline text-sm"
        >
          Utiliser une autre adresse
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Toggle mode */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg mb-6">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition ${
            mode === 'password' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70'
          }`}
        >
          Mot de passe
        </button>
        <button
          type="button"
          onClick={() => setMode('magic')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition ${
            mode === 'magic' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70'
          }`}
        >
          Lien magique
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              Identifiant
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#F5A623]/60 transition"
              placeholder="email@lamaisondesservices.fr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#F5A623]/60 transition"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-white/50 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[#F5A623]"
              />
              Se souvenir de moi
            </label>
            <Link href="/forgot-password" className="text-white/50 hover:text-white/70">
              Mot de passe oublié ?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            style={{ background: 'linear-gradient(135deg, #ffb020, #f97316)' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
              <span className="flex items-center justify-center gap-2">
                Connexion <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#F5A623]/60 transition"
              placeholder="email@lamaisondesservices.fr"
            />
          </div>
          <p className="text-xs text-white/40">
            Un lien de connexion à usage unique sera envoyé à votre email.
          </p>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            style={{ background: 'linear-gradient(135deg, #ffb020, #f97316)' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Recevoir un lien'}
          </button>
        </form>
      )}
    </div>
  )
}
