import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { blockUser, createReport } from '@/lib/safety'
import { getDiscoverableProfiles } from '@/lib/discovery'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUser(email: string, gender: 'homme' | 'femme' = 'homme') {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
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
  })
}

describe('createReport', () => {
  it('records a report with pending status', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    const report = await createReport(alice.id, bob.id, 'comportement_inapproprie', 'Message déplacé')

    expect(report.status).toBe('en_attente')
  })

  it('rejects self-reporting', async () => {
    const alice = await createUser('alice@example.com')
    await expect(createReport(alice.id, alice.id, 'autre', 'test')).rejects.toThrow('cannot_report_self')
  })
})

describe('blockUser', () => {
  it('is idempotent', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    await blockUser(alice.id, bob.id)
    await blockUser(alice.id, bob.id)

    expect(await prisma.block.count()).toBe(1)
  })

  it('removes the blocked user from discovery immediately', async () => {
    const alice = await createUser('alice@example.com')
    const bob = await createUser('bob@example.com', 'femme')

    expect(await getDiscoverableProfiles(alice.id)).toHaveLength(1)
    await blockUser(alice.id, bob.id)
    expect(await getDiscoverableProfiles(alice.id)).toHaveLength(0)
  })
})
