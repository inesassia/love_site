import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { authorizeCredentials } from '@/lib/auth'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('authorizeCredentials', () => {
  it('returns the user when credentials are correct', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    const user = await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } })

    const result = await authorizeCredentials('alice@example.com', 'S3cret!Pass')

    expect(result).toEqual({ id: user.id, email: user.email, role: 'user' })
  })

  it('returns null for a wrong password', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    await prisma.user.create({ data: { email: 'alice@example.com', passwordHash } })

    expect(await authorizeCredentials('alice@example.com', 'wrong')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    expect(await authorizeCredentials('nobody@example.com', 'whatever')).toBeNull()
  })

  it('returns null for a suspended user even with the correct password', async () => {
    const passwordHash = await hashPassword('S3cret!Pass')
    await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash, suspended: true },
    })

    expect(await authorizeCredentials('alice@example.com', 'S3cret!Pass')).toBeNull()
  })
})
