import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDiscoverableProfiles } from '@/lib/discovery'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const profiles = await getDiscoverableProfiles((session.user as { id: string }).id, {
    city: searchParams.get('city') ?? undefined,
    country: searchParams.get('country') ?? undefined,
    denomination: (searchParams.get('denomination') as never) ?? undefined,
    minAge: searchParams.get('minAge') ? Number(searchParams.get('minAge')) : undefined,
    maxAge: searchParams.get('maxAge') ? Number(searchParams.get('maxAge')) : undefined,
  })

  return NextResponse.json(profiles)
}
