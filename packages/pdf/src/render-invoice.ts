/**
 * Génération PDF d'une facture (cf. spec module 07 §6).
 * Sprint 0 : stub fonctionnel. Sprint 10-11 : implémentation complète + Factur-X.
 */

import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0F2644' },
  section: { marginBottom: 12 },
  label: { fontSize: 9, color: '#666', marginBottom: 2 },
  value: { fontSize: 11 },
})

export type InvoicePdfData = {
  reference: string
  issueDate: string
  dueDate: string
  client: { name: string; siret?: string }
  organization: { name: string; siret: string; tvaIntra?: string; address?: string }
  subject: string
  totalHt: number
  totalTva: number
  totalTtc: number
  lines: Array<{
    description: string
    quantity?: number
    unit?: string
    unitPriceHt?: number
    vatRate?: number
    totalHt?: number
  }>
  paymentTerms?: string
  latePenaltyRate?: number
  lateIndemnity?: number
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, `FACTURE N° ${data.reference}`),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, 'Émis pour'),
        React.createElement(Text, { style: styles.value }, data.client.name),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, 'Objet'),
        React.createElement(Text, { style: styles.value }, data.subject),
      ),
      React.createElement(Text, { style: { marginTop: 24, fontSize: 14, fontWeight: 'bold' } }, `Total TTC : ${data.totalTtc.toFixed(2)} €`),
      React.createElement(
        Text,
        { style: { marginTop: 16, fontSize: 9, color: '#666' } },
        `Taux pénalités retard : ${data.latePenaltyRate ?? 18}%/an + indemnité forfaitaire 40 €.`,
      ),
      React.createElement(Text, { style: { marginTop: 32, fontSize: 8, color: '#999' } }, '⚠️ STUB — Factur-X conforme à implémenter Sprint 10-11'),
    ),
  )
  return renderToBuffer(doc)
}
