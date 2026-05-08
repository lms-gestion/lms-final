/**
 * Route handler tRPC (Next.js App Router)
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest } from 'next/server'
import { appRouter } from '@/lib/trpc/root'
import { createTRPCContext } from '@/lib/trpc/server'

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] ${path} error:`, error)
      }
    },
  })

export { handler as GET, handler as POST }
