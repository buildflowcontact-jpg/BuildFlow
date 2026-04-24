import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type DbTask = {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  project_id: string
}

const FR_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const FR_DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-slate-400',
  'in-progress': 'bg-amber-400',
  review: 'bg-blue-400',
  done: 'bg-emerald-400',
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  review: 'En revue',
  done: 'Terminé',
}

export default function ProjectCalendar() {
  const { id: projectId } = useParams<{ id: string }>()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<DbTask | null>(null)

  useEffect(() => {
    if (!projectId) return
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, project_id')
      .eq('project_id', projectId)
      .not('due_date', 'is', null)
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); setLoading(false); return }
        setTasks((data ?? []) as DbTask[])
        setLoading(false)
      })
  }, [projectId])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, DbTask[]>()
    tasks.forEach(t => {
      if (!t.due_date) return
      const key = t.due_date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return map
  }, [tasks])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  if (loading) return (
    <div className="space-y-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bf-surface p-8 animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="grid grid-cols-7 gap-2">
            {[...Array(14)].map((_, j) => (
              <div key={j} className="h-10 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
  if (loadError) return (
    <div className="bf-surface p-8 text-red-600">Erreur : {loadError}</div>
  )

  return (
    <div className="space-y-6">
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Calendrier</h1>
      </div>

      <div className="bf-panel overflow-hidden">
        {/* Navigation */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <button onClick={prev} className="bf-button-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-base font-semibold text-slate-900">{FR_MONTHS[month]} {year}</h2>
          <button onClick={next} className="bf-button-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* Jours de semaine */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {FR_DAYS_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{d}</div>
          ))}
        </div>

        {/* Grille */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="border-b border-r border-slate-50 bg-slate-50/50 min-h-[100px]" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayTasks = tasksByDate.get(key) ?? []
            const isToday = key === todayKey
            return (
              <div key={day} className={`relative min-h-[100px] border-b border-r border-slate-100 p-2 ${isToday ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>{day}</span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 3).map(t => (
                    <button key={t.id} onClick={() => setSelected(t)}
                      className="flex w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-left hover:bg-white/80">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[t.status]}`} />
                      <span className="truncate text-[10px] text-slate-700">{t.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="pl-1 text-[10px] font-medium text-slate-400">+{dayTasks.length - 3} de plus</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Panneau tâche sélectionnée */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-900 pr-4">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[selected.status]}`} />
                <span className="text-sm text-slate-600">{STATUS_LABEL[selected.status]}</span>
              </div>
              {selected.due_date && (
                <p className="text-sm text-slate-500">
                  Échéance : <span className="font-medium text-slate-700">{new Date(selected.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="mt-6 w-full rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

