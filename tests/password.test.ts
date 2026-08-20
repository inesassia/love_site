import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('S3cret!Pass')
    expect(hash).not.toBe('S3cret!Pass')
    expect(await verifyPassword('S3cret!Pass', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('S3cret!Pass')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})
