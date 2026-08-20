import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMatchesForUser } from '@/lib/messages'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const matches = await listMatchesForUser((session.user as { id: string }).id)
  return NextResponse.json(matches)
}
