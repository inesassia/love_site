'use client'

import { useEffect, useState } from 'react'

type DiscoveredProfile = {
  userId: string
  firstName: string
  city: string
  bio: string
  photos: string[]
}

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<DiscoveredProfile[]>([])
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [denomination, setDenomination] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [matchMessage, setMatchMessage] = useState<string | null>(null)

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
    loadProfiles()
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
      if (data.matched) {
        setMatchMessage("C'est un match !")
        setTimeout(() => setMatchMessage(null), 3000)
      }
    } catch (err) {
      setError('Erreur lors du like.')
    }
  }

  return (
    <main>
      <h1>Découvrir</h1>
      <form onSubmit={loadProfiles}>
        <label>
          Ville
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          Pays
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
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
        <button type="submit">Filtrer</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {matchMessage && <p role="status">{matchMessage}</p>}
      {profiles.length === 0 && !error && <p>Aucun profil à découvrir pour le moment.</p>}
      <ul>
        {profiles.map((profile) => (
          <li key={profile.userId}>
            {profile.photos.length > 0 && (
              <img src={profile.photos[0]} alt={`Photo de ${profile.firstName}`} width={120} />
            )}
            <h2>{profile.firstName}</h2>
            <p>{profile.city}</p>
            <p>{profile.bio}</p>
            <button type="button" onClick={() => handleLike(profile.userId)}>
              J&apos;aime
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
