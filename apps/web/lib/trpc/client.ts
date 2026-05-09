'use client'

import { createTRPCReact } from '@trpc/react-query'
import type { CreateTRPCReact } from '@trpc/react-query'
import type { AppRouter } from './root'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()
