import { notFound } from 'next/navigation'
import { db, schema } from '@lms/db'
import { eq } from 'drizzle-orm'
import { InvitationAcceptForm } from './accept-form'

export const metadata = { title: 'Invitation' }

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const [inv] = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      role: schema.invitations.role,
      message: schema.invitations.message,
      expiresAt: schema.invitations.expiresAt,
      acceptedAt: schema.invitations.acceptedAt,
      revokedAt: schema.invitations.revokedAt,
      organizationName: schema.organizations.name,
    })
    .from(schema.invitations)
    .leftJoin(schema.organizations, eq(schema.invitations.organizationId, schema.organizations.id))
    .where(eq(schema.invitations.token, params.token))
    .limit(1)

  if (!inv) notFound()

  if (inv.acceptedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Invitation déjà acceptée</h1>
          <p className="text-muted-foreground">Cette invitation a déjà été utilisée. Connectez-vous pour accéder à votre compte.</p>
          <a href="/login" className="mt-6 inline-block px-4 py-2 bg-brand-blue text-white rounded-md">
            Aller à la connexion
          </a>
        </div>
      </div>
    )
  }

  if (inv.revokedAt || inv.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Invitation expirée</h1>
          <p className="text-muted-foreground">
            Cette invitation a expiré ou été révoquée. Demandez à votre administrateur d'en envoyer une nouvelle.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-2xl shadow-xl p-8 border">
          <h1 className="text-xl font-bold mb-2">{inv.organizationName} vous invite</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Vous avez été invité à rejoindre <strong>{inv.organizationName}</strong> en tant que <strong>{inv.role}</strong>.
          </p>
          {inv.message && (
            <blockquote className="border-l-4 border-brand-gold pl-4 py-2 text-sm text-muted-foreground italic mb-6">
              {inv.message}
            </blockquote>
          )}
          <InvitationAcceptForm token={params.token} email={inv.email} />
        </div>
      </div>
    </div>
  )
}
