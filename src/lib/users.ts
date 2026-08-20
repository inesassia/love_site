import { prisma } from '@/lib/db'

// Suspension does not revoke the JWT session that was issued before it, so
// every entry point a suspended member could still reach has to re-check the
// *requester's* own status — not just the status of whoever they are acting
// on. Kept in one place so discovery, likes and messaging cannot drift apart.
export async function assertActiveUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspended: true },
  })
  if (!user) {
    throw new Error('user_not_found')
  }
  if (user.suspended) {
    throw new Error('suspended')
  }
}
