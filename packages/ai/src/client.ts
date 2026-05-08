/**
 * Client Anthropic Claude singleton
 */

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')

  _client = new Anthropic({ apiKey })
  return _client
}

export const SONNET_MODEL = process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-6'
export const HAIKU_MODEL = process.env.ANTHROPIC_MODEL_HAIKU ?? 'claude-haiku-4-5-20251001'

/** Tarifs API (€ / 1M tokens) — à mettre à jour selon pricing Anthropic */
export const PRICING = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
} as const

export function calculateCostEur(model: string, tokensIn: number, tokensOut: number): number {
  const rates = PRICING[model as keyof typeof PRICING] ?? PRICING['claude-sonnet-4-6']
  // Conversion USD → EUR ~0.92 (à ajuster)
  const usdCost = (tokensIn / 1_000_000) * rates.input + (tokensOut / 1_000_000) * rates.output
  return Math.round(usdCost * 0.92 * 10000) / 10000
}
