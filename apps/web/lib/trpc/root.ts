/**
 * Router racine tRPC : assemble tous les sous-routers
 */

import { router } from './server'
import { authRouter } from './routers/auth'
import { onboardingRouter } from './routers/onboarding'
import { invitationsRouter } from './routers/invitations'
import { membersRouter } from './routers/members'
import { agenciesRouter } from './routers/agencies'
import { clientsRouter } from './routers/clients'

export const appRouter = router({
  auth: authRouter,
  onboarding: onboardingRouter,
  invitations: invitationsRouter,
  members: membersRouter,
  agencies: agenciesRouter,
  clients: clientsRouter,
})

export type AppRouter = typeof appRouter
