import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Clock, AlertCircle, TrendingUp, Printer, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { exportTasksToCSV } from '../../lib/export'

type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done'

type DbTask = {
  id: string
  title: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  created_at: string
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  todo:        { label: 'À faire',  color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  'in-progress':{ label: 'En cours', color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  review:      { label: 'En revue', color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  done:        { label: 'Terminé',  color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Faible',  color: 'text-slate-500' },
  medium: { label: 'Moyen',   color: 'text-amber-600' },
  high:   { label: 'Élevé',   color: 'text-orange-600' },
  urgent: { label: 'Urgent',  color: 'text-red-600' },
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.FC<any>; color: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function ProjectReports() {
  const { id: projectId } = useParams<{ id: string }>()
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<{ name: string; budget: number | null; start_date: string | null; end_date: string | null } | null>(null)
  const [expenses, setExpenses] = useState<{ amount: number; status: string }[]>([])

  useEffect(() => {
    if (!projectId) return
    Promise.all([
      supabase.from('tasks').select('id,title,status,priority,due_date,created_at').eq('project_id', projectId),
      supabase.from('projects').select('name,budget,start_date,end_date').eq('id', projectId).maybeSingle(),
      supabase.from('expenses').select('amount,status').eq('project_id', projectId),
    ]).then(([tasksRes, projRes, expRes]) => {
      setTasks((tasksRes.data ?? []) as DbTask[])
      setProject(projRes.data ?? null)
      setExpenses((expRes.data ?? []) as { amount: number; status: string }[])
      setLoading(false)
    })
  }, [projectId])

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bf-surface p-6 animate-pulse">
            <div className="h-4 w-1/2 rounded-lg bg-slate-200 mb-3" />
            <div className="h-8 w-1/3 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="bf-surface p-8 animate-pulse">
        <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
        <div className="h-48 rounded-xl bg-slate-100" />
      </div>
    </div>
  )
  if (!projectId) return null

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in-progress').length
  const progression = total > 0 ? Math.round((done / total) * 100) : 0

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const overdue = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today).length

  const spent = expenses.filter(e => e.status === 'Validé').reduce((s, e) => s + e.amount, 0)
  const committed = expenses.filter(e => e.status === 'En cours').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = spent + committed

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

  // Distribution priorités
  const byPriority = (['urgent', 'high', 'medium', 'low'] as const).map(p => ({
    key: p,
    label: PRIORITY_CONFIG[p].label,
    color: PRIORITY_CONFIG[p].color,
    count: tasks.filter(t => t.priority === p).length,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <div className="flex items-center justify-between">
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Rapports</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTasksToCSV(tasks, `rapport-${project?.name ?? 'projet'}.csv`)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition print:hidden"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition print:hidden"
            >
              <Printer className="h-4 w-4" />
              Exporter PDF
            </button>
          </div>
        </div>
        {project && <p className="mt-0.5 text-sm text-slate-400">{project.name}</p>}
      </div>

      {/* KPIs tâches */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Progression" value={`${progression} %`} sub={`${done} / ${total} tâches terminées`} icon={TrendingUp} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="En cours" value={inProgress} icon={Clock} color="bg-amber-100 text-amber-600" />
        <StatCard label="Terminées" value={done} icon={CheckCircle2} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="En retard" value={overdue} icon={AlertCircle} color={overdue > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'} />
      </div>

      {/* Barre de progression */}
      <div className="bf-surface px-8 py-6">
        <div className="flex items-center justify-between text-sm text-slate-700 mb-3">
          <span className="font-semibold">Avancement global</span>
          <span className="font-bold text-indigo-600">{progression} %</span>
        </div>
        <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progression}%` }} />
        </div>
        <div className="mt-4 flex gap-4 flex-wrap">
          {(['todo', 'in-progress', 'review', 'done'] as TaskStatus[]).map(status => {
            const count = tasks.filter(t => t.status === status).length
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs text-slate-500">{cfg.label}</span>
                <span className="text-xs font-semibold text-slate-700">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribution par priorité */}
        <div className="bf-surface p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Tâches par priorité</h2>
          <div className="space-y-3">
            {byPriority.map(p => (
              <div key={p.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={`font-medium ${p.color}`}>{p.label}</span>
                  <span className="text-slate-500">{p.count} tâche{p.count > 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${
                    p.key === 'urgent' ? 'bg-red-500' :
                    p.key === 'high' ? 'bg-orange-500' :
                    p.key === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                  }`} style={{ width: total > 0 ? `${(p.count / total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Résumé budget */}
        <div className="bf-surface p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Budget</h2>
          {project?.budget ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Budget total</span>
                <span className="font-semibold text-slate-900">{fmt(project.budget)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Dépensé (validé)</span>
                <span className="font-semibold text-emerald-600">{fmt(spent)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Engagé (en cours)</span>
                <span className="font-semibold text-amber-600">{fmt(committed)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Restant</span>
                <span className={`font-bold ${project.budget - totalExpenses < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {fmt(project.budget - totalExpenses)}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${(totalExpenses / project.budget) > 0.9 ? 'bg-red-500' : (totalExpenses / project.budget) > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (totalExpenses / project.budget) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucun budget défini pour ce projet.</p>
          )}
        </div>
      </div>

      {/* Tâches en retard */}
      {overdue > 0 && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-red-700">
            <AlertCircle className="h-5 w-5" />
            Tâches en retard ({overdue})
          </h2>
          <div className="space-y-2">
            {tasks
              .filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today)
              .map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{t.title}</span>
                  <span className="text-xs text-red-500 font-medium">{new Date(t.due_date!).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
