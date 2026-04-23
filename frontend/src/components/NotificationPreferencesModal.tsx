import { useEffect, useState } from 'react'
import { X, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Props {
  userId: string
  onClose: () => void
}

export function NotificationPreferencesModal({ userId, onClose }: Props) {
  const [notifyInApp, setNotifyInApp] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('notify_in_app')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotifyInApp(data.notify_in_app ?? true)
        setLoading(false)
      })
  }, [userId])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('user_profiles')
      .update({ notify_in_app: notifyInApp })
      .eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
          ) : (
            <button
              type="button"
              onClick={() => setNotifyInApp(v => !v)}
              aria-pressed={notifyInApp}
              className={`w-full flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                notifyInApp ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Notifications dans l'application</p>
                <p className="text-xs text-slate-500 mt-0.5">Assignation de tâches, alertes chantier, SLA...</p>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors flex-shrink-0 relative ${
                notifyInApp ? 'bg-indigo-500' : 'bg-slate-300'
              }`}>
                <div className={`absolute top-0 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  notifyInApp ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-2xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {saved ? 'Enregistre OK' : saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

