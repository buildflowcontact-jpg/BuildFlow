import React, { useEffect, useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { getRecurrenceConfig, setRecurrence, removeRecurrence, Frequency, getFrequencyLabel, getNextOccurrences } from '../lib/recurrence'
import { DateInput } from './DateInput'

interface RecurrenceModalProps {
  taskId: string
  onClose: () => void
  onSuccess?: () => void
}

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']

export function RecurrenceModal({ taskId, onClose, onSuccess }: RecurrenceModalProps) {
  const [hasRecurrence, setHasRecurrence] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [nextOccurrences, setNextOccurrences] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecurrence()
  }, [taskId])

  useEffect(() => {
    if (startDate) {
      const occurrences = getNextOccurrences(startDate, frequency, 5)
      setNextOccurrences(occurrences)
    }
  }, [startDate, frequency])

  const loadRecurrence = async () => {
    try {
      setLoading(true)
      const config = await getRecurrenceConfig(taskId)
      if (config) {
        setHasRecurrence(true)
        setFrequency(config.frequency)
        setStartDate(config.next_occurrence)
        if (config.end_date) setEndDate(config.end_date)
      }
    } catch (error) {
      console.error('Error loading recurrence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startDate) {
      setError('Veuillez sélectionner une date de début')
      return
    }

    if (endDate && endDate < startDate) {
      setError('La date de fin doit être après la date de début')
      return
    }

    try {
      setSubmitting(true)
      await setRecurrence(taskId, frequency, startDate, endDate || undefined)
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!hasRecurrence) return

    try {
      setSubmitting(true)
      const config = await getRecurrenceConfig(taskId)
      if (config) {
        await removeRecurrence(config.id)
        setHasRecurrence(false)
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] bf-modal-panel overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Récurrence
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasRecurrence ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Cette tâche n'est pas récurrente. Configurez la récurrence ci-dessous.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fréquence</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {getFrequencyLabel(f)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <DateInput value={startDate} onChange={setStartDate} />
              </div>

              {/* End date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin (optionnel)</label>
                <DateInput value={endDate} onChange={setEndDate} min={startDate} />
              </div>

              {/* Next occurrences preview */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-blue-900">Prochain affichage</p>
                <div className="space-y-1">
                  {nextOccurrences.slice(0, 3).map((date, idx) => (
                    <p key={idx} className="text-sm text-blue-800">
                      • {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium transition"
                >
                  {submitting ? 'Enregistrement...' : 'Activer'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="font-medium text-green-900">Tâche récurrente activée</p>
              <p className="text-sm text-green-800">
                Fréquence: <strong>{getFrequencyLabel(frequency)}</strong>
              </p>
              <p className="text-sm text-green-800">
                Prochaine: <strong>{new Date(startDate).toLocaleDateString('fr-FR')}</strong>
              </p>
              {endDate && (
                <p className="text-sm text-green-800">
                  Jusqu'au: <strong>{new Date(endDate).toLocaleDateString('fr-FR')}</strong>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium transition"
              >
                Désactiver
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 font-medium transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

