import { describe, expect, it } from 'vitest'
import { formatQuoteReference } from './reference'

describe('formatQuoteReference', () => {
  it('formats sequential quote numbers as D00001 references', () => {
    expect(formatQuoteReference(1)).toBe('D00001')
    expect(formatQuoteReference(12)).toBe('D00012')
    expect(formatQuoteReference(12345)).toBe('D12345')
  })
})
