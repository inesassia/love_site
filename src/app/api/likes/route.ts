import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { likeUser } from '@/lib/likes'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.toUserId !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await likeUser((session.user as { id: string }).id, body.toUserId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = (error as Error).message
    // A rejected target is a bad request; a rejected *requester* (suspended or
    // deleted account still holding a valid session) is a forbidden one.
    const status = message === 'suspended' || message === 'user_not_found' ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
