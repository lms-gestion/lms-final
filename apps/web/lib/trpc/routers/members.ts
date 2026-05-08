/**
 * Routes membres (lecture, modification rôle, désactivation)
 */

import { router, orgProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db, schema } from '@lms/db'
import { and, eq } from 'drizzle-orm'

export const membersRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const memberships = await db
      .select({
        id: schema.memberships.id,
        userId: schema.memberships.userId,
        role: schema.memberships.role,
        agencyIds: schema.memberships.agencyIds,
        isActive: schema.memberships.isActive,
        createdAt: schema.memberships.createdAt,
        userEmail: schema.users.email,
        userFullName: schema.users.fullName,
        userAvatarUrl: schema.users.avatarUrl,
        userLastLoginAt: schema.users.lastLoginAt,
      })
      .from(schema.memberships)
      .leftJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(eq(schema.memberships.organizationId, ctx.organizationId))

    return memberships
  }),

  changeRole: orgProcedure
    .input(z.object({ membershipId: z.string().uuid(), role: z.enum(['owner', 'admin', 'accountant', 'technician', 'viewer']) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
      }
      await db
        .update(schema.memberships)
        .set({ role: input.role })
        .where(
          and(
            eq(schema.memberships.id, input.membershipId),
            eq(schema.memberships.organizationId, ctx.organizationId),
          ),
        )
      return { ok: true }
    }),

  deactivate: orgProcedure.input(z.object({ membershipId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    await db
      .update(schema.memberships)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.memberships.id, input.membershipId),
          eq(schema.memberships.organizationId, ctx.organizationId),
        ),
      )
    return { ok: true }
  }),
})
