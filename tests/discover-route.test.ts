import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/discover/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

async function createUserWithProfile(email: string, gender: 'homme' | 'femme') {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
      profile: {
        create: {
          firstName: email,
          birthDate: new Date('1995-01-01'),
          gender,
          city: 'Paris',
          country: 'France',
          bio: 'Bio',
          denomination: 'catholique',
          churchAttendance: 'regulierement',
          marriageVision: 'Famille unie',
          favoriteVerseOrValue: 'Philippiens 4:13',
        },
      },
    },
  })
}

function makeRequest(url: string) {
  return new Request(url) as never
}

describe('/api/discover', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await GET(makeRequest('http://localhost/api/discover'))

    expect(response.status).toBe(401)
  })

  it('ignores an invalid denomination filter instead of crashing', async () => {
    const me = await createUserWithProfile('me@example.com', 'homme')
    await createUserWithProfile('her@example.com', 'femme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: me.id } } as never)

    const response = await GET(makeRequest('http://localhost/api/discover?denomination=xyz'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
  })

  it('ignores non-numeric minAge/maxAge instead of crashing', async () => {
    const me = await createUserWithProfile('me2@example.com', 'homme')
    await createUserWithProfile('her2@example.com', 'femme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: me.id } } as never)

    const response = await GET(makeRequest('http://localhost/api/discover?minAge=abc&maxAge=xyz'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
  })
})
