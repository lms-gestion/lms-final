/**
 * Validations métier (SIRET, IBAN, TVA intra, téléphone FR, etc.)
 */

/** Vérifie un SIRET (14 chiffres + algorithme Luhn) */
export function isValidSiret(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = Number.parseInt(cleaned[i]!, 10)
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** Vérifie un n° TVA intra français (FR + 2 chiffres clé + 9 chiffres SIREN) */
export function isValidFrTvaIntra(tva: string): boolean {
  const cleaned = tva.replace(/\s/g, '').toUpperCase()
  if (!/^FR\d{11}$/.test(cleaned)) return false

  const siren = cleaned.slice(4)
  const key = Number.parseInt(cleaned.slice(2, 4), 10)
  const expectedKey = (12 + 3 * (Number.parseInt(siren, 10) % 97)) % 97
  return key === expectedKey
}

/** Vérifie un IBAN (algorithme MOD 97) */
export function isValidIban(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 15 || cleaned.length > 34) return false

  // Déplace les 4 premiers caractères à la fin et convertit lettres en chiffres
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4)
  const numeric = rearranged
    .split('')
    .map((c) => (c.match(/[A-Z]/) ? (c.charCodeAt(0) - 55).toString() : c))
    .join('')

  // MOD 97 par chunks (BigInt pour précision)
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7)
    remainder = Number.parseInt(chunk, 10) % 97
  }
  return remainder === 1
}

/** Vérifie un téléphone FR (mobile ou fixe) */
export function isValidFrPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s.-]/g, '')
  return /^(?:\+33|0)[1-9]\d{8}$/.test(cleaned)
}

/** Vérifie un email (regex simple) */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Vérifie un code postal français */
export function isValidFrPostalCode(cp: string): boolean {
  return /^\d{5}$/.test(cp.trim())
}

/** Vérifie un code APE/NAF (4 chiffres + 1 lettre) */
export function isValidApe(ape: string): boolean {
  const cleaned = ape.replace(/\./g, '').toUpperCase()
  return /^\d{4}[A-Z]$/.test(cleaned)
}

/** Politique de mot de passe (cf. spec module 01) */
export function checkPasswordPolicy(password: string): {
  valid: boolean
  strength: 'weak' | 'medium' | 'strong'
  errors: string[]
} {
  const errors: string[] = []
  if (password.length < 12) errors.push('Au moins 12 caractères')
  if (!/[A-Z]/.test(password)) errors.push('Au moins une majuscule')
  if (!/\d/.test(password)) errors.push('Au moins un chiffre')
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('Au moins un caractère spécial')

  const valid = errors.length === 0
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  if (password.length >= 16 && /[A-Z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()]/.test(password)) {
    strength = 'strong'
  } else if (password.length >= 12) {
    strength = 'medium'
  }

  return { valid, strength, errors }
}

/** Détecte l'agence à partir d'un code postal (FR uniquement) */
export function inferAgencyFromPostalCode(cp: string): string | null {
  const dep = cp.slice(0, 2)
  if (dep === '34') return 'Montpellier'
  if (dep === '66') return 'Perpignan'
  if (['13', '83', '84'].includes(dep)) return 'Aix-Marseille'
  return null
}
