import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { likeUser } from '@/lib/likes'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUserWithProfile(email: string, gender: 'homme' | 'femme', suspended = false) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
      suspended,
      profile: {
        create: {
          firstName: email,
          birthDate: new Date('1995-01-01'),
          gender,
          city: 'Paris',
          country: 'France',
          bio: 'Bio',
          denomination: 'catholique',
          churchAttendance: 'regulierement',
          marriageVision: 'Famille unie',
          favoriteVerseOrValue: 'Philippiens 4:13',
        },
      },
    },
    include: { profile: true },
  })
}

describe('likeUser', () => {
  it('records a one-way like without creating a match', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    const result = await likeUser(alice.id, bob.id)

    expect(result.matched).toBe(false)
    expect(await prisma.match.count()).toBe(0)
  })

  it('creates a match when the like is mutual', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    await likeUser(alice.id, bob.id)
    const result = await likeUser(bob.id, alice.id)

    expect(result.matched).toBe(true)
    expect(await prisma.match.count()).toBe(1)
  })

  it('is idempotent when the same user likes twice', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    await likeUser(alice.id, bob.id)
    await likeUser(alice.id, bob.id)

    expect(await prisma.like.count()).toBe(1)
  })

  it('rejects liking yourself', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    await expect(likeUser(alice.id, alice.id)).rejects.toThrow('cannot_like_self')
  })

  it('rejects liking a same-gender user', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')
    const charlie = await createUserWithProfile('charlie@example.com', 'femme')

    await likeUser(alice.id, bob.id)
    await expect(likeUser(alice.id, charlie.id)).rejects.toThrow('invalid_target')
  })

  it('rejects liking a suspended user', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme', true)

    await expect(likeUser(alice.id, bob.id)).rejects.toThrow('invalid_target')
  })

  it('rejects a like sent by a suspended user and creates no Like row', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme', true)
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    await expect(likeUser(alice.id, bob.id)).rejects.toThrow('suspended')
    expect(await prisma.like.count()).toBe(0)
  })

  it('rejects liking a user when the liker is blocked', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    await prisma.block.create({
      data: { blockerId: bob.id, blockedUserId: alice.id },
    })

    await expect(likeUser(alice.id, bob.id)).rejects.toThrow('invalid_target')
  })

  it('rejects liking a user when the target has blocked the liker', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')

    await prisma.block.create({
      data: { blockerId: alice.id, blockedUserId: bob.id },
    })

    await expect(likeUser(alice.id, bob.id)).rejects.toThrow('invalid_target')
  })
})
