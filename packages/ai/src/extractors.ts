/**
 * Extracteurs spécialisés Claude API
 */

import { getAnthropicClient, SONNET_MODEL, HAIKU_MODEL, calculateCostEur } from './client'
import type {
  ExtractedBonDeCommande,
  ExtractedFacture,
  ExtractionResult,
  DocumentClassification,
} from './types'

// ───────────────────────────────────────────────────────────────────
// Classification rapide (Haiku)
// ───────────────────────────────────────────────────────────────────

export async function classifyDocument(opts: {
  imageBase64: string
  mediaType: string
}): Promise<{ type: DocumentClassification; confidence: number }> {
  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    tools: [
      {
        name: 'classify_document',
        description: 'Classifie le document en une catégorie',
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bon_de_commande', 'facture', 'attestation', 'devis_recu', 'photo', 'autre'],
            },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
          },
          required: ['type', 'confidence'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'classify_document' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: opts.mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
              data: opts.imageBase64,
            },
          },
          {
            type: 'text',
            text: `Tu es un assistant qui classifie les documents pro français. Catégories :
- bon_de_commande : BC émis par un syndic ou bailleur (commande de travaux, intervention)
- facture : facture émise par un fournisseur
- attestation : attestation TVA réduite, attestation sur l'honneur
- devis_recu : devis émis par un fournisseur
- photo : photo de chantier (avant/après, dégât, matériel)
- autre : tout le reste

Classifie le document avec un score de confiance de 0 à 100.`,
          },
        ],
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (toolUse?.type !== 'tool_use') throw new Error('Pas de tool_use dans la réponse')
  const input = toolUse.input as { type: DocumentClassification; confidence: number }
  return input
}

// ───────────────────────────────────────────────────────────────────
// Extraction Bon de Commande
// ───────────────────────────────────────────────────────────────────

const BC_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    supplierReference: confidenceField('string'),
    clientName: confidenceField('string'),
    clientSiret: confidenceField('string'),
    clientAddress: confidenceField('string'),
    interventionAddress: confidenceField('string'),
    interventionResidence: confidenceField('string'),
    tenantName: confidenceField('string'),
    tenantPhone: confidenceField('string'),
    metier: confidenceField('string'),
    priority: confidenceField('string'),
    description: confidenceField('string'),
    amountAuthorizedHt: confidenceField('number'),
    issueDate: confidenceField('string'),
  },
  required: [
    'supplierReference',
    'clientName',
    'description',
    'metier',
    'priority',
  ],
} as const

function confidenceField(valueType: 'string' | 'number') {
  return {
    type: 'object',
    properties: {
      value: { type: [valueType, 'null'] },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
    },
    required: ['value', 'confidence'],
  } as const
}

