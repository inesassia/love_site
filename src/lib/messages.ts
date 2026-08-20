import { prisma } from '@/lib/db'
import { oppositeGender } from '@/lib/discovery'

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
    prisma.user.findUnique({ where: { id: match.userAId }, include: { profile: true } }),
    prisma.user.findUnique({ where: { id: match.userBId }, include: { profile: true } }),
  ])
  if (!userA || !userB || userA.suspended || userB.suspended) {
    throw new Error('suspended')
  }

  // Defense in depth against a gender mismatch on an existing match.
  // `upsertProfile` now makes gender immutable, but rows created before that
  // fix — or any future mutation path — could still leave two same-gender
  // members sharing a live conversation, which the product rule forbids.
  if (
    !userA.profile ||
    !userB.profile ||
    userA.profile.gender !== oppositeGender(userB.profile.gender)
  ) {
    throw new Error('gender_mismatch')
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
    // A suspension on the other participant must mask the match here too —
    // otherwise a stale entry lingers in the list and only fails on open.
    where: {
      OR: [
        { userAId: userId, userB: { suspended: false } },
        { userBId: userId, userA: { suspended: false } },
      ],
    },
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
    if (blockedIds.has(otherId)) return false

    // Same rule as `assertCanExchangeMessages`: a match whose two participants
    // are no longer of opposite genders must be masked everywhere, not just
    // rejected once its conversation is opened.
    const genderA = match.userA.profile?.gender
    const genderB = match.userB.profile?.gender
    if (!genderA || !genderB || genderA !== oppositeGender(genderB)) return false

    return true
  })
}
