import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Filter } from 'lucide-react'
import { GanttChart, GanttTask, GanttPhase } from '../../components/GanttChart'
import { BurndownChart } from '../../components/BurndownChart'
import { supabase } from '../../lib/supabase'
import type { DbProject } from '../../lib/db'

export function ProjectGantt() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<DbProject | null>(null)
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [phases, setPhases] = useState<GanttPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showBurndown, setShowBurndown] = useState(false)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [projRes, tasksRes, phasesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase
          .from('tasks')
          .select('id, title, status, priority, start_date, end_date, due_date, phase_id, parent_id')
          .eq('project_id', projectId!)
          .order('start_date', { ascending: true }),
        supabase
          .from('construction_phases')
          .select('id, name')
          .eq('project_id', projectId!)
          .order('start_date', { ascending: true }),
      ])
      setProject(projRes.data)
      setTasks((tasksRes.data ?? []) as GanttTask[])
      setPhases((phasesRes.data ?? []) as GanttPhase[])
    } catch (err: any) {
      setLoadError(err?.message ?? 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = async (taskId: string, startDate: string, endDate: string) => {
    await supabase
      .from('tasks')
      .update({ start_date: startDate, end_date: endDate, due_date: endDate })
      .eq('id', taskId)
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, start_date: startDate, end_date: endDate, due_date: endDate } : t)
    )
  }

  const handleTaskClick = (taskId: string) => {
    navigate(`/projects/${projectId}/tasks?task=${taskId}`)
  }

  const filteredTasks = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus)

  if (loading) return (
    <div className="rounded-3xl bg-white p-8 shadow-lg animate-pulse">
      <div className="h-5 w-1/4 rounded-lg bg-slate-200 mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 mb-3">
          <div className="h-4 w-1/4 rounded-lg bg-slate-200" />
          <div className="h-4 flex-1 rounded-lg bg-slate-100" style={{ marginLeft: `${i * 8}%`, width: `${40 - i * 5}%` }} />
        </div>
      ))}
    </div>
  )
  if (loadError) return <div className="rounded-3xl bg-white p-8 text-red-600 shadow-lg">Erreur : {loadError}</div>
  if (!project) return <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-lg">Projet non trouvé</div>

  const STATUS_OPTIONS = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'todo', label: 'À faire' },
    { value: 'in-progress', label: 'En cours' },
    { value: 'review', label: 'En revue' },
    { value: 'done', label: 'Terminé' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-white px-8 py-6 shadow-lg">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Chronologie</h1>
        <p className="mt-1 text-sm text-slate-500">{project.name}</p>
      </div>

      {/* Controls */}
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-lg flex gap-4 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filtrer</span>
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.currentTarget.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowBurndown(v => !v)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              showBurndown ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Burn Down
          </button>
        </div>
      </div>

      {/* Burn Down */}
      {showBurndown && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <BurndownChart tasks={filteredTasks} startDate={project.start_date ?? undefined} endDate={project.end_date ?? undefined} />
        </div>
      )}

      {/* Gantt interactif */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-5 text-lg font-semibold text-slate-900">Diagramme de Gantt</h2>
        <GanttChart
          tasks={filteredTasks}
          phases={phases}
          onTaskClick={handleTaskClick}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
    </div>
  )
}
