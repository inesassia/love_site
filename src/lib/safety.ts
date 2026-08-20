import { prisma } from '@/lib/db'
import type { ReportCategory } from '@prisma/client'

export async function createReport(
  reporterId: string,
  reportedUserId: string,
  category: ReportCategory,
  reason: string
) {
  if (reporterId === reportedUserId) {
    throw new Error('cannot_report_self')
  }

  return prisma.report.create({ data: { reporterId, reportedUserId, category, reason } })
}

export async function blockUser(blockerId: string, blockedUserId: string) {
  if (blockerId === blockedUserId) {
    throw new Error('cannot_block_self')
  }

  return prisma.block.upsert({
    where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
    create: { blockerId, blockedUserId },
    update: {},
  })
}
