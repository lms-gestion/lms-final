/**
 * Génération XML CII Factur-X profil EN16931
 *
 * STUB Sprint 0 — implémentation détaillée Sprint 10-11.
 * Ressources :
 * - https://fnfe-mpe.org/factur-x/
 * - profil EN16931 : https://standards.cen.eu/dyn/www/f?p=204:32:0::::FSP_ORG_ID,FSP_LANG_ID:1883209,25
 */

import { XMLBuilder } from 'fast-xml-parser'

export type FacturxData = {
  reference: string
  issueDate: string // YYYY-MM-DD
  dueDate: string
  type: 'standard' | 'avoir' | 'acompte' | 'situation' | 'solde'
  currency?: string
  seller: {
    name: string
    siret: string
    tvaIntra?: string
    address: { street: string; postalCode: string; city: string; country?: string }
  }
  buyer: {
    name: string
    siret?: string
    address?: { street?: string; postalCode?: string; city?: string }
  }
  totalHt: number
  totalTva: number
  totalTtc: number
  vatBreakdown: Array<{ rate: number; baseHt: number; vat: number }>
  lines: Array<{
    position: number
    description: string
    quantity: number
    unit: string
    unitPriceHt: number
    vatRate: number
    totalHt: number
  }>
}

/** Mapping type interne → code CII (BT-3) */
const TYPE_CODE: Record<FacturxData['type'], string> = {
  standard: '380',
  avoir: '381',
  acompte: '386',
  situation: '386',
  solde: '380',
}

export function generateFacturxXml(data: FacturxData): string {
  const xmlObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'rsm:CrossIndustryInvoice': {
      '@_xmlns:rsm': 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
      '@_xmlns:ram': 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
      '@_xmlns:udt': 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
      'rsm:ExchangedDocumentContext': {
        'ram:GuidelineSpecifiedDocumentContextParameter': {
          'ram:ID': 'urn:cen.eu:en16931:2017',
        },
      },
      'rsm:ExchangedDocument': {
        'ram:ID': data.reference,
        'ram:TypeCode': TYPE_CODE[data.type],
        'ram:IssueDateTime': {
          'udt:DateTimeString': { '@_format': '102', '#text': data.issueDate.replace(/-/g, '') },
        },
      },
      'rsm:SupplyChainTradeTransaction': {
        'ram:IncludedSupplyChainTradeLineItem': data.lines.map((line) => ({
          'ram:AssociatedDocumentLineDocument': { 'ram:LineID': String(line.position) },
          'ram:SpecifiedTradeProduct': { 'ram:Name': line.description },
          'ram:SpecifiedLineTradeAgreement': {
            'ram:NetPriceProductTradePrice': { 'ram:ChargeAmount': line.unitPriceHt.toFixed(2) },
          },
          'ram:SpecifiedLineTradeDelivery': {
            'ram:BilledQuantity': { '@_unitCode': line.unit, '#text': line.quantity.toString() },
          },
          'ram:SpecifiedLineTradeSettlement': {
            'ram:ApplicableTradeTax': {
              'ram:TypeCode': 'VAT',
              'ram:CategoryCode': 'S',
              'ram:RateApplicablePercent': line.vatRate.toFixed(2),
            },
            'ram:SpecifiedTradeSettlementLineMonetarySummation': {
              'ram:LineTotalAmount': line.totalHt.toFixed(2),
            },
          },
        })),
        'ram:ApplicableHeaderTradeAgreement': {
          'ram:SellerTradeParty': {
            'ram:Name': data.seller.name,
            'ram:SpecifiedLegalOrganization': { 'ram:ID': { '@_schemeID': '0002', '#text': data.seller.siret } },
            'ram:PostalTradeAddress': {
              'ram:LineOne': data.seller.address.street,
              'ram:PostcodeCode': data.seller.address.postalCode,
              'ram:CityName': data.seller.address.city,
              'ram:CountryID': data.seller.address.country ?? 'FR',
            },
            ...(data.seller.tvaIntra && {
              'ram:SpecifiedTaxRegistration': {
                'ram:ID': { '@_schemeID': 'VA', '#text': data.seller.tvaIntra },
              },
            }),
          },
          'ram:BuyerTradeParty': { 'ram:Name': data.buyer.name },
        },
        'ram:ApplicableHeaderTradeDelivery': {},
        'ram:ApplicableHeaderTradeSettlement': {
          'ram:InvoiceCurrencyCode': data.currency ?? 'EUR',
          'ram:SpecifiedTradeSettlementHeaderMonetarySummation': {
            'ram:LineTotalAmount': data.totalHt.toFixed(2),
            'ram:TaxBasisTotalAmount': data.totalHt.toFixed(2),
            'ram:TaxTotalAmount': { '@_currencyID': 'EUR', '#text': data.totalTva.toFixed(2) },
            'ram:GrandTotalAmount': data.totalTtc.toFixed(2),
            'ram:DuePayableAmount': data.totalTtc.toFixed(2),
          },
          'ram:SpecifiedTradePaymentTerms': {
            'ram:DueDateDateTime': {
              'udt:DateTimeString': { '@_format': '102', '#text': data.dueDate.replace(/-/g, '') },
            },
          },
          'ram:ApplicableTradeTax': data.vatBreakdown.map((b) => ({
            'ram:CalculatedAmount': b.vat.toFixed(2),
            'ram:TypeCode': 'VAT',
            'ram:BasisAmount': b.baseHt.toFixed(2),
            'ram:CategoryCode': 'S',
            'ram:RateApplicablePercent': b.rate.toFixed(2),
          })),
        },
      },
    },
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(xmlObj)}`
}
