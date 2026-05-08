/**
 * Routes agences (CRUD)
 */

import { router, orgProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { db, schema } from '@lms/db'
import { and, eq } from 'drizzle-orm'
import { zAddress } from '@lms/shared'

const zAgencyInput = z.object({
  name: z.string().min(1),
  code: z.string().regex(/^[A-Z]{2,4}$/),
  address: zAddress.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  postalCodes: z.array(z.string()).default([]),
  metiers: z.array(z.string()).default([]),
})

export const agenciesRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(schema.agencies)
      .where(eq(schema.agencies.organizationId, ctx.organizationId))
  }),

  create: orgProcedure.input(zAgencyInput).mutation(async ({ ctx, input }) => {
    if (ctx.role !== 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
    }
    const [agency] = await db
      .insert(schema.agencies)
      .values({
        organizationId: ctx.organizationId,
        name: input.name,
        code: input.code,
        address: input.address,
        phone: input.phone,
        email: input.email || undefined,
        postalCodes: input.postalCodes,
        metiers: input.metiers,
        status: 'active',
      })
      .returning()
    return agency
  }),

  update: orgProcedure
    .input(z.object({ id: z.string().uuid(), data: zAgencyInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      await db
        .update(schema.agencies)
        .set(input.data)
        .where(and(eq(schema.agencies.id, input.id), eq(schema.agencies.organizationId, ctx.organizationId)))
      return { ok: true }
    }),
})
