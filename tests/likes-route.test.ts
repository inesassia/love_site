import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/likes/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/likes', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

async function createUserWithProfile(email: string, gender: 'homme' | 'femme', suspended = false) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'x',
      suspended,
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

describe('POST /api/likes', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const response = await POST(makeRequest({ toUserId: 'someone' }))
    expect(response.status).toBe(401)
  })

  it('rejects a request with no toUserId', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: alice.id } } as never)

    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
  })

  it('returns matched: false for a one-way like', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const bob = await createUserWithProfile('bob@example.com', 'homme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: alice.id } } as never)

    const response = await POST(makeRequest({ toUserId: bob.id }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.matched).toBe(false)
  })

  it('rejects a like from a suspended user with a 403 and does not create a Like row', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme', true)
    const bob = await createUserWithProfile('bob@example.com', 'homme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: alice.id } } as never)

    const response = await POST(makeRequest({ toUserId: bob.id }))

    expect(response.status).toBe(403)
    expect(await prisma.like.count()).toBe(0)
  })

  it('rejects liking a same-gender user with a 400 and does not create a Like row', async () => {
    const alice = await createUserWithProfile('alice@example.com', 'femme')
    const charlie = await createUserWithProfile('charlie@example.com', 'femme')
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: alice.id } } as never)

    const response = await POST(makeRequest({ toUserId: charlie.id }))

    expect(response.status).toBe(400)
    expect(await prisma.like.count()).toBe(0)
  })
})
