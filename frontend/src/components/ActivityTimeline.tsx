import { useEffect, useState, memo } from 'react'
import { History, ChevronDown } from 'lucide-react'
import { getActivityLogs, ActivityLogFormatted } from '../lib/auditLog'

interface ActivityTimelineProps {
  tableName: string
  recordId: string
  limit?: number
  showHeader?: boolean
}

export const ActivityTimeline = memo(function ActivityTimeline({
  tableName,
  recordId,
  limit = 50,
  showHeader = true,
}: ActivityTimelineProps) {
  const [logs, setLogs] = useState<ActivityLogFormatted[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true)
        const data = await getActivityLogs(tableName, recordId, limit)
        setLogs(data)
      } catch (error) {
        console.error('Error loading activity logs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLogs()
  }, [tableName, recordId, limit])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Aucune activité enregistrée</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          title={expanded ? "Réduire l'historique des activités" : "Déplier l'historique des activités"}
          aria-label={expanded ? "Réduire l'historique des activités" : "Déplier l'historique des activités"}
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-700">Historique ({logs.length})</h3>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-600 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {(expanded || !showHeader) && (
        <div className="space-y-0">
          {logs.map((log, index) => (
            <ActivityLogEntry key={log.id} log={log} isLast={index === logs.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
})

interface ActivityLogEntryProps {
  log: ActivityLogFormatted
  isLast: boolean
}

const ActivityLogEntry = memo(function ActivityLogEntry({ log, isLast }: ActivityLogEntryProps) {
  const [showDetails, setShowDetails] = useState(false)

  const actionColor = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
  }[log.action] || 'bg-gray-100 text-gray-700'

  const actionIcon = {
    CREATE: '➕',
    UPDATE: '✏️',
    DELETE: '🗑️',
  }[log.action] || '•'

  return (
    <div className="flex gap-4 py-3 px-4 bg-white hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${actionColor}`}>
          {actionIcon}
        </div>
        {!isLast && <div className="w-0.5 h-8 bg-gray-200 mt-1"></div>}
      </div>

      <div className="flex-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium text-gray-900">{log.user_name || 'Système'}</span>
              <span className="text-gray-600"> {log.action_label}</span>
            </p>
            {log.summary && <p className="text-xs text-gray-500 mt-1 truncate">{log.summary}</p>}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(log.created_at)}</span>
        </div>

        {log.new_values && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium transition"
            title={showDetails ? "Masquer les détails de l'activité" : "Afficher les détails de l'activité"}
            aria-label={showDetails ? "Masquer les détails de l'activité" : "Afficher les détails de l'activité"}
          >
            {showDetails ? 'Masquer détails' : 'Afficher détails'}
          </button>
        )}

        {showDetails && log.new_values && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1 font-mono">
            <div className="font-medium text-gray-700 mb-2">Modifications:</div>
            {log.action === 'DELETE' && log.old_values ? (
              <FieldComparison label="Données supprimées" value={log.old_values} />
            ) : log.action === 'UPDATE' && log.old_values ? (
              Object.entries(log.new_values).map(([key, newVal]) => {
                const oldVal = log.old_values?.[key]
                if (oldVal !== newVal) {
                  return (
                    <div key={key} className="text-gray-600">
                      <span className="text-gray-500">{key}:</span>
                      <br />
                      <span className="line-through text-red-600">{formatValue(oldVal)}</span>
                      <br />
                      <span className="text-green-600">→ {formatValue(newVal)}</span>
                    </div>
                  )
                }
                return null
              })
            ) : (
              <FieldComparison label="Créé avec" value={log.new_values} />
            )}
          </div>
        )}
      </div>
    </div>
  )
})

function FieldComparison({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-gray-600">
      <span className="text-gray-500">{label}:</span>
      <div className="ml-2 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
        {Object.entries(value || {}).map(([key, val]) => (
          <div key={key}>
            <span className="text-gray-600">{key}: {formatValue(val)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatValue(val: any, maxLen = 60): string {
  if (val === null || val === undefined) return '(vide)'
  if (typeof val === 'boolean') return val ? 'oui' : 'non'
  if (typeof val === 'string') {
    if (val.length > maxLen) return `"${val.substring(0, maxLen)}..."`
    return `"${val}"`
  }
  if (typeof val === 'object') return JSON.stringify(val).substring(0, maxLen)
  return String(val)
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins}m`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`

  return date.toLocaleDateString('fr-FR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default memo(ActivityTimeline)
