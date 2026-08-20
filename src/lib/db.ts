import { PrismaClient } from '@prisma/client'
import { loadEnv } from '@/lib/env'

// Fail fast on a misconfigured deployment. Without this, a missing or
// mistyped variable boots fine and only surfaces at first use — e.g. the first
// photo upload failing in production. This module sits on essentially every
// server code path, so validating here covers the whole app, and it runs after
// `@prisma/client` has loaded the .env file.
loadEnv()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
