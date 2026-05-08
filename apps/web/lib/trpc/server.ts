/**
 * Configuration tRPC côté serveur (router root + procédures protégées)
 */

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { createSupabaseServer } from '@/lib/supabase/server'
import { db } from '@lms/db'

// ─── Context ───
export async function createTRPCContext(opts?: { headers?: Headers }) {
  const supabase = createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return {
    supabase,
    user, // Supabase auth user (id, email)
    db,
    headers: opts?.headers,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

// ─── Init ───
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// ─── Public procedure (sans auth) ───
export const publicProcedure = t.procedure

// ─── Protected procedure (user connecté) ───
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Connexion requise' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// ─── Org procedure (user dans une organisation active) ───
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Récupère l'organisation active depuis cookie / JWT custom claim
  const orgIdHeader = ctx.headers?.get('x-organization-id')
  const orgId = orgIdHeader ?? null
  if (!orgId) {
    // Fallback : lookup la première membership active
    const { data: memberships } = await ctx.supabase
      .from('memberships')
      .select('organization_id, role, agency_ids')
      .eq('user_id', ctx.user.id)
      .eq('is_active', true)
      .limit(1)
    if (!memberships || memberships.length === 0) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Aucune organisation' })
    }
    return next({
      ctx: {
        ...ctx,
        organizationId: memberships[0]!.organization_id as string,
        role: memberships[0]!.role as string,
        agencyIds: (memberships[0]!.agency_ids as string[] | null) ?? null,
      },
    })
  }
  // Vérifie que le user a accès à cette org
  const { data: membership } = await ctx.supabase
    .from('memberships')
    .select('role, agency_ids, is_active')
    .eq('user_id', ctx.user.id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!membership || !membership.is_active) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Pas d\'accès à cette organisation' })
  }
  return next({
    ctx: {
      ...ctx,
      organizationId: orgId,
      role: membership.role as string,
      agencyIds: (membership.agency_ids as string[] | null) ?? null,
    },
  })
})

export const router = t.router
export const middleware = t.middleware

// Export type for client
export type AppRouter = typeof import('./root').appRouter
