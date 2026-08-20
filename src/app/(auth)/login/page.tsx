'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const result = await signIn('credentials', { email, password, redirect: false })

    if (result?.error) {
      setError('Email ou mot de passe incorrect.')
      return
    }

    router.push('/discover')
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <BrandMark />
        <div className="auth-hero-quote">
          <h1>« Que vos pas soient guidés par la foi et l&apos;espérance. »</h1>
          <p>Retrouvez vos échanges, votre profil et les personnes qui vous ont plu.</p>
        </div>
        <div />
      </div>
      <div className="auth-form-panel">
        <form onSubmit={handleSubmit}>
          <h2>Bon retour parmi nous</h2>
          <p>Connectez-vous pour continuer votre chemin.</p>
          {error && <p className="error-banner" role="alert">{error}</p>}
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
                required
              />
            </label>
          </div>
          <button type="submit" className="btn-primary">
            Se connecter
          </button>
          <p className="auth-switch">
            Pas encore de compte ? <Link href="/register">En créer un</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
