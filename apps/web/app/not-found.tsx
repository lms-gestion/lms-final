import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-brand-blue">404</h1>
        <p className="text-xl mt-4 mb-2">Page introuvable</p>
        <p className="text-muted-foreground mb-6">La page que vous cherchez n'existe pas.</p>
        <Link href="/" className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
