/**
 * Helpers crypto (génération de tokens, hashs)
 * Utilise Web Crypto API (compatible Node 20+ et navigateurs modernes)
 */

/** Génère un token aléatoire en base64url (URL-safe) */
export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Hash SHA-256 d'une chaîne, retour hex */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Génère 10 codes de récupération MFA (8 caractères, alphanumériques) */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans I, O, 0, 1 pour lisibilité
  for (let i = 0; i < count; i++) {
    let code = ''
    const bytes = new Uint8Array(8)
    globalThis.crypto.getRandomValues(bytes)
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j]! % chars.length]
    }
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`)
  }
  return codes
}
