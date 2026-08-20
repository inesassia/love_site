import { z } from 'zod'
import { prisma } from '@/lib/db'

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear()
  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

export const profileInputSchema = z.object({
  firstName: z.string().min(1),
  birthDate: z.coerce
    .date()
    .refine((date) => calculateAge(date) >= 18, { message: 'age_minimum_18' }),
  gender: z.enum(['homme', 'femme']),
  city: z.string().min(1),
  country: z.string().min(1),
  bio: z.string().min(1),
  denomination: z.enum(['evangelique', 'catholique', 'protestant', 'orthodoxe', 'autre']),
  churchAttendance: z.enum(['regulierement', 'occasionnellement', 'rarement']),
  marriageVision: z.string().min(1),
  favoriteVerseOrValue: z.string().min(1),
})

export type ProfileInput = z.infer<typeof profileInputSchema>

export async function upsertProfile(userId: string, input: ProfileInput, photos?: string[]) {
  // `gender` is immutable once a profile exists. The whole product rule
  // (heterosexual-only matching) is derived from it: Likes, Matches and the
  // conversations hanging off them are all validated against the genders that
  // were current when they were created. Letting a member flip their gender
  // afterwards would silently turn an existing match into a same-gender one.
  // It is therefore only ever written on the `create` branch.
  const { gender, ...mutableFields } = input

  return prisma.profile.upsert({
    where: { userId },
    create: { userId, gender, ...mutableFields, photos: photos ?? [] },
    update: { ...mutableFields, ...(photos ? { photos } : {}) },
  })
}
