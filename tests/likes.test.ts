import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { likeUser } from '@/lib/likes'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: 'x' } })
}

describe('likeUser', () => {
  it('records a one-way like without creating a match', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    const result = await likeUser(alice.id, bob.id)

    expect(result.matched).toBe(false)
    expect(await prisma.match.count()).toBe(0)
  })

  it('creates a match when the like is mutual', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    await likeUser(alice.id, bob.id)
    const result = await likeUser(bob.id, alice.id)

    expect(result.matched).toBe(true)
    expect(await prisma.match.count()).toBe(1)
  })

  it('is idempotent when the same user likes twice', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com')

    await likeUser(alice.id, bob.id)
    await likeUser(alice.id, bob.id)

    expect(await prisma.like.count()).toBe(1)
  })

  it('rejects liking yourself', async () => {
    const alice = await createUser('alice@example.com')
    await expect(likeUser(alice.id, alice.id)).rejects.toThrow('cannot_like_self')
  })
})
