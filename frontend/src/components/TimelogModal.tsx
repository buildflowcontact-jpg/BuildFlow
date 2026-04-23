import React, { useState } from 'react'
import { X } from 'lucide-react'
import { logTime } from '../lib/timeTracking'
import { DateInput } from './DateInput'
import { ModalTabs } from './ModalTabs'

interface TimelogModalProps {
  taskId: string
  seconds?: number
  onClose: () => void
  onSuccess?: () => void
}

export function TimelogModal({ taskId, seconds = 0, onClose, onSuccess }: TimelogModalProps) {
  const [activeTab, setActiveTab] = useState<'time' | 'notes'>('time')
  const [hours, setHours] = useState<string>(((seconds || 0) / 3600).toFixed(2))
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const hoursNum = parseFloat(hours)
    if (hoursNum <= 0) {
      setError('Les heures doivent être supérieures à 0')
      return
    }

    if (!date) {
      setError('Veuillez sélectionner une date')
      return
    }

    try {
      setSubmitting(true)
      const success = await logTime(taskId, hoursNum, date, notes)

      if (success) {
        onSuccess?.()
        onClose()
      } else {
        setError('Erreur lors de l\'enregistrement')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Enregistrer le temps</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ModalTabs
            tabs={[
              { id: 'time', label: 'Saisie' },
              { id: 'notes', label: 'Notes' },
            ]}
            value={activeTab}
            onChange={(id) => setActiveTab(id as 'time' | 'notes')}
          />

          {/* Hours */}
          {activeTab === 'time' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heures</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.currentTarget.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Ex: 1.5 pour 1h30</p>
          </div>
          )}

          {/* Date */}
          {activeTab === 'time' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <DateInput value={date} onChange={setDate} />
          </div>
          )}

          {/* Notes */}
          {activeTab === 'notes' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              placeholder="Détails du travail effectué..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          )}

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
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

