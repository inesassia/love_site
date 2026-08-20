'use client'

import { useCallback, useEffect, useState } from 'react'
import BrandMark from '@/components/BrandMark'

type ReportStatus = 'en_attente' | 'traite' | 'ignore'

type AdminReport = {
  id: string
  category: string
  reason: string
  status: ReportStatus
  createdAt: string
  reporter: { id: string; email: string }
  reportedUser: { id: string; profile: { firstName: string } | null }
}

const CATEGORY_LABELS: Record<string, string> = {
  faux_profil: 'Faux profil',
  comportement_inapproprie: 'Comportement inapproprié',
  contenu_offensant: 'Contenu offensant',
  autre: 'Autre',
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  en_attente: 'En attente',
  traite: 'Traité',
  ignore: 'Ignoré',
}

const STATUS_FILTERS: { value: '' | ReportStatus; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'traite', label: 'Traités' },
  { value: 'ignore', label: 'Ignorés' },
]

export default function AdminPage() {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | ReportStatus>('')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setError(null)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)

    try {
      const response = await fetch(`/api/admin/reports?${params.toString()}`)
      if (!response.ok) {
        setError('Impossible de charger les signalements. Réessayez plus tard.')
        return
      }
      const data = await response.json()
      setReports(data)
    } catch {
      setError('Impossible de charger les signalements. Réessayez plus tard.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    loadReports()
  }, [loadReports])

  async function handleAction(reportId: string, action: 'traite' | 'ignore' | 'suspend') {
    setPendingActionId(reportId)
    setError(null)
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        setError("Erreur lors de la mise à jour du signalement.")
        return
      }

      if (action === 'suspend') {
        setStatusMessage('Utilisateur suspendu.')
        setTimeout(() => setStatusMessage(null), 3000)
      }

      await loadReports()
    } catch {
      setError("Erreur lors de la mise à jour du signalement.")
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <div>
      <div className="app-nav">
        <BrandMark />
        <span className="admin-badge">Administration</span>
      </div>
      <main className="app-main">
        <div className="discover-toolbar">
          <div>
            <h1>Signalements</h1>
            <p className="hint">
              {reports.length} signalement{reports.length === 1 ? '' : 's'} affiché
              {reports.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="toggle">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={statusFilter === filter.value ? 'active' : ''}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {statusMessage && (
          <p className="status-banner" role="status">
            {statusMessage}
          </p>
        )}

        {!loading && !error && reports.length === 0 && (
          <p className="empty-state">Aucun signalement pour le moment.</p>
        )}

        {reports.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Signalé par</th>
                  <th>Utilisateur signalé</th>
                  <th>Motif</th>
                  <th>Détails</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.reporter.email}</td>
                    <td>
                      {report.reportedUser.profile?.firstName ??
                        `Utilisateur #${report.reportedUser.id.slice(0, 8)}`}
                    </td>
                    <td>{CATEGORY_LABELS[report.category] ?? report.category}</td>
                    <td className="admin-table-reason">{report.reason}</td>
                    <td>
                      <span className={`status-pill status-${report.status}`}>
                        {STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td>{new Date(report.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={pendingActionId === report.id}
                          onClick={() => handleAction(report.id, 'traite')}
                        >
                          Marquer traité
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn"
                          disabled={pendingActionId === report.id}
                          onClick={() => handleAction(report.id, 'ignore')}
                        >
                          Ignorer
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn danger"
                          disabled={pendingActionId === report.id}
                          onClick={() => handleAction(report.id, 'suspend')}
                        >
                          Suspendre
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
