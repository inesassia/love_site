import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { listMatchesForUser, listMessages, sendMessage } from '@/lib/messages'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function createUserWithProfile(email: string, gender: 'homme' | 'femme') {
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

async function createMatch() {
  const alice = await createUserWithProfile('alice@example.com', 'femme')
  const bob = await createUserWithProfile('bob@example.com', 'homme')
  const [userAId, userBId] = [alice.id, bob.id].sort()
  const match = await prisma.match.create({ data: { userAId, userBId } })
  return { alice, bob, match }
}

describe('sendMessage', () => {
  it('lets a participant send a message', async () => {
    const { alice, match } = await createMatch()
    const message = await sendMessage(match.id, alice.id, 'Bonjour !')
    expect(message.content).toBe('Bonjour !')
  })

  it('rejects a non-participant', async () => {
    const { match } = await createMatch()
    const stranger = await prisma.user.create({ data: { email: 'carol@example.com', passwordHash: 'x' } })
    await expect(sendMessage(match.id, stranger.id, 'Salut')).rejects.toThrow('not_a_participant')
  })

  it('rejects a message when the sender has since been suspended', async () => {
    const { alice, match } = await createMatch()
    await prisma.user.update({ where: { id: alice.id }, data: { suspended: true } })

    await expect(sendMessage(match.id, alice.id, 'Salut')).rejects.toThrow('suspended')
  })

  it('rejects a message when the other participant has since been suspended', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.user.update({ where: { id: bob.id }, data: { suspended: true } })

    await expect(sendMessage(match.id, alice.id, 'Salut')).rejects.toThrow('suspended')
  })

  it('rejects a message when the recipient has since blocked the sender', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.block.create({ data: { blockerId: bob.id, blockedUserId: alice.id } })

    await expect(sendMessage(match.id, alice.id, 'Salut')).rejects.toThrow('blocked')
  })

  it('rejects a message when the sender has since blocked the recipient', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.block.create({ data: { blockerId: alice.id, blockedUserId: bob.id } })

    await expect(sendMessage(match.id, alice.id, 'Salut')).rejects.toThrow('blocked')
  })

  // `upsertProfile` now refuses to change an existing profile's gender, but a row
  // written before that fix (or a future mutation path) could still leave a live
  // match between two members of the same gender.
  it('rejects a message once the two participants are no longer opposite genders', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.profile.update({ where: { userId: bob.id }, data: { gender: 'femme' } })

    await expect(sendMessage(match.id, alice.id, 'Salut')).rejects.toThrow('gender_mismatch')
  })
})

describe('listMessages', () => {
  it('returns messages in chronological order', async () => {
    const { alice, bob, match } = await createMatch()
    await sendMessage(match.id, alice.id, 'Premier')
    await sendMessage(match.id, bob.id, 'Deuxième')

    const messages = await listMessages(match.id, alice.id)

    expect(messages.map((m) => m.content)).toEqual(['Premier', 'Deuxième'])
  })

  it('rejects a non-participant', async () => {
    const { match } = await createMatch()
    const stranger = await prisma.user.create({ data: { email: 'carol@example.com', passwordHash: 'x' } })

    await expect(listMessages(match.id, stranger.id)).rejects.toThrow('not_a_participant')
  })

  it('rejects reading a conversation once either participant has been suspended', async () => {
    const { alice, bob, match } = await createMatch()
    await sendMessage(match.id, alice.id, 'Avant la suspension')
    await prisma.user.update({ where: { id: bob.id }, data: { suspended: true } })

    await expect(listMessages(match.id, alice.id)).rejects.toThrow('suspended')
  })

  it('rejects reading a conversation once a block exists between the participants', async () => {
    const { alice, bob, match } = await createMatch()
    await sendMessage(match.id, alice.id, 'Avant le blocage')
    await prisma.block.create({ data: { blockerId: bob.id, blockedUserId: alice.id } })

    await expect(listMessages(match.id, alice.id)).rejects.toThrow('blocked')
  })

  it('rejects reading a conversation once the participants are no longer opposite genders', async () => {
    const { alice, bob, match } = await createMatch()
    await sendMessage(match.id, alice.id, 'Avant le changement de genre')
    await prisma.profile.update({ where: { userId: bob.id }, data: { gender: 'femme' } })

    await expect(listMessages(match.id, alice.id)).rejects.toThrow('gender_mismatch')
    await expect(listMessages(match.id, bob.id)).rejects.toThrow('gender_mismatch')
  })
})

describe('listMatchesForUser', () => {
  it('returns only matches involving the given user', async () => {
    const { alice, match } = await createMatch()
    const other = await prisma.user.create({ data: { email: 'dave@example.com', passwordHash: 'x' } })

    const matches = await listMatchesForUser(alice.id)

    expect(matches.map((m) => m.id)).toEqual([match.id])
    expect(matches.map((m) => m.id)).not.toContain(other.id)
  })

  it('does not leak the participants\' password hashes or emails', async () => {
    const { alice } = await createMatch()

    const matches = await listMatchesForUser(alice.id)

    expect(matches).toHaveLength(1)
    expect(matches[0].userA).not.toHaveProperty('passwordHash')
    expect(matches[0].userA).not.toHaveProperty('email')
    expect(matches[0].userB).not.toHaveProperty('passwordHash')
    expect(matches[0].userB).not.toHaveProperty('email')
  })

  it('excludes a match once either side has blocked the other', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.block.create({ data: { blockerId: bob.id, blockedUserId: alice.id } })

    const aliceMatches = await listMatchesForUser(alice.id)
    const bobMatches = await listMatchesForUser(bob.id)

    expect(aliceMatches.map((m) => m.id)).not.toContain(match.id)
    expect(bobMatches.map((m) => m.id)).not.toContain(match.id)
  })

  it('excludes a match once the other participant has been suspended', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.user.update({ where: { id: bob.id }, data: { suspended: true } })

    const aliceMatches = await listMatchesForUser(alice.id)

    expect(aliceMatches.map((m) => m.id)).not.toContain(match.id)
  })

  it('excludes a match whose participants are no longer opposite genders', async () => {
    const { alice, bob, match } = await createMatch()
    await prisma.profile.update({ where: { userId: bob.id }, data: { gender: 'femme' } })

    const aliceMatches = await listMatchesForUser(alice.id)
    const bobMatches = await listMatchesForUser(bob.id)

    expect(aliceMatches.map((m) => m.id)).not.toContain(match.id)
    expect(bobMatches.map((m) => m.id)).not.toContain(match.id)
  })
})
