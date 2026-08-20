import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('database schema', () => {
  it('creates and retrieves a user with default role and suspended flag', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@example.com', passwordHash: 'hashed' },
    })

    const found = await prisma.user.findUnique({ where: { id: user.id } })

    expect(found?.email).toBe('test@example.com')
    expect(found?.role).toBe('user')
    expect(found?.suspended).toBe(false)
  })
})
