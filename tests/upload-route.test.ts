import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/storage', () => ({ uploadPhoto: vi.fn().mockResolvedValue('http://example.com/photos/1') }))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/upload/route'

afterEach(async () => {
  vi.clearAllMocks()
  await resetDb()
})

async function seedUserWithProfile() {
  const user = await prisma.user.create({ data: { email: 'alice@example.com', passwordHash: 'x' } })
  await prisma.profile.create({
    data: {
      userId: user.id,
      firstName: 'Alice',
      birthDate: new Date('2000-01-01'),
      gender: 'femme',
      city: 'Paris',
      country: 'France',
      bio: 'Bio',
      denomination: 'catholique',
      churchAttendance: 'regulierement',
      marriageVision: 'Famille unie',
      favoriteVerseOrValue: 'Philippiens 4:13',
    },
  })
  return user
}

function makeUploadRequest(file: File) {
  const formData = new FormData()
  formData.set('file', file)
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData }) as never
}

describe('POST /api/upload', () => {
  it('rejects unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const file = new File([Buffer.from('data')], 'photo.png', { type: 'image/png' })
    const response = await POST(makeUploadRequest(file))
    expect(response.status).toBe(401)
  })

  it('adds the uploaded photo URL to the profile', async () => {
    const user = await seedUserWithProfile()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const file = new File([Buffer.from('data')], 'photo.png', { type: 'image/png' })
    const response = await POST(makeUploadRequest(file))

    expect(response.status).toBe(201)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
    expect(profile?.photos).toEqual(['http://example.com/photos/1'])
  })

  it('rejects a disallowed file type', async () => {
    const user = await seedUserWithProfile()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never)

    const file = new File([Buffer.from('data')], 'doc.pdf', { type: 'application/pdf' })
    const response = await POST(makeUploadRequest(file))

    expect(response.status).toBe(400)
  })
})
