'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { trpc } from '@/lib/trpc/client'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { checkPasswordPolicy } from '@lms/shared'

export function InvitationAcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [loading, setLoading] = useState(false)

  const acceptMutation = trpc.invitations.accept.useMutation()

  const policy = checkPasswordPolicy(password)
  const canSubmit = firstName && lastName && policy.valid && acceptTerms

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const supabase = createSupabaseBrowser()
      // Crée le compte (signup) — Supabase enverra un mail de confirmation,
      // mais comme l'invitation est valide, on by-pass via update post-login
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: `${firstName} ${lastName}` },
        },
      })

      // Si user déjà existant, on tente directement le login
      if (signUpErr?.message.includes('already registered')) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          toast.error('Vous avez déjà un compte. Connectez-vous puis réessayez l\'invitation.')
          router.push(`/login?redirect=/invitation/${token}`)
          return
        }
      } else if (signUpErr) {
        toast.error(signUpErr.message)
        return
      }

      // Accepte l'invitation
      await acceptMutation.mutateAsync({
        token,
        firstName,
        lastName,
        phone,
        password,
        acceptTerms: true,
      })

      toast.success('Bienvenue dans LMS Gestion !')
      window.location.replace('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input value={email} readOnly className="bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">Prénom *</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="lastName">Nom *</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 XX XX XX XX" />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe *</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
        {password && policy.errors.length > 0 && (
          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
            {policy.errors.map((err) => <li key={err}>· {err}</li>)}
          </ul>
        )}
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} />
        <Label htmlFor="terms" className="text-xs cursor-pointer">
          J'accepte les conditions générales et la politique de confidentialité.
        </Label>
      </div>
      <Button type="submit" disabled={!canSubmit || loading} className="w-full" variant="orange">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer mon compte'}
      </Button>
    </form>
  )
}
