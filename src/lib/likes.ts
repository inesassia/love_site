import { prisma } from '@/lib/db'

export async function likeUser(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('cannot_like_self')
  }

  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId },
    update: {},
  })

  const reciprocal = await prisma.like.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
  })

  if (!reciprocal) {
    return { matched: false as const }
  }

  const [userAId, userBId] = [fromUserId, toUserId].sort()

  const match = await prisma.match.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
  })

  return { matched: true as const, match }
}
