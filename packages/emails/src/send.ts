/**
 * Envoi d'emails transactionnels via Resend
 */

import { getResendClient, FROM_EMAIL } from './client'

export type EmailAttachment = {
  filename: string
  content: Buffer | string
  contentType?: string
}

export type SendEmailOpts = {
  to: string | string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  html?: string
  text?: string
  attachments?: EmailAttachment[]
  tags?: { name: string; value: string }[]
  organizationId?: string
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ id: string } | null> {
  const resend = getResendClient()
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      cc: opts.cc,
      bcc: opts.bcc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html ?? '',
      text: opts.text,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
      })),
      tags: opts.tags,
    })
    return result.data ? { id: result.data.id } : null
  } catch (err) {
    console.error('[email] envoi échoué', err)
    return null
  }
}

// ─── Templates renderable côté serveur ───
// Les templates HTML sont dans packages/emails/templates/*.tsx (React Email)
// À rédiger dans la phase 2 de la Sprint 0 (cf. spec module 01 §6)

export function renderInvitationEmail(opts: {
  organizationName: string
  inviterName: string
  inviterRole: string
  roleLabel: string
  inviteeFirstName?: string
  message?: string
  acceptUrl: string
  expiryDate: string
}): { subject: string; html: string; text: string } {
  const subject = `${opts.organizationName} vous invite à rejoindre LMS Gestion`
  const text = `Bonjour ${opts.inviteeFirstName ?? 'là'},

${opts.inviterName} (${opts.inviterRole}) vous invite à rejoindre ${opts.organizationName}
sur LMS Gestion en tant que ${opts.roleLabel}.

${opts.message ? `> ${opts.message}\n\n` : ''}
Accepter l'invitation : ${opts.acceptUrl}

Ce lien est valable 7 jours et expire le ${opts.expiryDate}.

Si vous ne connaissez pas ${opts.inviterName} ou si vous pensez que cet email a été
envoyé par erreur, ignorez-le.

—
LMS Gestion · La Maison des Services`

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#0F2644;">
<h2 style="color:#0F2644;">${opts.organizationName} vous invite à rejoindre LMS Gestion</h2>
<p>Bonjour ${opts.inviteeFirstName ?? 'là'},</p>
<p><strong>${opts.inviterName}</strong> (${opts.inviterRole}) vous invite à rejoindre <strong>${opts.organizationName}</strong> sur LMS Gestion en tant que <strong>${opts.roleLabel}</strong>.</p>
${opts.message ? `<blockquote style="border-left:3px solid #F5A623;padding:8px 16px;color:#555;">${opts.message}</blockquote>` : ''}
<p style="margin:32px 0;text-align:center;">
  <a href="${opts.acceptUrl}" style="background:linear-gradient(135deg,#F5A623,#F97316);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">Accepter l'invitation</a>
</p>
<p style="color:#666;font-size:13px;">Ce lien est valable 7 jours et expire le ${opts.expiryDate}.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
<p style="color:#999;font-size:12px;">LMS Gestion · La Maison des Services</p>
</body></html>`

  return { subject, html, text }
}

export function renderMagicLinkEmail(opts: { magicLink: string }): {
  subject: string
  html: string
  text: string
} {
  return {
    subject: 'Votre lien de connexion à LMS Gestion',
    text: `Voici votre lien de connexion à LMS Gestion. Il est valable 15 minutes et à usage unique.

${opts.magicLink}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

— LMS Gestion`,
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:24px;color:#0F2644;">
<h2>Votre lien de connexion</h2>
<p style="margin:24px 0;">
  <a href="${opts.magicLink}" style="background:#0F2644;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Se connecter</a>
</p>
<p style="color:#666;">Lien valable 15 minutes, à usage unique.</p>
</body></html>`,
  }
}
