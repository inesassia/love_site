'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      setError("Impossible de créer le compte. Vérifiez l'email et le mot de passe.")
      return
    }

    router.push('/login')
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <BrandMark />
        <div className="auth-hero-quote">
          <h1>« L&apos;amour est patient, l&apos;amour est bon. »</h1>
          <p className="hint">1 Corinthiens 13:4</p>
          <p>
            Rejoignez une communauté de célibataires chrétiens engagés dans une recherche
            sincère de l&apos;amour et du mariage.
          </p>
        </div>
        <div />
      </div>
      <div className="auth-form-panel">
        <form onSubmit={handleSubmit}>
          <h2>Créer votre compte</h2>
          <p>Quelques instants suffisent pour commencer votre chemin.</p>
          <div className="field">
            <label>
              Adresse email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </label>
          </div>
          <div className="field">
            <label>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </label>
            <p className="hint">8 caractères minimum.</p>
          </div>
          {error && <p className="error-banner" role="alert">{error}</p>}
          <button type="submit" className="btn-primary">
            Créer mon compte
          </button>
          <p className="auth-switch">
            Déjà inscrit·e ? <Link href="/login">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
