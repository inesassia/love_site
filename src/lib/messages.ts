import { prisma } from '@/lib/db'

async function assertParticipant(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) throw new Error('match_not_found')
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new Error('not_a_participant')
  }
  return match
}

// Being a participant of a Match at some point in the past is not enough to
// keep exchanging messages: either side may have been suspended, or a block
// may have been created between them, after the match was formed. Mirrors
// the domain checks `likeUser` enforces on the write path (Task 8).
async function assertCanExchangeMessages(match: { userAId: string; userBId: string }) {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { id: match.userAId } }),
    prisma.user.findUnique({ where: { id: match.userBId } }),
  ])
  if (!userA || !userB || userA.suspended || userB.suspended) {
    throw new Error('suspended')
  }

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: match.userAId, blockedUserId: match.userBId },
        { blockerId: match.userBId, blockedUserId: match.userAId },
      ],
    },
  })
  if (block) {
    throw new Error('blocked')
  }
}

export async function sendMessage(matchId: string, senderId: string, content: string) {
  const match = await assertParticipant(matchId, senderId)
  await assertCanExchangeMessages(match)
  return prisma.message.create({ data: { matchId, senderId, content } })
}

export async function listMessages(matchId: string, requesterId: string) {
  const match = await assertParticipant(matchId, requesterId)
  await assertCanExchangeMessages(match)
  return prisma.message.findMany({ where: { matchId }, orderBy: { sentAt: 'asc' } })
}

export async function listMatchesForUser(userId: string) {
  const matches = await prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      // Select only what the UI needs — a bare `include: { profile: true }`
      // on the User relation would also serialize passwordHash, email, role,
      // etc. to the client.
      userA: { select: { id: true, profile: true } },
      userB: { select: { id: true, profile: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // A block (either direction) must mask the match everywhere in the app,
  // including this list — not just once its conversation is opened.
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
  })
  const blockedIds = new Set(
    blocks.map((b) => (b.blockerId === userId ? b.blockedUserId : b.blockerId))
  )

  return matches.filter((match) => {
    const otherId = match.userAId === userId ? match.userBId : match.userAId
    return !blockedIds.has(otherId)
  })
}
