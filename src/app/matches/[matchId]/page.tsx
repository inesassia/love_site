'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppNav from '@/components/AppNav'

const POLL_INTERVAL_MS = 4000

type Message = {
  id: string
  matchId: string
  senderId: string
  content: string
  sentAt: string
}

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

export default function ConversationPage() {
  const params = useParams<{ matchId: string }>()
  const matchId = params.matchId

  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<MatchUser | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadMessages() {
    const response = await fetch(`/api/matches/${matchId}/messages`)
    if (!response.ok) {
      setError('Impossible de charger la conversation.')
      return
    }
    setError(null)
    setMessages(await response.json())
  }

  useEffect(() => {
    async function loadHeader() {
      const [sessionResponse, matchesResponse] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/matches'),
      ])
      if (!sessionResponse.ok || !matchesResponse.ok) return

      const session = await sessionResponse.json()
      const matches: MatchItem[] = await matchesResponse.json()
      const myId = session?.user?.id ?? null
      setCurrentUserId(myId)

      const match = matches.find((m) => m.id === matchId)
      if (match) {
        setOtherUser(match.userAId === myId ? match.userB : match.userA)
      }
    }

    loadHeader()
    loadMessages()

    const interval = setInterval(loadMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    if (content.trim() === '') return

    setSending(true)
    try {
      const response = await fetch(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        setError("Impossible d'envoyer le message.")
        return
      }

      setContent('')
      await loadMessages()
    } finally {
      setSending(false)
    }
  }

  const otherFirstName = otherUser?.profile?.firstName ?? 'Conversation'
  const otherPhoto = otherUser?.profile?.photos?.[0]

  return (
    <div>
      <AppNav active="matches" />
      <main className="app-main">
        <Link href="/matches" className="conversation-back">
          ← Retour aux matchs
        </Link>

        <div className="card conversation-card">
          <div className="conversation-header">
            <div className="conversation-header-photo">
              {otherPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={otherPhoto} alt={`Photo de ${otherFirstName}`} />
              ) : (
                <span>{otherFirstName[0] ?? '?'}</span>
              )}
            </div>
            <h1>{otherFirstName}</h1>
          </div>

          {error && (
            <p className="error-banner" role="alert" style={{ margin: '0 26px', marginTop: 18 }}>
              {error}
            </p>
          )}

          <div className="conversation-thread">
            {messages.length === 0 && !error && (
              <p className="empty-state">Aucun message pour l&apos;instant. Dites bonjour !</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-bubble ${message.senderId === currentUserId ? 'mine' : 'theirs'}`}
              >
                <p>{message.content}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="conversation-composer">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écrivez un message..."
              aria-label="Votre message"
            />
            <button type="submit" className="btn-primary" disabled={sending || content.trim() === ''}>
              Envoyer
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
