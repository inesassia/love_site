import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createReport } from '@/lib/safety'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  if (typeof body?.reportedUserId !== 'string' || typeof body?.category !== 'string' || typeof body?.reason !== 'string') {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const report = await createReport(
      (session.user as { id: string }).id,
      body.reportedUserId,
      body.category,
      body.reason
    )
    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