export async function extractBonDeCommande(opts: {
  imageBase64: string
  mediaType: string
}): Promise<ExtractionResult<ExtractedBonDeCommande>> {
  const start = Date.now()
  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 2000,
      tools: [
        {
          name: 'extract_bon_de_commande',
          description: 'Extrait les données structurées d\'un bon de commande',
          input_schema: BC_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_bon_de_commande' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.mediaType as 'image/png' | 'image/jpeg',
                data: opts.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Tu es un assistant spécialisé dans l'extraction de données depuis des bons de commande émis par
des syndics français (Foncia, Nexity, Citya, Loiselet, etc.) à des prestataires BTP.

Pour chaque champ extrait, fournis :
- la valeur exacte (string ou number, ou null si non trouvée)
- un score de confiance entre 0 et 100

Règles :
- Téléphones : format E.164 (+33...)
- Dates : ISO 8601 (YYYY-MM-DD)
- Si tu n'es pas sûr d'un champ, mets null avec confidence < 30
- Pour metier : choisis parmi {plomberie, electricite, toiture, serrurerie, menuiserie, peinture, maconnerie, syndics, autre}
- Pour priority : urgence si "urgent", "fuite", "panne totale", "danger" ; haute si délai contractuel court ; sinon normal
- Pour amountAuthorizedHt : montant HT autorisé sans TVA, en euros (number)

Analyse maintenant ce document.`,
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse?.type !== 'tool_use') {
      return { ok: false, error: 'Réponse Claude sans tool_use', durationMs: Date.now() - start }
    }

    const data = toolUse.input as ExtractedBonDeCommande
    const tokensIn = response.usage.input_tokens
    const tokensOut = response.usage.output_tokens
    const costEur = calculateCostEur(SONNET_MODEL, tokensIn, tokensOut)
    const globalConfidence = computeGlobalConfidence(data, [
      'supplierReference',
      'clientName',
      'metier',
      'description',
    ])

    return {
      ok: true,
      data,
      globalConfidence,
      tokensIn,
      tokensOut,
      costEur,
      durationMs: Date.now() - start,
      model: SONNET_MODEL,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Extraction Facture
// ───────────────────────────────────────────────────────────────────

const FACTURE_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    numero: confidenceField('string'),
    date: confidenceField('string'),
    echeance: confidenceField('string'),
    fournisseur: confidenceField('string'),
    fournisseurSiret: confidenceField('string'),
    totalHt: confidenceField('number'),
    totalTva: confidenceField('number'),
    totalTtc: confidenceField('number'),
    lignes: {
      type: 'object',
      properties: {
        value: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPriceHt: { type: 'number' },
              totalHt: { type: 'number' },
            },
          },
        },
        confidence: { type: 'integer', minimum: 0, maximum: 100 },
      },
      required: ['value', 'confidence'],
    },
  },
  required: ['numero', 'date', 'fournisseur', 'totalTtc'],
} as const

export async function extractFacture(opts: {
  imageBase64: string
  mediaType: string
}): Promise<ExtractionResult<ExtractedFacture>> {
  const start = Date.now()
  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 4000,
      tools: [
        {
          name: 'extract_facture',
          description: 'Extrait les données d\'une facture',
          input_schema: FACTURE_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_facture' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.mediaType as 'image/png' | 'image/jpeg',
                data: opts.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Extrait les informations de cette facture française. Sois très précis sur les montants
(virgule décimale française = point en JSON). Score de confiance par champ.`,
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse?.type !== 'tool_use') {
      return { ok: false, error: 'Réponse sans tool_use', durationMs: Date.now() - start }
    }

    const data = toolUse.input as ExtractedFacture
    const tokensIn = response.usage.input_tokens
    const tokensOut = response.usage.output_tokens

    return {
      ok: true,
      data,
      globalConfidence: computeGlobalConfidence(data, ['numero', 'date', 'fournisseur', 'totalTtc']),
      tokensIn,
      tokensOut,
      costEur: calculateCostEur(SONNET_MODEL, tokensIn, tokensOut),
      durationMs: Date.now() - start,
      model: SONNET_MODEL,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Extraction texte libre (création chantier)
// ───────────────────────────────────────────────────────────────────

export async function extractFromText(opts: { text: string }): Promise<
  ExtractionResult<ExtractedBonDeCommande>
> {
  const start = Date.now()
  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1500,
      tools: [
        {
          name: 'extract_chantier_from_text',
          description: 'Extrait les données pour créer un chantier depuis un texte libre',
          input_schema: BC_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_chantier_from_text' },
      messages: [
        {
          role: 'user',
          content: `Tu es un assistant qui extrait les données pour créer un chantier BTP depuis du texte libre.
Mêmes règles qu'un BC : confidence par champ, dates ISO, téléphones E.164, métier dans la liste fixe.

Texte :
"""
${opts.text}
"""`,
        },
      ],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse?.type !== 'tool_use') {
      return { ok: false, error: 'Réponse sans tool_use', durationMs: Date.now() - start }
    }

    const data = toolUse.input as ExtractedBonDeCommande
    const tokensIn = response.usage.input_tokens
    const tokensOut = response.usage.output_tokens

    return {
      ok: true,
      data,
      globalConfidence: computeGlobalConfidence(data, ['clientName', 'metier', 'description']),
      tokensIn,
      tokensOut,
      costEur: calculateCostEur(SONNET_MODEL, tokensIn, tokensOut),
      durationMs: Date.now() - start,
      model: SONNET_MODEL,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function computeGlobalConfidence(
  data: Record<string, unknown>,
  criticalFields: string[],
): number {
  const scores = criticalFields
    .map((field) => {
      const f = data[field] as { confidence?: number } | undefined
      return f?.confidence ?? 0
    })
    .filter((s) => s > 0)
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
