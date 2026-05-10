export function formatQuoteReference(sequenceNumber: number): string {
  return `D${String(sequenceNumber).padStart(5, '0')}`
}
