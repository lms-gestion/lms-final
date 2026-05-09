/**
 * Router racine tRPC : assemble tous les sous-routers
 */

import { router } from './server'
import { suppliersRouter } from './routers/suppliers'
import { techniciansRouter } from './routers/technicians'
import { authRouter } from './routers/auth'
import { onboardingRouter } from './routers/onboarding'
import { invitationsRouter } from './routers/invitations'
import { membersRouter } from './routers/members'
import { agenciesRouter } from './routers/agencies'
import { clientLocationsRouter } from './routers/client-locations'
import { clientsRouter } from './routers/clients'
import { chantiersRouter } from './routers/chantiers'

export const appRouter = router({
  chantiers: chantiersRouter,
  suppliers: suppliersRouter,
  technicians: techniciansRouter,
  auth: authRouter,
  onboarding: onboardingRouter,
  invitations: invitationsRouter,
  members: membersRouter,
  agencies: agenciesRouter,
  clientLocations: clientLocationsRouter,
  clients: clientsRouter,
})

export type AppRouter = typeof appRouter

