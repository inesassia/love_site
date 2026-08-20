'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppNav from '@/components/AppNav'

type MatchProfile = {
  firstName: string
  photos: string[]
}

type MatchUser = {
  id: string
  profile: MatchProfile | null
}

type MatchItem = {
  id: string
  userAId: string
  userBId: string
  userA: MatchUser
  userB: MatchUser
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [sessionResponse, matchesResponse] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/matches'),
        ])

        if (!matchesResponse.ok) {
          setError('Impossible de charger vos matchs. Réessayez plus tard.')
          return
        }

        const session = await sessionResponse.json()
        const matchesData = await matchesResponse.json()
        setCurrentUserId(session?.user?.id ?? null)
        setMatches(matchesData)
      } catch {
        setError('Impossible de charger vos matchs. Réessayez plus tard.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function otherParticipant(match: MatchItem) {
    return match.userAId === currentUserId ? match.userB : match.userA
  }

  return (
    <div>
      <AppNav active="matches" />
      <main className="app-main">
        <div className="discover-toolbar">
          <div>
            <h1>Vos matchs</h1>
            <p className="hint">
              {matches.length} match{matches.length === 1 ? '' : 's'} pour l&apos;instant.
            </p>
          </div>
        </div>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && matches.length === 0 && (
          <p className="empty-state">
            Vous n&apos;avez pas encore de match. Continuez à découvrir des profils !
          </p>
        )}

        <ul className="discover-grid">
          {matches.map((match) => {
            const other = otherParticipant(match)
            const firstName = other.profile?.firstName ?? 'Utilisateur'
            const photo = other.profile?.photos?.[0]

            return (
              <li className="card" key={match.id}>
                <Link href={`/matches/${match.id}`} className="card-link">
                  <div className="card-photo">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={`Photo de ${firstName}`} />
                    ) : (
                      <span className="card-photo-initial">{firstName[0] ?? '?'}</span>
                    )}
                  </div>
                  <div className="card-body">
                    <h2>{firstName}</h2>
                    <p>Ouvrir la conversation</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
