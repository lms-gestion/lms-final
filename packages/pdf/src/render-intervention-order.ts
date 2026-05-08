/**
 * Génération PDF d'un Bon d'Intervention (cf. spec module 08 §6).
 * Sprint 0 : stub. Sprint 12 : implémentation complète + signature.
 */

import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0F2644' },
})

export type InterventionOrderPdfData = {
  reference: string
  interventionDate: string
  technicianName: string
  client: { name: string }
  workDescription: string
  totalTtc: number
  isSigned: boolean
  signatureName?: string
  signatureDate?: string
}

export async function renderInterventionOrderPdf(data: InterventionOrderPdfData): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, `BON D'INTERVENTION N° ${data.reference}`),
      React.createElement(Text, null, `Client : ${data.client.name}`),
      React.createElement(Text, null, `Technicien : ${data.technicianName}`),
      React.createElement(Text, null, `Date : ${data.interventionDate}`),
      React.createElement(Text, { style: { marginTop: 16 } }, data.workDescription),
      React.createElement(Text, { style: { marginTop: 16, fontWeight: 'bold' } }, `Total TTC : ${data.totalTtc.toFixed(2)} €`),
      data.isSigned
        ? React.createElement(Text, { style: { marginTop: 24, color: '#16a34a' } }, `✓ Signé par ${data.signatureName} le ${data.signatureDate}`)
        : React.createElement(Text, { style: { marginTop: 24, color: '#999' } }, 'Bon pour accord — Date / Signature : ____________'),
      React.createElement(Text, { style: { marginTop: 32, fontSize: 8, color: '#999' } }, '⚠️ STUB — Sprint 12'),
    ),
  )
  return renderToBuffer(doc)
}
