import { afterEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/register/route'
import { prisma } from '@/lib/db'
import { resetDb } from './helpers/db'

afterEach(async () => {
  await resetDb()
})

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never // NextRequest is a superset consumed the same way here
}

describe('POST /api/register', () => {
  it('creates a user with a hashed password', async () => {
    const response = await POST(makeRequest({ email: 'alice@example.com', password: 'S3cret!Pass' }))
    expect(response.status).toBe(201)

    const user = await prisma.user.findUnique({ where: { email: 'alice@example.com' } })
    expect(user).not.toBeNull()
    expect(user?.passwordHash).not.toBe('S3cret!Pass')
  })

  it('rejects an invalid email', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email', password: 'S3cret!Pass' }))
    expect(response.status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    await POST(makeRequest({ email: 'alice@example.com', password: 'S3cret!Pass' }))
    const response = await POST(makeRequest({ email: 'alice@example.com', password: 'AnotherPass1' }))
    expect(response.status).toBe(409)
  })

  it('handles concurrent registration attempts with same email', async () => {
    const [response1, response2] = await Promise.all([
      POST(makeRequest({ email: 'bob@example.com', password: 'S3cret!Pass1' })),
      POST(makeRequest({ email: 'bob@example.com', password: 'S3cret!Pass2' })),
    ])

    const statuses = [response1.status, response2.status]
    expect(statuses.sort()).toEqual([201, 409])

    const user = await prisma.user.findUnique({ where: { email: 'bob@example.com' } })
    expect(user).not.toBeNull()
  })
})
