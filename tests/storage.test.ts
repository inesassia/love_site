import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn().mockResolvedValue({})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

beforeEach(() => {
  sendMock.mockClear()
  process.env.S3_ENDPOINT = 'http://localhost:9000'
  process.env.S3_REGION = 'auto'
  process.env.S3_BUCKET = 'love-site-photos'
  process.env.S3_ACCESS_KEY_ID = 'key'
  process.env.S3_SECRET_ACCESS_KEY = 'secret'
  process.env.S3_PUBLIC_BASE_URL = 'http://localhost:9000/love-site-photos'
})

describe('uploadPhoto', () => {
  it('uploads the buffer and returns a public URL under the photos/ prefix', async () => {
    const { uploadPhoto } = await import('@/lib/storage')
    const url = await uploadPhoto(Buffer.from('fake-image-data'), 'image/png')

    expect(url).toMatch(/^http:\/\/localhost:9000\/love-site-photos\/photos\/.+/)
    expect(sendMock).toHaveBeenCalledOnce()
  })
})
