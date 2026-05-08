'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { METIERS, isValidSiret } from '@lms/shared'
import { cn } from '@/lib/utils/cn'

type Step = 1 | 2 | 3 | 4

type WizardData = {
  organization: {
    name: string
    legalName: string
    legalForm?: string
    siret?: string
    tvaIntra?: string
    apeCode?: string
    address: { street?: string; postalCode?: string; city?: string }
  }
  agency: {
    name: string
    code: string
    address: { street?: string; postalCode?: string; city?: string }
    phone?: string
    email?: string
    postalCodes: string[]
    metiers: string[]
  }
  invitations: Array<{
    email: string
    firstName?: string
    lastName?: string
    role: 'admin' | 'accountant' | 'technician' | 'viewer'
  }>
}

export function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<WizardData>({
    organization: { name: '', legalName: '', address: {} },
    agency: { name: 'Montpellier', code: 'MTP', address: {}, postalCodes: [], metiers: [] },
    invitations: [],
  })

  // â”€â”€â”€ Validation par Ã©tape â”€â”€â”€
  const errors = {
    name: data.organization.name.trim().length === 0 ? 'Nom commercial requis' : null,
    legalName: data.organization.legalName.trim().length === 0 ? 'Raison sociale requise' : null,
    siret:
      data.organization.siret && data.organization.siret.replace(/\s/g, '').length > 0 && !isValidSiret(data.organization.siret)
        ? 'SIRET invalide (14 chiffres + clÃ© Luhn)'
        : null,
    agencyName: data.agency.name.trim().length === 0 ? 'Nom de l\'agence requis' : null,
    agencyCode: !/^[A-Z]{2,4}$/.test(data.agency.code) ? '2 Ã  4 lettres en majuscules' : null,
    metiers: data.agency.metiers.length === 0 ? 'Au moins un mÃ©tier' : null,
  }

  const step1Valid = !errors.name && !errors.legalName && !errors.siret
  const step3Valid = !errors.agencyName && !errors.agencyCode && !errors.metiers

  const createMutation = trpc.onboarding.create.useMutation()
  const inviteMutation = trpc.onboarding.sendInvitations.useMutation()

  function nextStep() {
    if (step === 1 && !step1Valid) {
      toast.error('Renseignez les champs obligatoires avant de continuer.')
      return
    }
    if (step === 3 && !step3Valid) {
      toast.error('SÃ©lectionnez au moins un mÃ©tier.')
      return
    }
    setStep((step + 1) as Step)
  }

  async function handleFinish() {
    if (!step1Valid || !step3Valid) {
      toast.error('Des champs obligatoires manquent.')
      return
    }
    try {
      await createMutation.mutateAsync({
        organization: data.organization,
        agency: data.agency,
      })
      if (data.invitations.length > 0) {
        await inviteMutation.mutateAsync({
          invitations: data.invitations.map((inv) => ({
            email: inv.email,
            firstName: inv.firstName,
            lastName: inv.lastName,
            role: inv.role,
            agencyIds: [],
          })),
        })
      }
      toast.success('Configuration terminÃ©e. Bienvenue !')
      // Hard navigation : force le re-fetch des cookies et de la session cÃ´tÃ©
      // serveur, sinon le layout (app) ne voit pas encore la nouvelle membership
      // et redirige en boucle vers /onboarding.
      window.location.href = '/dashboard'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur, rÃ©essayez')
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {([1, 2, 3, 4] as const).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition',
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                      ? 'bg-brand-blue text-white'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {s < step ? 'âœ“' : s}
              </div>
              {i < 3 && (
                <div className={cn('flex-1 h-0.5 mx-2', s < step ? 'bg-emerald-500' : 'bg-muted')} />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">Ã‰tape 1/4 â€” Informations lÃ©gales</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ces informations apparaÃ®tront sur vos devis et factures.
            </p>
            <div>
              <Label htmlFor="name">
                Nom commercial <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={data.organization.name}
                onChange={(e) =>
                  setData({ ...data, organization: { ...data.organization, name: e.target.value } })
                }
                placeholder="La Maison des Services"
                className={cn(errors.name && data.organization.name.length === 0 && 'border-destructive')}
                autoFocus
              />
              {errors.name && data.organization.name.length === 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="legalName">
                Raison sociale <span className="text-destructive">*</span>
              </Label>
              <Input
                id="legalName"
                value={data.organization.legalName}
                onChange={(e) =>
                  setData({
                    ...data,
                    organization: { ...data.organization, legalName: e.target.value },
                  })
                }
                placeholder="La Maison des Services SAS"
                className={cn(
                  errors.legalName && data.organization.legalName.length === 0 && 'border-destructive',
                )}
              />
              {errors.legalName && data.organization.legalName.length === 0 && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.legalName}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  value={data.organization.siret ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      organization: { ...data.organization, siret: e.target.value },
                    })
                  }
                  placeholder="12345678901234"
                  className={cn(errors.siret && 'border-destructive')}
                />
                {errors.siret && (
                  <p className="text-xs text-destructive mt-1">{errors.siret}</p>
                )}
              </div>
              <div>
                <Label htmlFor="tva">NÂ° TVA intra</Label>
                <Input
                  id="tva"
                  value={data.organization.tvaIntra ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      organization: { ...data.organization, tvaIntra: e.target.value },
                    })
                  }
                  placeholder="FR12345678901"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="addr">Adresse siÃ¨ge social</Label>
              <Input
                id="addr"
                value={data.organization.address.street ?? ''}
                onChange={(e) =>
                  setData({
                    ...data,
                    organization: {
                      ...data.organization,
                      address: { ...data.organization.address, street: e.target.value },
                    },
                  })
                }
                placeholder="420 av. Blaise Pascal"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cp">Code postal</Label>
                <Input
                  id="cp"
                  value={data.organization.address.postalCode ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      organization: {
                        ...data.organization,
                        address: { ...data.organization.address, postalCode: e.target.value },
                      },
                    })
                  }
                  placeholder="34170"
                  maxLength={5}
                />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={data.organization.address.city ?? ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      organization: {
                        ...data.organization,
                        address: { ...data.organization.address, city: e.target.value },
                      },
                    })
                  }
                  placeholder="Castelnau-le-Lez"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">Ã‰tape 2/4 â€” IdentitÃ© visuelle</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Vous pourrez personnaliser le branding plus tard depuis les paramÃ¨tres.
            </p>
            <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
              <p className="text-sm">Configuration par dÃ©faut appliquÃ©e :</p>
              <div className="flex items-center justify-center gap-3 mt-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow"
                  style={{ background: '#0F2644' }}
                  title="Bleu marine"
                />
                <span className="text-sm">+</span>
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow"
                  style={{ background: '#F5A623' }}
                  title="Or"
                />
              </div>
              <p className="text-xs mt-3 font-mono">#0F2644 Â· #F5A623</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">Ã‰tape 3/4 â€” PremiÃ¨re agence</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Vous pourrez ajouter d'autres agences plus tard.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Nom de l'agence <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={data.agency.name}
                  onChange={(e) => setData({ ...data, agency: { ...data.agency, name: e.target.value } })}
                  className={cn(errors.agencyName && 'border-destructive')}
                />
                {errors.agencyName && (
                  <p className="text-xs text-destructive mt-1">{errors.agencyName}</p>
                )}
              </div>
              <div>
                <Label>
                  Code court <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={data.agency.code}
                  onChange={(e) =>
                    setData({ ...data, agency: { ...data.agency, code: e.target.value.toUpperCase() } })
                  }
                  maxLength={4}
                  placeholder="MTP"
                  className={cn(errors.agencyCode && 'border-destructive')}
                />
                {errors.agencyCode && (
                  <p className="text-xs text-destructive mt-1">{errors.agencyCode}</p>
                )}
              </div>
            </div>
            <div>
              <Label>Codes postaux desservis (sÃ©parÃ©s par virgule)</Label>
              <Input
                value={data.agency.postalCodes.join(', ')}
                onChange={(e) =>
                  setData({
                    ...data,
                    agency: {
                      ...data.agency,
                      postalCodes: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="34000, 34070, 34170, 34970"
              />
            </div>
            <div>
              <Label>
                MÃ©tiers pratiquÃ©s <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {METIERS.map((m) => {
                  const selected = data.agency.metiers.includes(m.code)
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => {
                        setData({
                          ...data,
                          agency: {
                            ...data.agency,
                            metiers: selected
                              ? data.agency.metiers.filter((x) => x !== m.code)
                              : [...data.agency.metiers, m.code],
                          },
                        })
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                        selected
                          ? 'bg-brand-blue text-white border-brand-blue'
                          : 'bg-background border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {m.emoji} {m.label}
                    </button>
                  )
                })}
              </div>
              {errors.metiers && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.metiers}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-1">Ã‰tape 4/4 â€” Inviter votre Ã©quipe</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Optionnel. Vous pourrez ajouter d'autres membres plus tard.
            </p>
            {data.invitations.map((inv, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inv.email}
                    onChange={(e) => {
                      const next = [...data.invitations]
                      next[i] = { ...next[i]!, email: e.target.value }
                      setData({ ...data, invitations: next })
                    }}
                    placeholder="prenom@exemple.fr"
                  />
                </div>
                <div className="w-40">
                  <Label>RÃ´le</Label>
                  <select
                    value={inv.role}
                    onChange={(e) => {
                      const next = [...data.invitations]
                      next[i] = { ...next[i]!, role: e.target.value as typeof inv.role }
                      setData({ ...data, invitations: next })
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="admin">Chef d'agence</option>
                    <option value="accountant">Comptable</option>
                    <option value="technician">Technicien</option>
                    <option value="viewer">Lecture seule</option>
                  </select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setData({ ...data, invitations: data.invitations.filter((_, j) => j !== i) })}
                >
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                setData({
                  ...data,
                  invitations: [...data.invitations, { email: '', role: 'technician' }],
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Ajouter une invitation
            </Button>
            <p className="text-xs text-muted-foreground italic mt-4">
              ðŸ’¡ Cette Ã©tape est facultative. Vous pouvez cliquer "Terminer" sans inviter personne.
            </p>
          </div>
        )}

        <div className="flex justify-between mt-8">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((step - 1) as Step)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> PrÃ©cÃ©dent
          </Button>
          {step < 4 ? (
            <Button
              onClick={nextStep}
              variant="orange"
              disabled={(step === 1 && !step1Valid) || (step === 3 && !step3Valid)}
            >
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={createMutation.isPending || inviteMutation.isPending || !step1Valid || !step3Valid}
              variant="orange"
            >
              {createMutation.isPending || inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Terminer'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

