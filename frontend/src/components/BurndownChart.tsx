import { useMemo } from 'react'
import { TrendingDown, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface BurndownChartProps {
  tasks: any[]
  startDate?: string
  endDate?: string
  compact?: boolean
}

export function BurndownChart({ tasks, startDate, endDate, compact = false }: BurndownChartProps) {
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length
    const blocked = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length

    const completionRate = total > 0 ? (completed / total) * 100 : 0
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const velocity = tasks.filter(t => t.completed_at && new Date(t.completed_at) >= oneWeekAgo).length
    const remainingDays = calculateRemainingDays(endDate)
    const totalDays = (startDate && endDate)
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0
    const elapsedDays = (startDate && totalDays > 0)
      ? Math.min(totalDays, Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000))
      : 0
    const expectedProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0

    return {
      total,
      completed,
      inProgress,
      blocked,
      completionRate,
      velocity,
      remainingDays,
      onTrack: remainingDays > 0 ? completionRate >= expectedProgress * 0.8 : completionRate >= 100,
    }
  }, [tasks, endDate])

  // Courbe de complétion cumulée par jour
  const burndownData = useMemo(() => {
    const completedWithDate = tasks.filter((t) => t.completed_at)
    if (completedWithDate.length === 0) return []

    // Détermine la plage de dates
    const allDates = completedWithDate.map((t) => new Date(t.completed_at).getTime())
    const rangeStart = startDate ? new Date(startDate) : new Date(Math.min(...allDates))
    const rangeEnd = endDate ? new Date(endDate) : new Date()

    // Génère un point par jour
    const days: { date: string; completed: number; ideal: number }[] = []
    const totalTasks = tasks.length
    const dayCursor = new Date(rangeStart)
    dayCursor.setHours(0, 0, 0, 0)
    const end = new Date(rangeEnd)
    end.setHours(23, 59, 59, 999)
    const totalDays = Math.max(1, Math.ceil((end.getTime() - dayCursor.getTime()) / 86400000))

    let cumulative = 0
    let dayIndex = 0
    while (dayCursor <= end) {
      const dayEnd = new Date(dayCursor)
      dayEnd.setHours(23, 59, 59, 999)
      const completedThisDay = completedWithDate.filter((t) => {
        const d = new Date(t.completed_at)
        return d >= dayCursor && d <= dayEnd
      }).length
      cumulative += completedThisDay
      days.push({
        date: dayCursor.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        completed: cumulative,
        ideal: Math.round((dayIndex / (totalDays - 1)) * totalTasks),
      })
      dayCursor.setDate(dayCursor.getDate() + 1)
      dayIndex++
    }
    return days
  }, [tasks, startDate, endDate])

  if (compact) {
    return <CompactBurndown stats={stats} />
  }

  return <FullBurndown stats={stats} tasks={tasks} burndownData={burndownData} />
}

function CompactBurndown({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
        <p className="text-xs text-green-700 font-medium">Complétées</p>
        <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
        <p className="text-xs text-green-600">{stats.completionRate.toFixed(0)}%</p>
      </div>

      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
        <p className="text-xs text-blue-700 font-medium">En cours</p>
        <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
        <p className="text-xs text-blue-600">{stats.velocity} tâches</p>
      </div>

      {stats.blocked > 0 && (
        <div className="bg-red-50 rounded-lg p-3 border border-red-200 col-span-2">
          <p className="text-xs text-red-700 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Bloquées
          </p>
          <p className="text-lg font-bold text-red-900">{stats.blocked}</p>
        </div>
      )}
    </div>
  )
}

function FullBurndown({ stats, tasks, burndownData }: { stats: any; tasks: any[]; burndownData: { date: string; completed: number; ideal: number }[] }) {
  const chartHeight = 200
  const maxTasks = stats.total || 1

  // Simplified burn down: tasks by status
  const statusData = [
    { label: 'À faire', count: tasks.filter((t) => t.status === 'todo').length, color: 'bg-gray-400' },
    { label: 'En cours', count: tasks.filter((t) => t.status === 'in-progress').length, color: 'bg-blue-400' },
    { label: 'En révision', count: tasks.filter((t) => t.status === 'review').length, color: 'bg-purple-400' },
    { label: 'Complétées', count: tasks.filter((t) => t.status === 'done').length, color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-4 space-y-1">
          <p className="text-xs text-gray-600 font-medium">Tâches totales</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
          <p className="text-xs text-green-700 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Complétées
          </p>
          <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
          <p className="text-xs text-green-600">{stats.completionRate.toFixed(1)}%</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
          <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> En cours
          </p>
          <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
        </div>

        <div className={`border rounded-lg p-4 space-y-1 ${stats.blocked > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium flex items-center gap-1 ${stats.blocked > 0 ? 'text-red-700' : 'text-gray-700'}`}>
            <AlertCircle className="w-3 h-3" /> Bloquées
          </p>
          <p className={`text-2xl font-bold ${stats.blocked > 0 ? 'text-red-900' : 'text-gray-900'}`}>{stats.blocked}</p>
        </div>
      </div>

      {/* Real Burndown Chart */}
      {burndownData.length > 1 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" /> Complétion cumulée dans le temps
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={burndownData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === 'completed' ? 'Tâches complétées' : 'Idéal',
                ]}
              />
              <ReferenceLine y={stats.total} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Total', fontSize: 11, fill: '#94a3b8' }} />
              <Area type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 4" fill="none" dot={false} name="ideal" />
              <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="url(#colorCompleted)" strokeWidth={2} dot={false} name="completed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Burn Down Chart */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-blue-600" /> État d'avancement
        </h3>

        <div className="flex gap-4">
          {/* Stacked bar chart */}
          <div className="flex-1 flex items-end gap-1 h-48 bg-gray-50 rounded p-4">
            {statusData.map((item) => (
              <div key={item.label} className="flex-1 flex flex-col items-center group">
                <div
                  className={`w-full ${item.color} rounded transition relative`}
                  style={{ height: `${(item.count / maxTasks) * (chartHeight - 20)}px` }}
                  title={`${item.label}: ${item.count}`}
                >
                  <div className="hidden group-hover:block absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {item.count}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Legend and stats */}
          <div className="space-y-2">
            {statusData.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded ${item.color}`}></div>
                <span className="text-gray-700">
                  {item.label}: <strong>{item.count}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health indicator */}
      <div
        className={`rounded-lg p-4 text-sm ${stats.onTrack ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}
      >
        <p className={`font-semibold ${stats.onTrack ? 'text-green-900' : 'text-amber-900'}`}>
          {stats.onTrack ? '✅ Projet sur la bonne voie' : '⚠️ À surveiller'}
        </p>
        <p className={`text-xs mt-1 ${stats.onTrack ? 'text-green-700' : 'text-amber-700'}`}>
          {stats.completionRate.toFixed(0)}% complétées • {stats.remainingDays} jours restants
        </p>
      </div>
    </div>
  )
}

function calculateRemainingDays(endDate?: string): number {
  if (!endDate) return 999

  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24))

  return Math.max(0, diff)
}
