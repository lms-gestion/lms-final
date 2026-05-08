/**
 * Routes tRPC pour l'authentification (login, magic link, reset password)
 * Le gros du travail est délégué à Supabase Auth.
 */

import { router, publicProcedure, protectedProcedure } from '../server'
import { TRPCError } from '@trpc/server'
import { zLoginInput, zMagicLinkInput, zPasswordResetInput, zPasswordChangeInput, zMfaVerifyInput } from '@lms/shared'
import { z } from 'zod'

export const authRouter = router({
  /** Connexion email/password */
  login: publicProcedure.input(zLoginInput).mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })
    if (error) {
      // On reste générique pour ne pas révéler l'existence des comptes
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Identifiant ou mot de passe incorrect.' })
    }
    return { user: data.user, session: data.session }
  }),

  /** Demande de magic link */
  magicLink: publicProcedure.input(zMagicLinkInput).mutation(async ({ ctx, input }) => {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    await ctx.supabase.auth.signInWithOtp({
      email: input.email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    })
    // Réponse identique succès/échec pour ne pas énumérer
    return { ok: true }
  }),

  /** Demande de reset password */
  requestPasswordReset: publicProcedure.input(zPasswordResetInput).mutation(async ({ ctx, input }) => {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
    await ctx.supabase.auth.resetPasswordForEmail(input.email, { redirectTo })
    return { ok: true }
  }),

  /** Changement de mot de passe (user connecté) */
  changePassword: protectedProcedure.input(zPasswordChangeInput).mutation(async ({ ctx, input }) => {
    // Vérifier l'ancien mot de passe (pas natif Supabase, on tente une connexion silencieuse)
    const { error: signInErr } = await ctx.supabase.auth.signInWithPassword({
      email: ctx.user.email!,
      password: input.currentPassword,
    })
    if (signInErr) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Mot de passe actuel incorrect' })
    }
    const { error } = await ctx.supabase.auth.updateUser({ password: input.newPassword })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { ok: true }
  }),

  /** Met à jour le mot de passe après reset (user vient du lien email) */
  setNewPasswordAfterReset: publicProcedure
    .input(z.object({ password: z.string().min(12) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.auth.updateUser({ password: input.password })
      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
      return { ok: true }
    }),

  /** Démarre l'enrôlement MFA TOTP */
  enrollMfa: protectedProcedure.mutation(async ({ ctx }) => {
    const { data, error } = await ctx.supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    }
  }),

  /** Vérifie le challenge MFA pendant l'enrôlement */
  verifyMfaEnroll: protectedProcedure
    .input(z.object({ factorId: z.string(), code: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const { data: challenge, error: chErr } = await ctx.supabase.auth.mfa.challenge({ factorId: input.factorId })
      if (chErr || !challenge) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: chErr?.message })
      const { error } = await ctx.supabase.auth.mfa.verify({
        factorId: input.factorId,
        challengeId: challenge.id,
        code: input.code,
      })
      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Code invalide' })
      return { ok: true }
    }),

  /** Vérifie un code TOTP au login (step-up) */
  verifyMfa: protectedProcedure.input(zMfaVerifyInput).mutation(async ({ ctx, input }) => {
    const { data: factors } = await ctx.supabase.auth.mfa.listFactors()
    const totp = factors?.totp[0]
    if (!totp) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun facteur MFA actif' })
    const { data: ch, error: chErr } = await ctx.supabase.auth.mfa.challenge({ factorId: totp.id })
    if (chErr || !ch) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: chErr?.message })
    const { error } = await ctx.supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: ch.id,
      code: input.code,
    })
    if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Code invalide' })
    return { ok: true }
  }),

  /** Désactive un facteur MFA (step-up auth requise via re-saisie pwd côté UI) */
  unenrollMfa: protectedProcedure.input(z.object({ factorId: z.string() })).mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabase.auth.mfa.unenroll({ factorId: input.factorId })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { ok: true }
  }),

  /** Récupère le user courant (pour rehydrater côté client) */
  me: protectedProcedure.query(async ({ ctx }) => {
    return { id: ctx.user.id, email: ctx.user.email }
  }),

  /** Déconnexion */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.supabase.auth.signOut()
    return { ok: true }
  }),
})
