import { useEffect, useState } from 'react'
import { Clock, Play, Pause, Plus, Trash2 } from 'lucide-react'
import { getTaskEstimation, getTimeEntries, deleteTimeEntry } from '../lib/timeTracking'
import { TimelogModal } from './TimelogModal'

interface TimeTrackerProps {
  taskId: string
  onTimeLogged?: () => void
}

export function TimeTracker({ taskId, onTimeLogged }: TimeTrackerProps) {
  const [estimation, setEstimation] = useState<{ estimated_hours: number; actual_hours: number } | null>(null)
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [taskId])

  // Timer effect
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  const loadData = async () => {
    try {
      setLoading(true)
      const est = await getTaskEstimation(taskId)
      const entries = await getTimeEntries(taskId)
      setEstimation(est)
      setTimeEntries(entries)
    } catch (error) {
      console.error('Error loading time data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartStop = () => {
    setIsRunning(!isRunning)
  }

  const handleSaveTime = async () => {
    if (elapsedSeconds === 0) return
    // Save will be handled by TimelogModal
    setShowModal(true)
    setIsRunning(false)
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const success = await deleteTimeEntry(entryId)
      if (success) {
        await loadData()
        onTimeLogged?.()
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  const handleTimeLogged = async () => {
    setElapsedSeconds(0)
    await loadData()
    onTimeLogged?.()
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement...</div>
  }

  const totalHours = estimation?.actual_hours || 0
  const estimatedHours = estimation?.estimated_hours || 0
  const progress = estimatedHours > 0 ? Math.min((totalHours / estimatedHours) * 100, 100) : 0

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Clock className="w-5 h-5" /> Suivi du temps
      </h3>

      {/* Timer display */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 space-y-3">
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-gray-900">
            {Math.floor(elapsedSeconds / 3600)
              .toString()
              .padStart(2, '0')}
            :{Math.floor((elapsedSeconds % 3600) / 60)
              .toString()
              .padStart(2, '0')}
            :{(elapsedSeconds % 60).toString().padStart(2, '0')}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {isRunning ? '⏱️ En cours...' : '⏸️ Arrêté'}
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleStartStop}
            className={`px-4 py-2 rounded font-medium text-white flex items-center gap-2 transition ${
              isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Pause' : 'Démarrer'}
          </button>

          {elapsedSeconds > 0 && (
            <button
              onClick={handleSaveTime}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition"
            >
              Enregistrer
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {estimatedHours > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progression</span>
            <span className="font-medium text-gray-900">
              {totalHours.toFixed(1)}h / {estimatedHours.toFixed(1)}h
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Quick add button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 transition"
      >
        <Plus className="w-4 h-4" />
        Ajouter du temps manuellement
      </button>

      {/* Time entries list */}
      {timeEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 uppercase">Entrées récentes</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {timeEntries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <p className="font-medium text-gray-900">{entry.hours.toFixed(1)}h</p>
                  <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for logging time */}
      {showModal && <TimelogModal taskId={taskId} seconds={elapsedSeconds} onClose={() => setShowModal(false)} onSuccess={handleTimeLogged} />}
    </div>
  )
}
