import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getDiscoverableProfiles } from '@/lib/discovery'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(overrides: {
  email: string
  gender: 'homme' | 'femme'
  city?: string
  suspended?: boolean
}) {
  return prisma.user.create({
    data: {
      email: overrides.email,
      passwordHash: 'x',
      suspended: overrides.suspended ?? false,
      profile: {
        create: {
          firstName: overrides.email,
          birthDate: new Date('1995-01-01'),
          gender: overrides.gender,
          city: overrides.city ?? 'Paris',
          country: 'France',
          bio: 'Bio',
          denomination: 'catholique',
          churchAttendance: 'regulierement',
          marriageVision: 'Famille unie',
          favoriteVerseOrValue: 'Philippiens 4:13',
        },
      },
    },
  })
}

describe('getDiscoverableProfiles', () => {
  it('only returns profiles of the opposite gender', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const her = await createUser({ email: 'her@example.com', gender: 'femme' })
    await createUser({ email: 'him@example.com', gender: 'homme' })

    const results = await getDiscoverableProfiles(me.id)

    expect(results.map((p) => p.userId)).toEqual([her.id])
  })

  it('only projects the fields the discover page needs, not sensitive profile data', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    await createUser({ email: 'her@example.com', gender: 'femme' })

    const results = await getDiscoverableProfiles(me.id)

    expect(results).toHaveLength(1)
    expect(Object.keys(results[0]).sort()).toEqual(['bio', 'city', 'firstName', 'photos', 'userId'].sort())
  })

  it('excludes suspended users', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    await createUser({ email: 'suspended@example.com', gender: 'femme', suspended: true })

    const results = await getDiscoverableProfiles(me.id)

    expect(results).toHaveLength(0)
  })

  it('filters by city when provided', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const parisienne = await createUser({ email: 'a@example.com', gender: 'femme', city: 'Paris' })
    await createUser({ email: 'b@example.com', gender: 'femme', city: 'Lyon' })

    const results = await getDiscoverableProfiles(me.id, { city: 'Paris' })

    expect(results.map((p) => p.userId)).toEqual([parisienne.id])
  })

  it('refuses to build a feed for a suspended requester', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme', suspended: true })
    await createUser({ email: 'her@example.com', gender: 'femme' })

    await expect(getDiscoverableProfiles(me.id)).rejects.toThrow('suspended')
  })

  it('refuses to build a feed for a user that no longer exists', async () => {
    await expect(getDiscoverableProfiles('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      'user_not_found'
    )
  })

  it('excludes users that have blocked or been blocked by the requester', async () => {
    const me = await createUser({ email: 'me@example.com', gender: 'homme' })
    const blocked = await createUser({ email: 'blocked@example.com', gender: 'femme' })
    await prisma.block.create({ data: { blockerId: me.id, blockedUserId: blocked.id } })

    const results = await getDiscoverableProfiles(me.id)

    expect(results).toHaveLength(0)
  })
})
