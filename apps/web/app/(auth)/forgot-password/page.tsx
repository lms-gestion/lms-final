'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const mutation = trpc.auth.requestPasswordReset.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await mutation.mutateAsync({ email })
    } catch {
      // ignore
    } finally {
      setSent(true)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl">
        <Link href="/login" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6">
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        {sent ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-2">Email envoyé</h1>
            <p className="text-white/60 text-sm">
              Si l'adresse <strong>{email}</strong> existe, vous recevrez un lien de réinitialisation
              dans quelques instants.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="text-xl font-bold text-white mb-2">Mot de passe oublié ?</h1>
            <p className="text-white/60 text-sm mb-6">
              Saisissez votre adresse email et nous vous enverrons un lien pour réinitialiser
              votre mot de passe.
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.fr"
              className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#F5A623]/60 transition mb-4"
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #ffb020, #f97316)' }}
            >
              {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
