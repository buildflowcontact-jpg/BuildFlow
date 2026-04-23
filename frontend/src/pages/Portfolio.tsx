import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  BarChart3, TrendingUp, CheckCircle2, AlertTriangle, DollarSign,
  FolderOpen, Calendar, ArrowRight, Filter, Search, ArrowUpDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ProjectRow {
  id: string
  name: string
  status: 'active' | 'on_hold' | 'completed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  budget: number | null
  created_at: string
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
}

type StatusFilter = 'all' | 'active' | 'on_hold' | 'completed' | 'cancelled'
type PeriodFilter = 'all' | 'month' | 'quarter' | 'year'
type SortBy = 'created_desc' | 'completion_desc' | 'risk_desc' | 'budget_desc' | 'deadline_asc'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  on_hold: 'En pause',
  completed: 'Terminé',
  cancelled: 'Annulé',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  on_hold: 'text-amber-600 bg-amber-50 border-amber-200',
  completed: 'text-blue-600 bg-blue-50 border-blue-200',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
}

const CHART_COLORS: Record<string, string> = {
  active: '#10b981',
  on_hold: '#f59e0b',
  completed: '#3b82f6',
  cancelled: '#ef4444',
}

function formatBudget(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k€`
  return `${n} €`
}

function periodStart(period: PeriodFilter): Date | null {
  const now = new Date()
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  return null
}

function completionPercent(project: ProjectRow) {
  return project.total_tasks === 0 ? 0 : Math.round((project.completed_tasks / project.total_tasks) * 100)
}

function healthScore(project: ProjectRow) {
  let score = 100
  score -= project.overdue_tasks * 12
  if (project.status === 'on_hold') score -= 15
  if (project.status === 'cancelled') score -= 35
  const completion = completionPercent(project)
  if (completion < 40) score -= 20
  if (project.status === 'completed') score += 5
  return Math.max(0, Math.min(100, score))
}

function healthTag(project: ProjectRow): 'healthy' | 'at_risk' | 'in_trouble' {
  const score = healthScore(project)
  if (score > 70) return 'healthy'
  if (score > 40) return 'at_risk'
  return 'in_trouble'
}

const HEALTH_LABEL: Record<'healthy' | 'at_risk' | 'in_trouble', string> = {
  healthy: 'Sain',
  at_risk: 'A surveiller',
  in_trouble: 'Critique',
}

const HEALTH_COLOR: Record<'healthy' | 'at_risk' | 'in_trouble', string> = {
  healthy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  at_risk: 'text-amber-700 bg-amber-50 border-amber-200',
  in_trouble: 'text-red-700 bg-red-50 border-red-200',
}

export default function Portfolio() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('risk_desc')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPortfolio()
  }, [])

  async function loadPortfolio() {
    setLoading(true)
    // Load projects
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name, status, start_date, end_date, budget, created_at')
      .order('created_at', { ascending: false })

    if (!projectsData) { setLoading(false); return }

    // Load tasks counts per project
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('project_id, status, due_date')

    const now = new Date()

    const rows: ProjectRow[] = projectsData.map((p) => {
      const pTasks = (tasksData || []).filter(t => t.project_id === p.id)
      const completed = pTasks.filter(t => t.status === 'done').length
      const overdue = pTasks.filter(t => {
        if (t.due_date && t.status !== 'done') {
          return new Date(t.due_date) < now
        }
        return false
      }).length
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        start_date: p.start_date,
        end_date: p.end_date,
        budget: p.budget,
        created_at: p.created_at,
        total_tasks: pTasks.length,
        completed_tasks: completed,
        overdue_tasks: overdue,
      }
    })

    setProjects(rows)
    setLoading(false)
  }

  // ─── Filtering ───────────────────────────────────────────────────────────
  const pStart = periodStart(periodFilter)

  const filtered = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (pStart && p.created_at < pStart.toISOString()) return false
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'completion_desc') return completionPercent(b) - completionPercent(a)
    if (sortBy === 'risk_desc') return healthScore(a) - healthScore(b)
    if (sortBy === 'budget_desc') return (b.budget ?? 0) - (a.budget ?? 0)
    if (sortBy === 'deadline_asc') {
      const aDate = a.end_date ? new Date(a.end_date).getTime() : Number.MAX_SAFE_INTEGER
      const bDate = b.end_date ? new Date(b.end_date).getTime() : Number.MAX_SAFE_INTEGER
      return aDate - bDate
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const totalBudget = sorted.reduce((s, p) => s + (p.budget ?? 0), 0)
  const avgCompletion = sorted.length === 0 ? 0 : Math.round(
    sorted.reduce((s, p) => {
      const pct = p.total_tasks === 0 ? 0 : (p.completed_tasks / p.total_tasks) * 100
      return s + pct
    }, 0) / sorted.length
  )
  const atRisk = sorted.filter(p => p.overdue_tasks > 0 && p.status === 'active').length
  const criticalProjects = sorted.filter(p => healthTag(p) === 'in_trouble').length

  const priorityProjects = sorted
    .filter(p => p.status !== 'completed' && p.status !== 'cancelled')
    .sort((a, b) => {
      const aRisk = a.overdue_tasks * 100 + (100 - completionPercent(a))
      const bRisk = b.overdue_tasks * 100 + (100 - completionPercent(b))
      return bRisk - aRisk
    })
    .slice(0, 5)

  // ─── Chart data ──────────────────────────────────────────────────────────
  const chartData = sorted.map(p => ({
    name: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name,
    completion: p.total_tasks === 0 ? 0 : Math.round((p.completed_tasks / p.total_tasks) * 100),
    status: p.status,
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vue portefeuille</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue consolidée de tous vos projets</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un projet"
              className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="on_hold">En pause</option>
            <option value="completed">Terminés</option>
            <option value="cancelled">Annulés</option>
          </select>
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">Toute la période</option>
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="risk_desc">Priorité risque</option>
              <option value="completion_desc">Avancement</option>
              <option value="budget_desc">Budget</option>
              <option value="deadline_asc">Échéance proche</option>
              <option value="created_desc">Création récente</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Chargement…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={<FolderOpen size={16} className="text-indigo-500" />} label="Total" value={sorted.length} bg="bg-indigo-50" />
            <KpiCard icon={<TrendingUp size={16} className="text-emerald-500" />} label="Actifs" value={sorted.filter(p => p.status === 'active').length} bg="bg-emerald-50" />
            <KpiCard icon={<CheckCircle2 size={16} className="text-blue-500" />} label="Terminés" value={sorted.filter(p => p.status === 'completed').length} bg="bg-blue-50" />
            <KpiCard icon={<AlertTriangle size={16} className="text-amber-500" />} label="À risque" value={atRisk} bg="bg-amber-50" />
            <KpiCard icon={<AlertTriangle size={16} className="text-red-500" />} label="Critiques" value={criticalProjects} bg="bg-red-50" />
            <KpiCard icon={<DollarSign size={16} className="text-purple-500" />} label="Budget total" value={formatBudget(totalBudget)} bg="bg-purple-50" />
            <KpiCard icon={<BarChart3 size={16} className="text-sky-500" />} label="Avancement moy." value={`${avgCompletion}%`} bg="bg-sky-50" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Priorités multi-projets</h2>
            {priorityProjects.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun projet prioritaire sur les filtres actuels</p>
            ) : (
              <div className="space-y-2">
                {priorityProjects.map((p) => {
                  const health = healthTag(p)
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="w-full text-left flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {completionPercent(p)}% terminé · {p.overdue_tasks} tâche{p.overdue_tasks > 1 ? 's' : ''} en retard
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HEALTH_COLOR[health]}`}>
                        {HEALTH_LABEL[health]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chart + list side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-500" />
                Avancement par projet
              </h2>
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun projet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, 'Avancement']} />
                    <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={CHART_COLORS[entry.status] ?? '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[k] }} />
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* Budget distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <DollarSign size={15} className="text-purple-500" />
                Budget par projet
              </h2>
              <div className="space-y-2 overflow-y-auto max-h-[240px] pr-1">
                {sorted
                  .filter(p => (p.budget ?? 0) > 0)
                  .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
                  .map(p => {
                    const pct = totalBudget > 0 ? Math.round(((p.budget ?? 0) / totalBudget) * 100) : 0
                    return (
                      <div key={p.id}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600 truncate max-w-[60%]">{p.name}</span>
                          <span className="font-medium text-gray-800">{formatBudget(p.budget ?? 0)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, background: CHART_COLORS[p.status] ?? '#6366f1' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                {sorted.filter(p => (p.budget ?? 0) > 0).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun budget renseigné</p>
                )}
              </div>
            </div>
          </div>

          {/* Project table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                {sorted.length} projet{sorted.length !== 1 ? 's' : ''}
              </h2>
            </div>
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Aucun projet pour ces filtres</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs">Projet</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs hidden sm:table-cell">Statut</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs hidden md:table-cell">Avancement</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs hidden md:table-cell">Santé</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs hidden lg:table-cell">Budget</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs hidden lg:table-cell">Échéance</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map(p => {
                    const pct = p.total_tasks === 0 ? 0 : Math.round((p.completed_tasks / p.total_tasks) * 100)
                    const health = healthTag(p)
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[180px]">{p.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{p.total_tasks} tâche{p.total_tasks !== 1 ? 's' : ''}{p.overdue_tasks > 0 && <span className="ml-1 text-red-500">· {p.overdue_tasks} en retard</span>}</div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[p.status] ?? ''}`}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[80px]">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, background: CHART_COLORS[p.status] ?? '#6366f1' }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HEALTH_COLOR[health]}`}>
                            {HEALTH_LABEL[health]}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell text-gray-600">
                          {p.budget ? formatBudget(p.budget) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell text-gray-500 text-xs">
                          {p.end_date ? (
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(p.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ArrowRight size={14} className="text-gray-300" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-transparent`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
