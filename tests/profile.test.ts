import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { calculateAge, profileInputSchema, upsertProfile } from '@/lib/profile'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

describe('calculateAge', () => {
  it('computes age correctly before the birthday this year', () => {
    expect(calculateAge(new Date('2000-06-15'), new Date('2026-06-01'))).toBe(25)
  })

  it('computes age correctly on or after the birthday this year', () => {
    expect(calculateAge(new Date('2000-06-15'), new Date('2026-06-20'))).toBe(26)
  })
})

const validInput = {
  firstName: 'Alice',
  birthDate: '2000-01-01',
  gender: 'femme',
  city: 'Paris',
  country: 'France',
  bio: 'Bio',
  denomination: 'catholique',
  churchAttendance: 'regulierement',
  marriageVision: 'Fonder une famille unie dans la foi',
  favoriteVerseOrValue: 'Philippiens 4:13',
}

describe('profileInputSchema', () => {
  it('accepts a valid profile', () => {
    expect(profileInputSchema.safeParse(validInput).success).toBe(true)
  })

  it('rejects someone under 18', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(profileInputSchema.safeParse({ ...validInput, birthDate: today }).success).toBe(false)
  })

  it('rejects a gender value outside homme/femme', () => {
    expect(profileInputSchema.safeParse({ ...validInput, gender: 'autre' }).success).toBe(false)
  })
})

describe('upsertProfile', () => {
  it('creates a profile for a user', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    const parsed = profileInputSchema.parse(validInput)

    const profile = await upsertProfile(user.id, parsed)

    expect(profile.firstName).toBe('Alice')
    expect(profile.photos).toEqual([])
  })

  it('updates the mutable fields of an existing profile', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    await upsertProfile(user.id, profileInputSchema.parse(validInput))

    const updated = await upsertProfile(
      user.id,
      profileInputSchema.parse({ ...validInput, city: 'Lyon', bio: 'Nouvelle bio' })
    )

    expect(updated.city).toBe('Lyon')
    expect(updated.bio).toBe('Nouvelle bio')
  })

  it('never changes the gender of an existing profile', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    const created = await upsertProfile(user.id, profileInputSchema.parse(validInput))
    expect(created.gender).toBe('femme')

    const updated = await upsertProfile(
      user.id,
      profileInputSchema.parse({ ...validInput, gender: 'homme', city: 'Lyon' })
    )

    expect(updated.gender).toBe('femme')
    expect(updated.city).toBe('Lyon')

    const persisted = await prisma.profile.findUnique({ where: { userId: user.id } })
    expect(persisted?.gender).toBe('femme')
  })
})
