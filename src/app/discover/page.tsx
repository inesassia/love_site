'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppNav from '@/components/AppNav'

type DiscoveredProfile = {
  userId: string
  firstName: string
  city: string
  bio: string
  photos: string[]
}

const REPORT_CATEGORIES = [
  { value: 'faux_profil', label: 'Faux profil' },
  { value: 'comportement_inapproprie', label: 'Comportement inapproprié' },
  { value: 'contenu_offensant', label: 'Contenu offensant' },
  { value: 'autre', label: 'Autre' },
]

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<DiscoveredProfile[]>([])
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [denomination, setDenomination] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [matchMessage, setMatchMessage] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportCategory, setReportCategory] = useState(REPORT_CATEGORIES[0].value)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  // Number of photos on the member's *own* profile. `null` means we could not
  // read it, in which case the feed is shown rather than gated — this is a
  // profile-completion nudge, not a security boundary.
  const [ownPhotoCount, setOwnPhotoCount] = useState<number | null>(null)

  async function loadProfiles(event?: React.FormEvent) {
    event?.preventDefault()
    setError(null)

    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (country) params.set('country', country)
    if (denomination) params.set('denomination', denomination)

    const response = await fetch(`/api/discover?${params.toString()}`)

    if (!response.ok) {
      setError('Impossible de charger les profils. Réessayez plus tard.')
      return
    }

    const data = await response.json()
    setProfiles(data)
  }

  useEffect(() => {
    async function init() {
      try {
        const response = await fetch('/api/profile')
        if (response.ok) {
          const profile: { photos?: string[] } | null = await response.json()
          const photoCount = profile?.photos?.length ?? 0
          setOwnPhotoCount(photoCount)
          // The spec requires a completed profile with at least one photo
          // before any discovery access, so there is no feed to fetch yet.
          if (photoCount === 0) return
        }

        await loadProfiles()
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLike(userId: string) {
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: userId }),
      })

      if (!response.ok) {
        setError('Erreur lors du like.')
        return
      }

      const data = await response.json()
      setLikedIds((prev) => new Set(prev).add(userId))
      if (data.matched) {
        setMatchMessage("C'est un match !")
        setTimeout(() => setMatchMessage(null), 3000)
      }
    } catch (err) {
      setError('Erreur lors du like.')
    }
  }

  async function handleBlock(userId: string) {
    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: userId }),
      })

      if (!response.ok) {
        setError('Erreur lors du blocage.')
        return
      }

      setProfiles((prev) => prev.filter((profile) => profile.userId !== userId))
      if (reportingId === userId) {
        setReportingId(null)
      }
    } catch (err) {
      setError('Erreur lors du blocage.')
    }
  }

  function openReportForm(userId: string) {
    setReportingId(userId)
    setReportCategory(REPORT_CATEGORIES[0].value)
    setReportReason('')
  }

  async function handleReportSubmit(event: React.FormEvent, userId: string) {
    event.preventDefault()
    if (reportReason.trim() === '') return

    setReportSubmitting(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedUserId: userId, category: reportCategory, reason: reportReason }),
      })

      if (!response.ok) {
        setError('Erreur lors du signalement.')
        return
      }

      setReportingId(null)
      setReportReason('')
      setMatchMessage('Signalement envoyé. Merci pour votre vigilance.')
      setTimeout(() => setMatchMessage(null), 3000)
    } catch (err) {
      setError('Erreur lors du signalement.')
    } finally {
      setReportSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <AppNav active="discover" />
        <main className="app-main">
          <p className="empty-state">Chargement…</p>
        </main>
      </div>
    )
  }

  if (ownPhotoCount === 0) {
    return (
      <div>
        <AppNav active="discover" />
        <main className="app-main">
          <div className="discover-toolbar">
            <div>
              <h1>Découvrir</h1>
            </div>
          </div>
          <div className="empty-state">
            <p style={{ margin: '0 0 20px' }}>
              Ajoutez au moins une photo à votre profil pour commencer à découvrir des profils.
            </p>
            <Link
              href="/profile/edit"
              className="btn-primary"
              style={{ width: 'auto', padding: '13px 26px' }}
            >
              Compléter mon profil
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <AppNav active="discover" />
      <main className="app-main">
        <div className="discover-toolbar">
          <div>
            <h1>Découvrir</h1>
            <p className="hint">
              {profiles.length} profil{profiles.length === 1 ? '' : 's'} correspond
              {profiles.length === 1 ? '' : 'ent'} à vos préférences.
            </p>
          </div>
          <form onSubmit={loadProfiles} className="discover-filters">
            <div className="field">
              <label>
                Ville
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Pays
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Dénomination
                <select value={denomination} onChange={(e) => setDenomination(e.target.value)}>
                  <option value="">Toutes</option>
                  <option value="evangelique">Évangélique</option>
                  <option value="catholique">Catholique</option>
                  <option value="protestant">Protestant</option>
                  <option value="orthodoxe">Orthodoxe</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
            </div>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '12px 24px' }}>
              Filtrer
            </button>
          </form>
        </div>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {matchMessage && (
          <p className="status-banner" role="status">
            {matchMessage}
          </p>
        )}
        {profiles.length === 0 && !error && (
          <p className="empty-state">Aucun profil à découvrir pour le moment.</p>
        )}

        <ul className="discover-grid">
          {profiles.map((profile) => {
            const liked = likedIds.has(profile.userId)
            return (
              <li className="card" key={profile.userId}>
                <div className="card-photo">
                  {profile.photos.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photos[0]} alt={`Photo de ${profile.firstName}`} />
                  ) : (
                    <span className="card-photo-initial">{profile.firstName[0] ?? '?'}</span>
                  )}
                  <button
                    type="button"
                    className={`heart-btn ${liked ? 'liked' : ''}`}
                    onClick={() => handleLike(profile.userId)}
                    aria-label={`J'aime ${profile.firstName}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      style={{ width: 22, height: 22 }}
                      fill={liked ? 'var(--rose)' : 'none'}
                      stroke={liked ? 'var(--rose)' : 'var(--ink-soft)'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20.2s-6.6-4.1-8.9-8C1.7 9 2.6 5.9 5.3 5c1.9-.6 3.6.3 4.7 1.9C10.9 5.3 12.6 4.4 14.5 5c2.7.9 3.6 4 2.2 7.2-2.3 3.9-8.9 8-8.9 8z" />
                    </svg>
                  </button>
                </div>
                <div className="card-body">
                  <h2>{profile.firstName}</h2>
                  <p>{profile.city}</p>
                  <p>{profile.bio}</p>

                  <div className="card-safety">
                    <button type="button" className="safety-btn" onClick={() => openReportForm(profile.userId)}>
                      Signaler
                    </button>
                    <button
                      type="button"
                      className="safety-btn danger"
                      onClick={() => handleBlock(profile.userId)}
                    >
                      Bloquer
                    </button>
                  </div>

                  {reportingId === profile.userId && (
                    <form
                      className="report-form"
                      onSubmit={(event) => handleReportSubmit(event, profile.userId)}
                    >
                      <div className="field">
                        <label>
                          Motif
                          <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
                            {REPORT_CATEGORIES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="field">
                        <label>
                          Détails
                          <textarea
                            rows={3}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Décrivez la situation..."
                          />
                        </label>
                      </div>
                      <div className="report-form-actions">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={reportSubmitting || reportReason.trim() === ''}
                        >
                          Envoyer le signalement
                        </button>
                        <button
                          type="button"
                          className="report-form-cancel"
                          onClick={() => setReportingId(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
