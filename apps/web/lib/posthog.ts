'use client'

/**
 * PostHog client pour analytics produit
 */

import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // on capture manuellement
    capture_pageleave: true,
    autocapture: false,
  })
}

export { posthog }
