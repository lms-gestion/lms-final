/**
 * Types TypeScript partagés
 */

export type UserRole = 'owner' | 'admin' | 'accountant' | 'technician' | 'viewer'

export type ChantierPriority = 'normal' | 'haute' | 'urgence'

export type ClientType =
  | 'syndic'
  | 'bailleur'
  | 'copropriete'
  | 'assurance'
  | 'tertiaire'
  | 'hotellerie'
  | 'particulier'

export type Address = {
  street?: string
  postalCode?: string
  city?: string
  country?: string
  lat?: number
  lng?: number
  placeId?: string
  formatted?: string
}

export type ConfidenceScore = {
  value: string | number | boolean | null
  confidence: number // 0-100
}

export type ApiResponse<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details?: unknown
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
