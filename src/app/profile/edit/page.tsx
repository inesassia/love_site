'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/AppNav'

export default function ProfileEditPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('homme')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [bio, setBio] = useState('')
  const [denomination, setDenomination] = useState('evangelique')
  const [churchAttendance, setChurchAttendance] = useState('regulierement')
  const [marriageVision, setMarriageVision] = useState('')
  const [favoriteVerseOrValue, setFavoriteVerseOrValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError(null)

    const formData = new FormData()
    formData.set('file', file)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      setUploadError('Impossible d\'envoyer la photo. Vérifiez le format et la taille du fichier.')
      return
    }

    const data = await response.json()
    setPhotos(data.photos)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        birthDate,
        gender,
        city,
        country,
        bio,
        denomination,
        churchAttendance,
        marriageVision,
        favoriteVerseOrValue,
      }),
    })

    if (!response.ok) {
      setError('Impossible d\'enregistrer le profil. Vérifiez les champs et réessayez.')
      return
    }

    router.push('/discover')
  }

  return (
    <div>
      <AppNav active="profile" />
      <div className="app-main">
        <div className="profile-grid">
          <div>
            <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-photo">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="" />
                ) : (
                  <span className="card-photo-initial">{firstName ? firstName[0] : '?'}</span>
                )}
              </div>
              <div style={{ padding: '22px 24px 26px' }}>
                <h3>{firstName || 'Votre prénom'}</h3>
                <p className="hint">{city || 'Votre ville'}</p>
                <p className="hint">{bio || 'Votre bio apparaîtra ici.'}</p>
              </div>
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
              Aperçu de votre profil public
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <h1 style={{ fontSize: 30, marginBottom: 6 }}>Modifier mon profil</h1>
            <p style={{ margin: '0 0 30px', color: 'var(--ink-soft)', fontSize: 14.5 }}>
              Ces informations aident les autres membres à mieux vous connaître.
            </p>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 22 }}>Informations personnelles</h2>
              <div className="field">
                <label>
                  Prénom
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="field">
                <label>
                  Date de naissance
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Genre</label>
                <div className="toggle" role="group" aria-label="Genre">
                  <button
                    type="button"
                    className={gender === 'homme' ? 'active' : ''}
                    onClick={() => setGender('homme')}
                  >
                    Homme
                  </button>
                  <button
                    type="button"
                    className={gender === 'femme' ? 'active' : ''}
                    onClick={() => setGender('femme')}
                  >
                    Femme
                  </button>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 22 }}>Localisation</h2>
              <div className="field-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>
                    Ville
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
                  </label>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>
                    Pays
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 22 }}>À propos de vous</h2>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>
                  Bio
                  <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} required />
                </label>
              </div>
            </div>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 22 }}>Votre foi</h2>
              <div className="field-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>
                    Dénomination
                    <select
                      value={denomination}
                      onChange={(e) => setDenomination(e.target.value)}
                      required
                    >
                      <option value="evangelique">Évangélique</option>
                      <option value="catholique">Catholique</option>
                      <option value="protestant">Protestant</option>
                      <option value="orthodoxe">Orthodoxe</option>
                      <option value="autre">Autre</option>
                    </select>
                  </label>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>
                    Fréquentation de l&apos;église
                    <select
                      value={churchAttendance}
                      onChange={(e) => setChurchAttendance(e.target.value)}
                      required
                    >
                      <option value="regulierement">Régulièrement</option>
                      <option value="occasionnellement">Occasionnellement</option>
                      <option value="rarement">Rarement</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 22 }}>Votre vision</h2>
              <div className="field">
                <label>
                  Vision du mariage
                  <textarea
                    rows={3}
                    value={marriageVision}
                    onChange={(e) => setMarriageVision(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>
                  Verset ou valeur préférée
                  <input
                    type="text"
                    value={favoriteVerseOrValue}
                    onChange={(e) => setFavoriteVerseOrValue(e.target.value)}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="section-card">
              <h2 style={{ fontSize: 17, marginBottom: 6 }}>Photos</h2>
              <p className="hint" style={{ marginBottom: 20 }}>
                Jusqu&apos;à 6 photos. La première sera votre photo principale.
              </p>
              {uploadError && (
                <p className="error-banner" role="alert">
                  {uploadError}
                </p>
              )}
              <div className="photo-grid">
                {photos.map((photoUrl) => (
                  <div className="photo-tile" key={photoUrl}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="Photo de profil" />
                  </div>
                ))}
                {photos.length < 6 && (
                  <label className="photo-tile" style={{ cursor: 'pointer' }}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      style={{ width: 22, height: 22 }}
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Ajouter une photo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Enregistrer mon profil
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
