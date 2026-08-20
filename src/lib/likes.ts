import { prisma } from '@/lib/db'
import { oppositeGender } from '@/lib/discovery'
import { assertActiveUser } from '@/lib/users'

export async function likeUser(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('cannot_like_self')
  }

  // A suspended member keeps a valid session, so the liker's own status has to
  // be re-checked here and not only the target's.
  await assertActiveUser(fromUserId)

  // Validate that target is a legitimate candidate
  const fromProfile = await prisma.profile.findUnique({ where: { userId: fromUserId } })
  if (!fromProfile) {
    throw new Error('invalid_target')
  }

  const toUser = await prisma.user.findUnique({ where: { id: toUserId }, include: { profile: true } })
  if (!toUser || !toUser.profile) {
    throw new Error('invalid_target')
  }

  // Check if target is suspended
  if (toUser.suspended) {
    throw new Error('invalid_target')
  }

  // Check opposite gender
  if (toUser.profile.gender !== oppositeGender(fromProfile.gender)) {
    throw new Error('invalid_target')
  }

  // Check for blocks in either direction
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: fromUserId, blockedUserId: toUserId },
        { blockerId: toUserId, blockedUserId: fromUserId },
      ],
    },
  })
  if (block) {
    throw new Error('invalid_target')
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
