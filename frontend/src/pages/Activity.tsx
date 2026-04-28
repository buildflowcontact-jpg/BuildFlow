import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getGlobalActivityLogs, type ActivityLogFormatted } from '../lib/auditLog'
import { FilePlus, Pencil, Trash2, Clock, Filter, RefreshCw } from 'lucide-react'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `il y a ${days} j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const ACTION_STYLES: Record<string, { icon: JSX.Element; bg: string; text: string }> = {
  CREATE: {
    icon: <FilePlus className="h-4 w-4" />,
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
  },
  UPDATE: {
    icon: <Pencil className="h-4 w-4" />,
    bg: 'bg-sky-100',
    text: 'text-sky-600',
  },
  DELETE: {
    icon: <Trash2 className="h-4 w-4" />,
    bg: 'bg-red-100',
    text: 'text-red-500',
  },
}

const TABLE_LABEL: Record<string, string> = {
  tasks: 'Tâche',
  projects: 'Projet',
  documents: 'Document',
  milestones: 'Jalon',
  risk_register: 'Risque',
  expenses: 'Dépense',
  activity_logs: 'Journal',
  comments: 'Commentaire',
}

const ACTION_FILTERS = ['all', 'CREATE', 'UPDATE', 'DELETE'] as const
type ActionFilter = typeof ACTION_FILTERS[number]

const RESOURCE_FILTERS = ['all', 'projects', 'tasks', 'documents', 'comments', 'milestones', 'risk_register', 'expenses'] as const
type ResourceFilter = typeof RESOURCE_FILTERS[number]

export default function Activity() {
  const [logs, setLogs] = useState<ActivityLogFormatted[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadLogs = async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setLoadError('')

      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session?.user) {
          if (mounted) {
            setLogs([])
            setLoading(false)
          }
          return
        }

        const action = actionFilter === 'all' ? undefined : actionFilter
        const tableName = resourceFilter === 'all' ? undefined : resourceFilter
        const globalLogs = await getGlobalActivityLogs(150, { action, tableName })

        if (mounted) {
          setLogs(globalLogs)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur de chargement'
        if (mounted) {
          setLoadError(message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadLogs()

    const channel = supabase
      .channel('global-activity-page')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
      }, () => {
        loadLogs(true)
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [actionFilter, resourceFilter, reloadNonce])

  const filteredCountLabel = useMemo(
    () => `${logs.length} événement${logs.length !== 1 ? 's' : ''}`,
    [logs.length]
  )

  if (loadError) return (
    <div className="bf-card p-8 text-red-600">Erreur : {loadError}</div>
  )

  return (
    <div className="space-y-6">
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Pilotage</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Historique global d'activité</h1>
      </div>

      {/* Filtres */}
      <div className="bf-panel p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            <Filter className="h-3.5 w-3.5" /> Filtres
          </span>
          {ACTION_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${actionFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {f === 'all' ? 'Toutes actions' : f === 'CREATE' ? 'Créations' : f === 'UPDATE' ? 'Modifications' : 'Suppressions'}
            </button>
          ))}

          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value as ResourceFilter)}
            className="ml-auto min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            {RESOURCE_FILTERS.map((resource) => (
              <option key={resource} value={resource}>
                {resource === 'all' ? 'Toutes ressources' : (TABLE_LABEL[resource] ?? resource)}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setRefreshing(true)
              setReloadNonce((value) => value + 1)
            }}
            title="Rafraîchir"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">{filteredCountLabel}</p>
      </div>

      {loading && (
        <div className="bf-panel p-8 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 animate-pulse">
              <div className="h-9 w-9 rounded-2xl bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-2/3 rounded-lg bg-slate-200" />
                <div className="h-3 w-1/3 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="bf-panel p-16 text-center">
          <Clock className="mx-auto h-12 w-12 text-slate-200 mb-3" />
          <p className="text-slate-400 text-sm">Aucune activité enregistrée</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="bf-panel overflow-hidden">
          <ul className="divide-y divide-slate-50">
            {logs.map((log, idx) => {
              const style = ACTION_STYLES[log.action] ?? ACTION_STYLES.UPDATE
              const tableLabel = TABLE_LABEL[log.table_name] ?? log.table_name
              return (
                <li key={log.id ?? idx} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/60 transition">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl ${style.bg} ${style.text}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      <span>{log.user_name ?? 'Système'}</span>
                      <span className="mx-1 text-slate-300">•</span>
                      <span>{log.action_label ?? log.action}</span>
                      <span className="font-normal text-slate-500"> · {tableLabel}</span>
                    </p>
                    {log.summary && (
                      <p className="mt-0.5 text-xs text-slate-400 truncate">{log.summary}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">{timeAgo(log.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
