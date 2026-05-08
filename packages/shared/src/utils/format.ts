/**
 * Helpers de formatage (locale fr-FR par défaut)
 */

import { format, formatDistanceToNow, formatRelative } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Formate un montant en EUR : 1234.56 → "1 234,56 €" */
export function formatEur(amount: number | string | null | undefined, opts: { showZero?: boolean } = {}): string {
  if (amount === null || amount === undefined || amount === '') return opts.showZero ? '0,00 €' : '—'
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'EUR',
  })
}

/** Formate un nombre : 1234567 → "1 234 567" */
export function formatNumber(n: number | null | undefined, fractionDigits = 0): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Formate un pourcentage : 0.20 → "20 %" (entrée = ratio 0-1) */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return `${(ratio * 100).toLocaleString('fr-FR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} %`
}

/** Date courte : 2026-05-06 → "06/05/2026" */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

/** Date longue : "lundi 6 mai 2026" */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'EEEE d MMMM yyyy', { locale: fr })
}

/** Date + heure : "06/05/2026 14:32" */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr })
}

/** Heure seule : "14:32" */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm', { locale: fr })
}

/** Date relative : "il y a 5 minutes", "demain", "la semaine prochaine" */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { locale: fr, addSuffix: true })
}

/** Téléphone FR : "0612345678" → "06 12 34 56 78" */
export function formatPhoneFr(phone: string | null | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+33')) {
    const num = cleaned.slice(3)
    if (num.length === 9) return `0${num.slice(0, 1)} ${num.slice(1, 3)} ${num.slice(3, 5)} ${num.slice(5, 7)} ${num.slice(7, 9)}`
  }
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`
  }
  return phone
}

/** Téléphone E.164 : "0612345678" → "+33612345678" */
export function toPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10 && cleaned.startsWith('0')) return `+33${cleaned.slice(1)}`
  return null
}

/** SIRET formaté : "12345678901234" → "123 456 789 01234" */
export function formatSiret(siret: string | null | undefined): string {
  if (!siret) return ''
  const cleaned = siret.replace(/\s/g, '')
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 14)}`
  }
  return siret
}

/** Initiales : "Marie Leroy" → "ML" */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Couleur déterministe à partir d'un nom (pour avatar) */
const PALETTE = [
  '#0f3b78',
  '#f97316',
  '#ffb020',
  '#16a34a',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#0ea5e9',
  '#64748b',
  '#be185d',
]

export function getColorForName(name: string | null | undefined): string {
  if (!name) return '#64748b'
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]!
}

/** Tronque un texte avec ellipse */
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
