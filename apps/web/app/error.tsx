'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Une erreur est survenue</h1>
        <p className="text-muted-foreground mb-6">
          Le problème a été signalé à notre équipe. Vous pouvez réessayer ou revenir au tableau de bord.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            Réessayer
          </button>
          <a href="/" className="px-4 py-2 rounded-md border font-medium hover:bg-accent">
            Accueil
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-6 text-left text-xs bg-muted p-3 rounded overflow-auto max-h-40">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}
      </div>
    </div>
  )
}
