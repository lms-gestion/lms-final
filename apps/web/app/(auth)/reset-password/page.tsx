'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { checkPasswordPolicy } from '@lms/shared'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const mutation = trpc.auth.setNewPasswordAfterReset.useMutation()

  const policy = checkPasswordPolicy(password)
  const canSubmit = policy.valid && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await mutation.mutateAsync({ password })
      toast.success('Mot de passe modifié.')
      router.push('/')
    } catch (err) {
      toast.error('Échec de la mise à jour du mot de passe.')
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-6">Nouveau mot de passe</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F5A623]/60"
            />
            {password && (
              <div className="mt-2">
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      policy.strength === 'strong'
                        ? 'bg-green-500 w-full'
                        : policy.strength === 'medium'
                          ? 'bg-orange-500 w-2/3'
                          : 'bg-red-500 w-1/3'
                    }`}
                  />
                </div>
                {policy.errors.length > 0 && (
                  <ul className="text-xs text-white/50 mt-2 space-y-0.5">
                    {policy.errors.map((err) => (
                      <li key={err}>· {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
              Confirmer
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F5A623]/60"
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="w-full py-3 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #ffb020, #f97316)' }}
          >
            {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Mettre à jour'}
          </button>
        </form>
      </div>
    </div>
  )
}
