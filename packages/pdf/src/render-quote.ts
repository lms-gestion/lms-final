/**
 * Génération du PDF d'un devis
 *
 * IMPLÉMENTATION COMPLÈTE : à finaliser en Sprint 8-9
 * (cf. spec module 06 §6).
 *
 * Pour Phase 0 / Sprint 0 : stub fonctionnel qui retourne un PDF minimal
 * pour valider le pipeline.
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

export type QuotePdfData = {
  reference: string
  issueDate: string
  expiryDate: string
  client: { name: string; address?: string }
  organization: { name: string; siret?: string; address?: string }
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
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, `DEVIS N° ${data.reference}`),
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
      React.createElement(Text, { style: { marginTop: 32, fontSize: 8, color: '#999' } }, '⚠️ STUB — Implémentation complète Sprint 8-9'),
    ),
  )
  return renderToBuffer(doc)
}
