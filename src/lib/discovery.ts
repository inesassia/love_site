import { prisma } from '@/lib/db'
import type { Denomination, Gender } from '@prisma/client'

export type DiscoveryFilters = {
  minAge?: number
  maxAge?: number
  city?: string
  country?: string
  denomination?: Denomination
}

function oppositeGender(gender: Gender): Gender {
  return gender === 'homme' ? 'femme' : 'homme'
}

export async function getDiscoverableProfiles(userId: string, filters: DiscoveryFilters = {}) {
  const me = await prisma.profile.findUnique({ where: { userId } })
  if (!me) return []

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
  })
  const blockedIds = blocks.map((b) => (b.blockerId === userId ? b.blockedUserId : b.blockerId))

  const now = new Date()
  const birthDateFilter: { lte?: Date; gte?: Date } = {}
  if (filters.minAge !== undefined) {
    birthDateFilter.lte = new Date(now.getFullYear() - filters.minAge, now.getMonth(), now.getDate())
  }
  if (filters.maxAge !== undefined) {
    birthDateFilter.gte = new Date(now.getFullYear() - filters.maxAge - 1, now.getMonth(), now.getDate())
  }

  return prisma.profile.findMany({
    where: {
      userId: { notIn: [userId, ...blockedIds] },
      gender: oppositeGender(me.gender),
      user: { suspended: false },
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.denomination ? { denomination: filters.denomination } : {}),
      ...(Object.keys(birthDateFilter).length ? { birthDate: birthDateFilter } : {}),
    },
    select: {
      userId: true,
      firstName: true,
      city: true,
      bio: true,
      photos: true,
    },
  })
}
