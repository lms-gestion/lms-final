'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc/client'
import { CLIENT_TYPES, isValidSiret } from '@lms/shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

type ClientType = (typeof CLIENT_TYPES)[number]['code']

export function CreateClientDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [type, setType] = useState<ClientType>('syndic')
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [legalForm, setLegalForm] = useState('')
  const [siret, setSiret] = useState('')
  const [tvaIntra, setTvaIntra] = useState('')
  const [cardProGT, setCardProGT] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [notes, setNotes] = useState('')

  const createMutation = trpc.clients.create.useMutation()

  // Validation par étape
  const step1Valid = !!type
  const step2Valid = name.trim().length > 0 && (type === 'particulier' || legalName.trim().length > 0)
  const step3Valid = true // tout optionnel
  const step4Valid = paymentTermsDays >= 0

  const siretInvalid = siret.replace(/\s/g, '').length > 0 && !isValidSiret(siret)

  function reset() {
    setStep(1)
    setType('syndic')
    setName('')
    setLegalName('')
    setLegalForm('')
    setSiret('')
    setTvaIntra('')
    setCardProGT('')
    setStreet('')
    setPostalCode('')
    setCity('')
    setPhone('')
    setEmail('')
    setPaymentTermsDays(30)
    setNotes('')
  }

  async function handleCreate() {
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        legalForm: legalForm || undefined,
        type,
        siret: siret.replace(/\s/g, '') || undefined,
        tvaIntra: tvaIntra.trim() || undefined,
        cardProGT: cardProGT || undefined,
        address: {
          street: street || undefined,
          postalCode: postalCode || undefined,
          city: city || undefined,
          country: 'FR',
        },
        phone: phone || undefined,
        email: email || undefined,
        paymentTermsDays,
        notes: notes || undefined,
        tags: [],
      })
      toast.success(`Client "${name}" créé avec succès`)
      onCreated?.()
      onOpenChange(false)
      reset()
      if (created) {
        router.push(`/clients/${created.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur création client')
    }
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset()
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau client — Étape {step}/4</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-2">
          {([1, 2, 3, 4] as const).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                      ? 'bg-brand-blue text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              {i < 3 && (
                <div className={`flex-1 h-0.5 mx-2 ${s < step ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Quel type de client ?</p>
            <div className="grid grid-cols-2 gap-2">
              {CLIENT_TYPES.map((t) => (
                <button
                  key={t.code}
                  onClick={() => setType(t.code as ClientType)}
                  className={`p-3 rounded-lg border-2 text-left transition ${
                    type === t.code
                      ? 'border-brand-blue bg-brand-blue-light/30'
                      : 'border-border hover:border-brand-blue/40'
                  }`}
                >
                  <p className="font-semibold text-sm">{t.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">
                {type === 'particulier' ? 'Nom complet *' : 'Nom commercial *'}
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'particulier' ? 'Mme Dupont' : 'Foncia Sud Méditerranée'}
                autoFocus
              />
            </div>
            {type !== 'particulier' && (
              <>
                <div>
                  <Label htmlFor="legalName">Raison sociale *</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Foncia Sud Méditerranée SAS"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="legalForm">Forme juridique</Label>
                    <Select value={legalForm} onValueChange={setLegalForm}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAS">SAS</SelectItem>
                        <SelectItem value="SARL">SARL</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="EURL">EURL</SelectItem>
                        <SelectItem value="SASU">SASU</SelectItem>
                        <SelectItem value="EI">Entreprise individuelle</SelectItem>
                        <SelectItem value="Association">Association</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="siret">SIRET</Label>
                    <Input
                      id="siret"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      placeholder="123 456 789 01234"
                      className={siretInvalid ? 'border-destructive' : ''}
                    />
                    {siretInvalid && (
                      <p className="text-xs text-destructive mt-1">SIRET invalide</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tva">N° TVA intra</Label>
                    <Input
                      id="tva"
                      value={tvaIntra}
                      onChange={(e) => setTvaIntra(e.target.value)}
                      placeholder="FR12345678901"
                    />
                  </div>
                  {type === 'syndic' && (
                    <div>
                      <Label htmlFor="cardpro">Carte pro G/T</Label>
                      <Input
                        id="cardpro"
                        value={cardProGT}
                        onChange={(e) => setCardProGT(e.target.value)}
                        placeholder="CPI 3401 2020 ..."
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Coordonnées</p>
            <div>
              <Label htmlFor="street">Adresse</Label>
              <Input
                id="street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="420 av. Blaise Pascal"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cp">Code postal</Label>
                <Input
                  id="cp"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="34170"
                  maxLength={5}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Castelnau-le-Lez"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="04 65 84 15 94"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@exemple.fr"
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Conditions commerciales</p>
            <div>
              <Label htmlFor="terms">Délai de paiement (jours)</Label>
              <Select
                value={String(paymentTermsDays)}
                onValueChange={(v) => setPaymentTermsDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">À réception</SelectItem>
                  <SelectItem value="15">15 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="45">45 jours</SelectItem>
                  <SelectItem value="60">60 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes commerciales</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Particularités, contacts privilégiés, historique…"
                rows={4}
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}>
              Précédent
            </Button>
          )}
          {step < 4 ? (
            <Button
              variant="orange"
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && (!step2Valid || siretInvalid)) ||
                (step === 3 && !step3Valid)
              }
              onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
            >
              Suivant
            </Button>
          ) : (
            <Button
              variant="orange"
              disabled={!step4Valid || createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer le client'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
