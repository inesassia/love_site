import { prisma } from '@/lib/db'
import type { ReportStatus } from '@prisma/client'

export async function listReports(status?: ReportStatus) {
  return prisma.report.findMany({
    where: status ? { status } : undefined,
    // Scoped `select` (not `include`) so sensitive User fields such as
    // passwordHash never leave the database layer for the admin UI.
    select: {
      id: true,
      category: true,
      reason: true,
      status: true,
      createdAt: true,
      reporter: { select: { id: true, email: true } },
      reportedUser: {
        select: { id: true, profile: { select: { firstName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  return prisma.report.update({ where: { id: reportId }, data: { status } })
}

export async function suspendUser(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { suspended: true } })
}
