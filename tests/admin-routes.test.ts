import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/admin/reports/route'
import { PATCH } from '@/app/api/admin/reports/[id]/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

afterEach(async () => {
  vi.clearAllMocks()
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

function makeGetRequest(url: string) {
  return new Request(url) as never
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/reports/id', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as never
}

describe('GET /api/admin/reports', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET(makeGetRequest('http://localhost/api/admin/reports'))

    expect(response.status).toBe(403)
  })

  it('rejects a non-admin user even with a valid session', async () => {
    const user = await prisma.user.create({ data: { email: 'user@example.com', passwordHash: 'x', role: 'user' } })
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, role: 'user' } } as never)

    const response = await GET(makeGetRequest('http://localhost/api/admin/reports'))

    expect(response.status).toBe(403)
  })

  it('allows an admin and never leaks passwordHash', async () => {
    const admin = await prisma.user.create({ data: { email: 'admin@example.com', passwordHash: 'x', role: 'admin' } })
    await seedReport()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: admin.id, role: 'admin' } } as never)

    const response = await GET(makeGetRequest('http://localhost/api/admin/reports'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })
})

describe('PATCH /api/admin/reports/[id]', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { report } = await seedReport()

    const response = await PATCH(makePatchRequest({ action: 'ignore' }), { params: { id: report.id } })

    expect(response.status).toBe(403)
  })

  it('rejects a non-admin user even with a valid session', async () => {
    const user = await prisma.user.create({ data: { email: 'user2@example.com', passwordHash: 'x', role: 'user' } })
    const { report } = await seedReport()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, role: 'user' } } as never)

    const response = await PATCH(makePatchRequest({ action: 'ignore' }), { params: { id: report.id } })

    expect(response.status).toBe(403)
  })

  it('lets an admin suspend the reported user', async () => {
    const admin = await prisma.user.create({ data: { email: 'admin2@example.com', passwordHash: 'x', role: 'admin' } })
    const { report, reported } = await seedReport()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: admin.id, role: 'admin' } } as never)

    const response = await PATCH(makePatchRequest({ action: 'suspend' }), { params: { id: report.id } })

    expect(response.status).toBe(200)
    const suspendedUser = await prisma.user.findUnique({ where: { id: reported.id } })
    expect(suspendedUser?.suspended).toBe(true)
    const updatedReport = await prisma.report.findUnique({ where: { id: report.id } })
    expect(updatedReport?.status).toBe('traite')
  })
})
