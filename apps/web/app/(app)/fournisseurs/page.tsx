import { FournisseursClient } from './fournisseurs-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function FournisseursPage() {
  return <FournisseursClient />
}
