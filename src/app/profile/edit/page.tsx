'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <form onSubmit={handleSubmit}>
      <h1>Mon profil</h1>
      <label>
        Prénom
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </label>
      <label>
        Date de naissance
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
      </label>
      <label>
        Genre
        <select value={gender} onChange={(e) => setGender(e.target.value)} required>
          <option value="homme">Homme</option>
          <option value="femme">Femme</option>
        </select>
      </label>
      <label>
        Ville
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
      </label>
      <label>
        Pays
        <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} required />
      </label>
      <label>
        Dénomination
        <select value={denomination} onChange={(e) => setDenomination(e.target.value)} required>
          <option value="evangelique">Évangélique</option>
          <option value="catholique">Catholique</option>
          <option value="protestant">Protestant</option>
          <option value="orthodoxe">Orthodoxe</option>
          <option value="autre">Autre</option>
        </select>
      </label>
      <label>
        Fréquentation de l&apos;église
        <select value={churchAttendance} onChange={(e) => setChurchAttendance(e.target.value)} required>
          <option value="regulierement">Régulièrement</option>
          <option value="occasionnellement">Occasionnellement</option>
          <option value="rarement">Rarement</option>
        </select>
      </label>
      <label>
        Vision du mariage
        <textarea
          value={marriageVision}
          onChange={(e) => setMarriageVision(e.target.value)}
          required
        />
      </label>
      <label>
        Verset ou valeur préférée
        <input
          type="text"
          value={favoriteVerseOrValue}
          onChange={(e) => setFavoriteVerseOrValue(e.target.value)}
          required
        />
      </label>
      <label>
        Photos
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
      </label>
      {uploadError && <p role="alert">{uploadError}</p>}
      {photos.length > 0 && (
        <ul>
          {photos.map((photoUrl) => (
            <li key={photoUrl}>
              <img src={photoUrl} alt="Photo de profil" width={120} />
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit">Enregistrer</button>
    </form>
  )
}
