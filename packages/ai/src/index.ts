/**
 * @lms/ai — Wrappers Claude API + extraction structurée
 *
 * Usage :
 *   import { extractBonDeCommande } from '@lms/ai'
 *   const result = await extractBonDeCommande({ pdfBase64, organizationId })
 */

export * from './client'
export * from './extractors'
export * from './types'
