/**
 * Onboarding wizard : création d'organisation, première agence, invitations
 */

import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../server'
import { zOnboardingStep1, zOnboardingStep3, zInvitationInput } from '@lms/shared'
import { z } from 'zod'
import { db, schema } from '@lms/db'
import { eq } from 'drizzle-orm'
import { generateToken } from '@lms/shared'

export const onboardingRouter = router({
  /** Vérifie si le user a déjà une organisation */
  status: protectedProcedure.query(async ({ ctx }) => {
    const { data: memberships } = await ctx.supabase
      .from('memberships')
      .select('organization_id, organizations!inner(id, slug, name)')
      .eq('user_id', ctx.user.id)
      .eq('is_active', true)
    return {
      hasOrganization: (memberships?.length ?? 0) > 0,
      organizations: memberships ?? [],
    }
  }),

  /** Étape 1+2+3 combinées : création organisation + agence */
  create: protectedProcedure
    .input(
      z.object({
        organization: zOnboardingStep1,
        agency: zOnboardingStep3,
        branding: z
          .object({
            primaryColor: z.string().default('#0F2644'),
            accentColor: z.string().default('#F5A623'),
            ctaColor: z.string().default('#F97316'),
            fontFamily: z.string().default('Inter'),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Vérifie qu'il n'a pas déjà une organisation
      const { data: existingMemberships } = await ctx.supabase
        .from('memberships')
        .select('id')
        .eq('user_id', ctx.user.id)
      if (existingMemberships && existingMemberships.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Vous avez déjà une organisation.' })
      }

      const slug = input.organization.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)

      // Transaction Drizzle
      const [organization] = await db
        .insert(schema.organizations)
        .values({
          slug: `${slug}-${Date.now().toString(36)}`,
          name: input.organization.name,
          legalName: input.organization.legalName,
          siret: input.organization.siret || undefined,
          tvaIntra: input.organization.tvaIntra,
          legalForm: input.organization.legalForm,
          apeCode: input.organization.apeCode,
          address: input.organization.address,
        })
        .returning()
      if (!organization) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Échec création organisation' })

      await db.insert(schema.organizationSettings).values({
        organizationId: organization.id,
        branding: input.branding ?? {
          primaryColor: '#0F2644',
          accentColor: '#F5A623',
          ctaColor: '#F97316',
          fontFamily: 'Inter',
        },
        documentDefaults: {
          paymentTermsDays: 30,
          quoteValidityDays: 30,
          latePenaltyRatePct: 18.0,
          lateIndemnityEur: 40,
        },
        aiSettings: { enabled: true, monthlyCapEur: 100, enabledTypes: ['bc', 'facture', 'attestation', 'photo', 'text'] },
        securitySettings: { mfaRequiredRoles: ['owner', 'admin', 'accountant'], sessionTimeoutMinutes: 60 },
        onboardingState: { completedAt: new Date().toISOString(), currentStep: 4 },
      })

      // Créer la membership owner
      await db.insert(schema.memberships).values({
        userId: ctx.user.id,
        organizationId: organization.id,
        role: 'owner',
        agencyIds: null,
      })

      // Créer la première agence
      const [agency] = await db
        .insert(schema.agencies)
        .values({
          organizationId: organization.id,
          name: input.agency.name,
          code: input.agency.code,
          address: input.agency.address,
          phone: input.agency.phone || undefined,
          email: input.agency.email || undefined,
          postalCodes: input.agency.postalCodes,
          metiers: input.agency.metiers,
          status: 'active',
        })
        .returning()

      // Colonnes Kanban par défaut
      await db.insert(schema.chantierColumns).values([
        { organizationId: organization.id, position: 0, key: 'nouveau', label: 'Nouveau', emoji: '🆕', color: '#0ea5e9', bgColor: '#f0f9ff', borderColor: '#bae6fd', isInitial: true, isTerminal: false },
        { organizationId: organization.id, position: 1, key: 'planifie', label: 'Planifié', emoji: '📅', color: '#ffb020', bgColor: '#fffbeb', borderColor: '#fde68a', isInitial: false, isTerminal: false },
        { organizationId: organization.id, position: 2, key: 'en_cours', label: 'En cours', emoji: '🔧', color: '#0f3b78', bgColor: '#e8f2ff', borderColor: '#bdd6f5', isInitial: false, isTerminal: false },
        { organizationId: organization.id, position: 3, key: 'termine', label: 'Terminé', emoji: '✅', color: '#16a34a', bgColor: '#dcfce7', borderColor: '#bbf7d0', isInitial: false, isTerminal: true },
      ])

      return { organization, agency }
    }),

  /** Envoi des invitations en bulk (étape 4) */
  sendInvitations: protectedProcedure
    .input(z.object({ invitations: z.array(zInvitationInput) }))
    .mutation(async ({ ctx, input }) => {
      // Récupère l'org du user
      const { data: membership } = await ctx.supabase
        .from('memberships')
        .select('organization_id, role')
        .eq('user_id', ctx.user.id)
        .eq('is_active', true)
        .single()
      if (!membership || (membership.role as string) !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
      }

      const orgId = membership.organization_id as string
      const created: string[] = []

      for (const invInput of input.invitations) {
        const token = generateToken(32)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const [inv] = await db
          .insert(schema.invitations)
          .values({
            organizationId: orgId,
            email: invInput.email,
            role: invInput.role,
            agencyIds: invInput.agencyIds ?? null,
            invitedBy: ctx.user.id,
            token,
            expiresAt,
            message: invInput.message,
          })
          .returning()
        if (inv) created.push(inv.id)
        // L'email d'invitation sera envoyé via Inngest job (cf. packages/emails)
      }

      return { created: created.length }
    }),
})
