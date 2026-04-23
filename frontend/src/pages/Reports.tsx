import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { exportProjectsToPDFReport } from '../lib/export'

type ReportTask = { id: string; status: string; priority: string; dueDate?: string | null; completedAt?: string | null; createdAt?: string | null }
type ReportProject = { id: string; name: string; status: string; budget?: number | null; tasks: ReportTask[] }

function pct(value: number, total: number): string {
  if (total === 0) return 'aucune'
  return `${Math.round((value / total) * 100)}%`
}

function ProgressBar({ value, total, color = 'bg-slate-900' }: { value: number; total: number; color?: string }) {
  const w = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
    </div>
  )
}

export default function Reports() {
  const [projects, setProjects] = useState<ReportProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data, error: err } = await supabase
        .from('projects')
        .select('id, name, status, budget, tasks(id, status, priority, due_date, completed_at, created_at)')
        .eq('created_by', session.user.id)
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      const mapped: ReportProject[] = (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        budget: p.budget,
        tasks: (p.tasks ?? []).map((t: any) => ({
          id: t.id,
          status: t.status,
          priority: t.priority,
          dueDate: t.due_date,
          completedAt: t.completed_at,
          createdAt: t.created_at,
        })),
      }))
      setProjects(mapped)
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const archivedProjects = projects.filter((p) => p.status === 'on-hold' || p.status === 'cancelled').length

  const allTasks = projects.flatMap((p) => p.tasks)
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => t.status === 'done').length
  const inProgressTasks = allTasks.filter((t) => t.status === 'in-progress').length
  const urgentTasks = allTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdueTasks = allTasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false
    return new Date(t.dueDate) < today
  }).length

  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)

  // Délai moyen de complétion (créé → completed_at) en jours
  const avgCompletionDays = useMemo(() => {
    const tasksWithTimes = allTasks.filter((t) => t.completedAt && t.createdAt)
    if (tasksWithTimes.length === 0) return null
    const totalMs = tasksWithTimes.reduce((sum, t) => {
      return sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime())
    }, 0)
    return Math.round(totalMs / tasksWithTimes.length / 86400000)
  }, [allTasks])

  // Histogramme des tâches terminées par semaine (8 dernières semaines)
  const weeklyCompletionData = useMemo(() => {
    const weeks: { label: string; count: number }[] = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - i * 7 - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      const count = allTasks.filter((t) => {
        if (!t.completedAt) return false
        const d = new Date(t.completedAt)
        return d >= weekStart && d <= weekEnd
      }).length
      weeks.push({
        label: `S${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
        count,
      })
    }
    return weeks
  }, [allTasks])

  function exportCSV() {
    const rows: string[][] = [
      ['Projet', 'Statut', 'Budget (EUR)', 'Total taches', 'Taches terminees', 'Taux (%)', 'Urgentes/Hautes'],
    ]
    for (const p of projects) {
      const total = p.tasks.length
      const done = p.tasks.filter((t) => t.status === 'completed' || t.status === 'done').length
      const urgent = p.tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length
      rows.push([
        p.name,
        p.status,
        String(p.budget ?? 0),
        String(total),
        String(done),
        total === 0 ? '0' : String(Math.round((done / total) * 100)),
        String(urgent),
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buildflow-rapport-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    exportProjectsToPDFReport(projects, 'buildflow-rapport')
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl bg-white p-6 shadow-lg animate-pulse">
            <div className="h-4 w-1/2 rounded-lg bg-slate-200 mb-3" />
            <div className="h-8 w-1/3 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-8 shadow-lg animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="h-40 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  )
  if (error) return <div className="rounded-3xl bg-white p-8 shadow-lg text-red-600">Erreur : {error}</div>

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Rapports</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">KPIs &amp; Résultats</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Analyse la performance de tes projets et prends des décisions rapides.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={exportCSV}
              className="rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Exporter CSV
            </button>
            <button
              onClick={exportPDF}
              className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Exporter PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Taux d'achèvement</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{pct(completedTasks, totalTasks)}</p>
          <p className="mt-2 text-sm text-slate-500">{completedTasks} / {totalTasks} tâches terminées</p>
          <ProgressBar value={completedTasks} total={totalTasks} color="bg-emerald-500" />
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Projets actifs</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{activeProjects}</p>
          <p className="mt-2 text-sm text-slate-500">{archivedProjects} archive(s) &middot; {totalProjects} total</p>
          <ProgressBar value={activeProjects} total={totalProjects} color="bg-sky-500" />
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Tâches en cours</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{inProgressTasks}</p>
          <p className="mt-2 text-sm text-slate-500">{urgentTasks} priorité haute/urgente</p>
          <ProgressBar value={inProgressTasks} total={totalTasks} color="bg-amber-500" />
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">En retard</p>
          <p className={`mt-4 text-4xl font-semibold ${overdueTasks > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueTasks}</p>
          <p className="mt-2 text-sm text-slate-500">tâche(s) dépassée(s)</p>
          <ProgressBar value={overdueTasks} total={totalTasks} color="bg-red-500" />
        </div>
      </section>

      {/* Stats temporelles */}
      {(avgCompletionDays !== null || weeklyCompletionData.some((w) => w.count > 0)) && (
        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Analyse temporelle</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {avgCompletionDays !== null && (
              <div className="rounded-2xl border border-slate-200 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Délai moyen de complétion</p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">{avgCompletionDays}j</p>
                <p className="mt-2 text-sm text-slate-500">entre création et clôture d'une tâche</p>
              </div>
            )}
            {weeklyCompletionData.some((w) => w.count > 0) && (
              <div className="rounded-2xl border border-slate-200 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-4">Tâches terminées par semaine</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weeklyCompletionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Tâches terminées']} />
                    <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Avancement par projet</h2>
          {totalBudget > 0 && (
            <span className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Budget total : {totalBudget.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        {projects.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">Aucun projet disponible.</p>
        ) : (
          <div className="mt-8 space-y-4">
            {projects.map((project) => {
              const total = project.tasks.length
              const done = project.tasks.filter((t) => t.status === 'completed' || t.status === 'done').length
              const wip = project.tasks.filter((t) => t.status === 'in-progress').length
              const urgent = project.tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length
              return (
                <div key={project.id} className="rounded-3xl border border-slate-200 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${project.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      <h3 className="font-semibold text-slate-900">{project.name}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {urgent > 0 && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          {urgent} urgente{urgent > 1 ? 's' : ''}
                        </span>
                      )}
                      {wip > 0 && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          {wip} en cours
                        </span>
                      )}
                      <span className="font-semibold text-slate-700">{pct(done, total)}</span>
                      <span>{done} / {total} tâches</span>
                    </div>
                  </div>
                  <ProgressBar value={done} total={total} color="bg-slate-900" />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}