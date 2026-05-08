/**
 * Constantes partagées entre tous les packages
 */

export const APP_NAME = 'LMS Gestion'
export const APP_VERSION = '0.1.0'
export const COMPANY_NAME = 'La Maison des Services'

// ─── Métiers ───
export const METIERS = [
  { code: 'plomberie', label: 'Plomberie', emoji: '🔧' },
  { code: 'electricite', label: 'Électricité', emoji: '⚡' },
  { code: 'toiture', label: 'Toiture & Étanchéité', emoji: '🏠' },
  { code: 'serrurerie', label: 'Serrurerie', emoji: '🔒' },
  { code: 'menuiserie', label: 'Menuiserie', emoji: '🪵' },
  { code: 'peinture', label: 'Peinture', emoji: '🎨' },
  { code: 'maconnerie', label: 'Maçonnerie', emoji: '🧱' },
  { code: 'syndics', label: 'Syndics & Copropriétés', emoji: '🏢' },
  { code: 'autre', label: 'Autre', emoji: '🛠️' },
] as const

// ─── Types client ───
export const CLIENT_TYPES = [
  { code: 'syndic', label: 'Syndic de copropriété' },
  { code: 'bailleur', label: 'Bailleur / Gestionnaire' },
  { code: 'copropriete', label: 'Copropriété en autogestion' },
  { code: 'assurance', label: 'Assurance / Expert sinistre' },
  { code: 'tertiaire', label: 'Tertiaire / Entreprise' },
  { code: 'hotellerie', label: 'Hôtel / Résidence' },
  { code: 'particulier', label: 'Particulier' },
] as const

// ─── Priorités ───
export const PRIORITIES = [
  { code: 'normal', label: 'Normal', color: '#16a34a', emoji: '🟢' },
  { code: 'haute', label: 'Haute', color: '#f59e0b', emoji: '🟡' },
  { code: 'urgence', label: 'Urgence — 4h', color: '#dc2626', emoji: '🔴' },
] as const

// ─── Types intervention ───
export const INTERVENTION_TYPES = [
  { code: 'diagnostic', label: 'Diagnostic', emoji: '🔍', defaultDuration: 60 },
  { code: 'reparation', label: 'Réparation', emoji: '🛠️', defaultDuration: 120 },
  { code: 'travaux', label: 'Travaux', emoji: '🏗️', defaultDuration: 240 },
  { code: 'controle', label: 'Contrôle', emoji: '✅', defaultDuration: 30 },
  { code: 'urgence', label: 'Urgence', emoji: '🚨', defaultDuration: 90 },
  { code: 'livraison', label: 'Livraison', emoji: '📦', defaultDuration: 30 },
  { code: 'autre', label: 'Autre', emoji: '📋', defaultDuration: 60 },
] as const

// ─── Rôles utilisateur ───
export const USER_ROLES = [
  { code: 'owner', label: 'Gérant', description: 'Accès complet à toute l\'organisation' },
  { code: 'admin', label: 'Chef d\'agence', description: 'Gestion d\'une ou plusieurs agences' },
  { code: 'accountant', label: 'Comptable', description: 'Lecture globale, gestion des factures' },
  { code: 'technician', label: 'Technicien', description: 'Ses chantiers assignés' },
  { code: 'viewer', label: 'Lecture seule', description: 'Consultation uniquement' },
] as const

// ─── Taux TVA français ───
export const VAT_RATES = [
  { rate: 20, label: '20% (standard)' },
  { rate: 10, label: '10% (rénovation logement >2 ans)' },
  { rate: 5.5, label: '5,5% (amélioration énergétique)' },
  { rate: 0, label: '0% (exonéré)' },
] as const

// ─── Unités ligne facture/devis ───
export const LINE_UNITS = [
  { code: 'u', label: 'unité' },
  { code: 'h', label: 'heure' },
  { code: 'j', label: 'jour' },
  { code: 'ml', label: 'mètre linéaire' },
  { code: 'm²', label: 'mètre carré' },
  { code: 'm³', label: 'mètre cube' },
  { code: 'kg', label: 'kilogramme' },
  { code: 'forfait', label: 'forfait' },
] as const

// ─── Modes de paiement ───
export const PAYMENT_METHODS = [
  { code: 'virement', label: 'Virement' },
  { code: 'cheque', label: 'Chèque' },
  { code: 'cb', label: 'Carte bancaire' },
  { code: 'especes', label: 'Espèces' },
  { code: 'prelevement', label: 'Prélèvement SEPA' },
  { code: 'traite', label: 'Traite' },
] as const

// ─── Limites ───
export const LIMITS = {
  password: {
    minLength: 12,
  },
  upload: {
    maxFileSizeMb: 25,
    maxPhotoSizeMb: 10,
    maxLogoSizeMb: 2,
  },
  ai: {
    defaultMonthlyCapEur: 100,
  },
  reminders: {
    quoteRelance1Days: 7,
    quoteRelance2Days: 15,
    invoiceRelance1Days: 1,
    invoiceRelance2Days: 15,
    invoiceFormalNoticeDays: 30,
  },
} as const

// ─── Couleurs charte LMS ───
export const BRAND_COLORS = {
  dark: '#07172f',
  dark2: '#09265a',
  blue: '#0F2644',
  blueMid: '#1554a6',
  blueLight: '#e8f2ff',
  gold: '#F5A623',
  orange: '#F97316',
  orangeDark: '#ea580c',
  orangeLight: '#fff7ed',
} as const
