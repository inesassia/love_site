import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMessages, sendMessage } from '@/lib/messages'

export async function GET(_request: NextRequest, { params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const messages = await listMessages(params.matchId, (session.user as { id: string }).id)
    return NextResponse.json(messages)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { matchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.content !== 'string' || body.content.trim() === '') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const message = await sendMessage(params.matchId, (session.user as { id: string }).id, body.content)
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }
}
