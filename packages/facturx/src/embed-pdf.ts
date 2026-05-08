/**
 * Embarque le XML Factur-X dans un PDF/A-3.
 *
 * STUB Sprint 0 — implémentation Sprint 10-11.
 * Pour vraie conformité PDF/A-3 : nécessite Ghostscript ou librairie spécialisée
 * (post-traitement après pdf-lib).
 */

import { PDFDocument } from 'pdf-lib'

export async function embedFacturxXml(opts: {
  pdfBuffer: Buffer
  xml: string
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(opts.pdfBuffer)

  await pdfDoc.attach(Buffer.from(opts.xml, 'utf-8'), 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X CII — Profil EN16931',
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  // Pour le PDF/A-3 strict, post-processing Ghostscript requis :
  //   gs -dPDFA=3 -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile=out.pdf input.pdf
  // À implémenter dans un job Inngest Sprint 10.

  const result = await pdfDoc.save()
  return Buffer.from(result)
}
