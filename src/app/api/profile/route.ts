import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { profileInputSchema, upsertProfile } from '@/lib/profile'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: (session.user as { id: string }).id },
  })

  return NextResponse.json(profile)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = profileInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }

  const profile = await upsertProfile((session.user as { id: string }).id, parsed.data)
  return NextResponse.json(profile, { status: 200 })
}
