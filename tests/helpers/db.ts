import { prisma } from '@/lib/db'

export async function resetDb() {
  await prisma.message.deleteMany()
  await prisma.match.deleteMany()
  await prisma.like.deleteMany()
  await prisma.report.deleteMany()
  await prisma.block.deleteMany()
  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
}
