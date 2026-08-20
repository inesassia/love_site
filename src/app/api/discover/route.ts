import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Denomination } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { getDiscoverableProfiles } from '@/lib/discovery'

const VALID_DENOMINATIONS: Denomination[] = [
  'evangelique',
  'catholique',
  'protestant',
  'orthodoxe',
  'autre',
]

function parseDenomination(value: string | null): Denomination | undefined {
  return VALID_DENOMINATIONS.includes(value as Denomination) ? (value as Denomination) : undefined
}

function parseAge(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  try {
    const profiles = await getDiscoverableProfiles((session.user as { id: string }).id, {
      city: searchParams.get('city') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      denomination: parseDenomination(searchParams.get('denomination')),
      minAge: parseAge(searchParams.get('minAge')),
      maxAge: parseAge(searchParams.get('maxAge')),
    })

    return NextResponse.json(profiles)
  } catch (error) {
    // Suspended (or deleted) accounts keep a valid session until it expires,
    // so the feed itself has to turn them away.
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }
}
