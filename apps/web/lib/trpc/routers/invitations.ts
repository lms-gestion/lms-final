/**
 * Gestion des invitations
 */

import { TRPCError } from '@trpc/server'
import { router, publicProcedure, orgProcedure, protectedProcedure } from '../server'
import { zInvitationInput, zSignupFromInvitationInput, generateToken } from '@lms/shared'
import { z } from 'zod'
import { db, schema } from '@lms/db'
import { and, eq, isNull } from 'drizzle-orm'
import { sendEmail, renderInvitationEmail } from '@lms/emails'
import { USER_ROLES } from '@lms/shared'

export const invitationsRouter = router({
  /** Lit une invitation par son token (public, pour la page d'acceptation) */
  getByToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ input }) => {
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
      .where(eq(schema.invitations.token, input.token))
      .limit(1)
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation inconnue' })
    if (inv.acceptedAt) throw new TRPCError({ code: 'CONFLICT', message: 'Déjà acceptée' })
    if (inv.revokedAt) throw new TRPCError({ code: 'GONE', message: 'Invitation révoquée' })
    if (inv.expiresAt < new Date()) throw new TRPCError({ code: 'GONE', message: 'Invitation expirée' })
    return inv
  }),

  /** Liste les invitations en attente de l'organisation (admin/owner) */
  list: orgProcedure.query(async ({ ctx }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    const invs = await db
      .select()
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.organizationId, ctx.organizationId),
          isNull(schema.invitations.acceptedAt),
          isNull(schema.invitations.revokedAt),
        ),
      )
    return invs
  }),

  /** Crée et envoie une invitation */
  send: orgProcedure.input(zInvitationInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission insuffisante' })
    }
    if (input.role === 'owner' && ctx.role !== 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
    }
    if (input.role === 'accountant' && ctx.role !== 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
    }

    // Vérifie pas déjà membre
    const { data: existing } = await ctx.supabase
      .from('memberships')
      .select('id, users!inner(email)')
      .eq('organization_id', ctx.organizationId)
      .eq('users.email', input.email)
    if (existing && existing.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Cette personne est déjà membre' })
    }

    const token = generateToken(32)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const [inv] = await db
      .insert(schema.invitations)
      .values({
        organizationId: ctx.organizationId,
        email: input.email,
        role: input.role,
        agencyIds: input.agencyIds ?? null,
        invitedBy: ctx.user.id,
        token,
        expiresAt,
        message: input.message,
      })
      .returning()

    if (!inv) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

    // Envoi email
    const { data: org } = await ctx.supabase.from('organizations').select('name').eq('id', ctx.organizationId).single()
    const inviterName = ctx.user.email ?? 'Un utilisateur'
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${token}`
    const emailContent = renderInvitationEmail({
      organizationName: org?.name ?? 'LMS Gestion',
      inviterName,
      inviterRole: USER_ROLES.find((r) => r.code === ctx.role)?.label ?? ctx.role,
      roleLabel: USER_ROLES.find((r) => r.code === input.role)?.label ?? input.role,
      inviteeFirstName: input.firstName,
      message: input.message,
      acceptUrl,
      expiryDate: expiresAt.toLocaleDateString('fr-FR'),
    })
    await sendEmail({ to: input.email, ...emailContent })

    return { id: inv.id }
  }),

  /** Accepte une invitation (user vient de créer son compte ou est connecté) */
  accept: protectedProcedure.input(zSignupFromInvitationInput).mutation(async ({ ctx, input }) => {
    const [inv] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.token, input.token))
      .limit(1)
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND' })
    if (inv.acceptedAt) throw new TRPCError({ code: 'CONFLICT', message: 'Déjà acceptée' })
    if (inv.revokedAt) throw new TRPCError({ code: 'GONE' })
    if (inv.expiresAt < new Date()) throw new TRPCError({ code: 'GONE', message: 'Expirée' })
    if (ctx.user.email !== inv.email) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Email ne correspond pas' })
    }

    // Update profil user
    await db
      .update(schema.users)
      .set({
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone || undefined,
      })
      .where(eq(schema.users.id, ctx.user.id))

    // Crée la membership
    await db.insert(schema.memberships).values({
      userId: ctx.user.id,
      organizationId: inv.organizationId,
      role: inv.role,
      agencyIds: inv.agencyIds,
      invitedBy: inv.invitedBy,
    })

    // Marque l'invitation comme acceptée
    await db
      .update(schema.invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.invitations.id, inv.id))

    return { organizationId: inv.organizationId, role: inv.role }
  }),

  /** Renvoie une invitation (génère un nouveau token, ancien invalide) */
  resend: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    const newToken = generateToken(32)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db
      .update(schema.invitations)
      .set({ token: newToken, expiresAt })
      .where(and(eq(schema.invitations.id, input.id), eq(schema.invitations.organizationId, ctx.organizationId)))
    return { ok: true }
  }),

  /** Révoque une invitation */
  revoke: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    await db
      .update(schema.invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitations.id, input.id), eq(schema.invitations.organizationId, ctx.organizationId)))
    return { ok: true }
  }),
})
