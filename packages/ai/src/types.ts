/**
 * Types partagés du package AI
 */

export type AiFieldResult<T> = {
  value: T | null
  confidence: number // 0-100
}

export type ExtractedBonDeCommande = {
  supplierReference: AiFieldResult<string>
  clientName: AiFieldResult<string>
  clientSiret: AiFieldResult<string>
  clientAddress: AiFieldResult<string>
  interventionAddress: AiFieldResult<string>
  interventionResidence: AiFieldResult<string>
  tenantName: AiFieldResult<string>
  tenantPhone: AiFieldResult<string>
  metier: AiFieldResult<string>
  priority: AiFieldResult<'normal' | 'haute' | 'urgence'>
  description: AiFieldResult<string>
  amountAuthorizedHt: AiFieldResult<number>
  issueDate: AiFieldResult<string>
}

export type ExtractedFacture = {
  numero: AiFieldResult<string>
  date: AiFieldResult<string>
  echeance: AiFieldResult<string>
  fournisseur: AiFieldResult<string>
  fournisseurSiret: AiFieldResult<string>
  totalHt: AiFieldResult<number>
  totalTva: AiFieldResult<number>
  totalTtc: AiFieldResult<number>
  lignes: AiFieldResult<Array<{
    description: string
    quantity?: number
    unitPriceHt?: number
    totalHt?: number
  }>>
}

export type ExtractionResult<T> = {
  ok: true
  data: T
  globalConfidence: number
  tokensIn: number
  tokensOut: number
  costEur: number
  durationMs: number
  model: string
} | {
  ok: false
  error: string
  durationMs: number
}

export type DocumentClassification =
  | 'bon_de_commande'
  | 'facture'
  | 'attestation'
  | 'devis_recu'
  | 'photo'
  | 'autre'
