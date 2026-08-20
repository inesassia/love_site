import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/profile/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/profile', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

describe('/api/profile', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('creates a profile for the authenticated user', async () => {
    const user = await prisma.user.create({
      data: { email: 'alice@example.com', passwordHash: 'hashed' },
    })
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const response = await POST(
      makeRequest({
        firstName: 'Alice',
        birthDate: '2000-01-01',
        gender: 'femme',
        city: 'Paris',
        country: 'France',
        bio: 'Bio',
        denomination: 'catholique',
        churchAttendance: 'regulierement',
        marriageVision: 'Fonder une famille unie dans la foi',
        favoriteVerseOrValue: 'Philippiens 4:13',
      })
    )

    expect(response.status).toBe(200)
    const saved = await prisma.profile.findUnique({ where: { userId: user.id } })
    expect(saved?.firstName).toBe('Alice')
  })
})
