import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { listReports, suspendUser, updateReportStatus } from '@/lib/admin'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

async function seedReport() {
  const suffix = Math.random().toString(36).slice(2)
  const reporter = await prisma.user.create({ data: { email: `reporter-${suffix}@example.com`, passwordHash: 'x' } })
  const reported = await prisma.user.create({ data: { email: `reported-${suffix}@example.com`, passwordHash: 'x' } })
  const report = await prisma.report.create({
    data: {
      reporterId: reporter.id,
      reportedUserId: reported.id,
      category: 'comportement_inapproprie',
      reason: 'Message déplacé',
    },
  })
  return { reporter, reported, report }
}

describe('listReports', () => {
  it('filters by status when provided', async () => {
    const { report } = await seedReport()
    await updateReportStatus(report.id, 'traite')
    await seedReport()

    const pending = await listReports('en_attente')
    const treated = await listReports('traite')

    expect(pending).toHaveLength(1)
    expect(treated).toHaveLength(1)
  })
})

describe('suspendUser', () => {
  it('sets the suspended flag', async () => {
    const { reported } = await seedReport()

    await suspendUser(reported.id)

    const user = await prisma.user.findUnique({ where: { id: reported.id } })
    expect(user?.suspended).toBe(true)
  })
})
