import { describe, expect, it } from 'vitest'
import { loadEnv } from '@/lib/env'

const validEnv = {
  // NODE_ENV is required by Next.js's augmentation of NodeJS.ProcessEnv, so the
  // fixture has to carry it to actually satisfy the type `loadEnv` accepts.
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/love_site',
  NEXTAUTH_SECRET: 'test-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'auto',
  S3_BUCKET: 'love-site-photos',
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/love-site-photos',
} satisfies NodeJS.ProcessEnv

describe('loadEnv', () => {
  it('accepts a complete valid environment', () => {
    expect(() => loadEnv(validEnv)).not.toThrow()
  })

  it('throws when a required variable is missing', () => {
    const { DATABASE_URL, ...incomplete } = validEnv
    expect(() => loadEnv(incomplete as NodeJS.ProcessEnv)).toThrow()
  })
})
