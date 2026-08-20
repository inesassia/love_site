import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listReports } from '@/lib/admin'
import type { ReportStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const status = new URL(request.url).searchParams.get('status') as ReportStatus | null
  const reports = await listReports(status ?? undefined)
  return NextResponse.json(reports)
}
