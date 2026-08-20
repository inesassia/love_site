import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { suspendUser, updateReportStatus } from '@/lib/admin'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()

  if (body.action === 'traite' || body.action === 'ignore') {
    const report = await updateReportStatus(params.id, body.action)
    return NextResponse.json(report)
  }

  if (body.action === 'suspend') {
    const reportRecord = await updateReportStatus(params.id, 'traite')
    const fullReport = await prisma.report.findUnique({ where: { id: params.id } })
    if (fullReport) await suspendUser(fullReport.reportedUserId)
    return NextResponse.json(reportRecord)
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
