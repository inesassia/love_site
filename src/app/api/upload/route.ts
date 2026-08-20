import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadPhoto } from '@/lib/storage'
import { prisma } from '@/lib/db'

const MAX_PHOTOS = 6
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  if (profile.photos.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: 'max_photos_reached' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadPhoto(buffer, file.type)

  const updated = await prisma.profile.update({
    where: { userId },
    data: { photos: { push: url } },
  })

  return NextResponse.json({ photos: updated.photos }, { status: 201 })
}
