import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Zoom = 'day' | 'week' | 'month'

export interface GanttTask {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  due_date?: string | null
  status: string
  priority: string
  phase_id?: string | null
  parent_id?: string | null
}

export interface GanttPhase {
  id: string
  name: string
}

interface GanttChartProps {
  tasks: GanttTask[]
  phases?: GanttPhase[]
  onTaskClick?: (taskId: string) => void
  onTaskUpdate?: (taskId: string, startDate: string, endDate: string) => Promise<void>
  /** @deprecated kept for API compatibility */
  showDependencies?: boolean
  /** @deprecated kept for API compatibility */
  compact?: boolean
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const ROW_H = 40          // px - height of each row
const HEADER_H = 52       // px - total header height (2 rows)
const LEFT_W = 224        // px - fixed left panel width
const RESIZE_W = 8        // px - right-edge resize handle
const MAX_VISIBLE_H = 580 // px - max scrollable height

const COL_W: Record<Zoom, number> = { day: 40, week: 20, month: 9 }

// ─── Status / priority config ─────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  'todo': 'bg-slate-400',
  'in-progress': 'bg-amber-400',
  'review': 'bg-blue-400',
  'done': 'bg-emerald-500',
}

const STATUS_LABEL: Record<string, string> = {
  'todo': 'À faire',
  'in-progress': 'En cours',
  'review': 'En revue',
  'done': 'Terminé',
}

const STATUS_PROGRESS: Record<string, number> = {
  'todo': 0, 'in-progress': 50, 'review': 75, 'done': 100,
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}
function todayISO(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); return toISO(d)
}

// ─── Main component ───────────────────────────────────────────────────────────

export const GanttChart = memo(function GanttChart({
  tasks,
  phases = [],
  onTaskClick,
  onTaskUpdate,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<Zoom>('week')
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())

  // dragging state
  const dragging = useRef<{
    taskId: string
    type: 'move' | 'resize'
    startX: number
    origStart: string
    origEnd: string
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ taskId: string; start: string; end: string } | null>(null)

  const timelineRef = useRef<HTMLDivElement>(null)
  const leftBodyRef = useRef<HTMLDivElement>(null)

  const colW = COL_W[zoom]

  // ─── Timeline bounds ────────────────────────────────────────────────────────

  const { timelineStart, totalDays } = useMemo(() => {
    const valid = tasks.filter(t => t.start_date && (t.end_date ?? t.due_date))
    if (valid.length === 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      return { timelineStart: addDays(today, -7), totalDays: 90 }
    }
    let min = new Date(valid[0].start_date!)
    let max = new Date(valid[0].end_date ?? valid[0].due_date!)
    for (const t of valid) {
      const s = new Date(t.start_date!); const e = new Date(t.end_date ?? t.due_date ?? t.start_date!)
      if (s < min) min = s
      if (e > max) max = e
    }
    const start = addDays(min, -7)
    const end = addDays(max, 14)
    return { timelineStart: start, totalDays: Math.max(daysBetween(start, end) + 1, 90) }
  }, [tasks])

  const totalWidth = totalDays * colW

  // ─── Header data (groups + ticks) ───────────────────────────────────────────

  const { headerGroups, headerTicks } = useMemo(() => {
    type Span = { label: string; startDay: number; spanDays: number; highlight?: boolean }
    const groups: Span[] = []
    const ticks: Span[] = []
    const todayDay = daysBetween(timelineStart, new Date(todayISO()))

    if (zoom === 'day') {
      let i = 0
      while (i < totalDays) {
        const d = addDays(timelineStart, i)
        const yr = d.getFullYear(); const mo = d.getMonth()
        let span = 0
        while (i + span < totalDays) {
          const dd = addDays(timelineStart, i + span)
          if (dd.getFullYear() !== yr || dd.getMonth() !== mo) break
          span++
        }
        groups.push({ label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), startDay: i, spanDays: span })
        i += span
      }
      for (let j = 0; j < totalDays; j++) {
        const d = addDays(timelineStart, j)
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        ticks.push({ label: String(d.getDate()), startDay: j, spanDays: 1, highlight: isWeekend || j === todayDay })
      }
    } else if (zoom === 'week') {
      let i = 0
      while (i < totalDays) {
        const d = addDays(timelineStart, i)
        const yr = d.getFullYear(); const mo = d.getMonth()
        let span = 0
        while (i + span < totalDays) {
          const dd = addDays(timelineStart, i + span)
          if (dd.getFullYear() !== yr || dd.getMonth() !== mo) break
          span++
        }
        groups.push({ label: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }), startDay: i, spanDays: span })
        i += span
      }
      // One tick per week starting on Monday
      for (let j = 0; j < totalDays; j++) {
        const d = addDays(timelineStart, j)
        if (d.getDay() === 1 || j === 0) {
          const span = Math.min(7, totalDays - j)
          const inRange = todayDay >= j && todayDay < j + span
          ticks.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, startDay: j, spanDays: span, highlight: inRange })
        }
      }
    } else {
      // month zoom
      let i = 0
      while (i < totalDays) {
        const d = addDays(timelineStart, i)
        const yr = d.getFullYear()
        let span = 0
        while (i + span < totalDays) {
          if (addDays(timelineStart, i + span).getFullYear() !== yr) break
          span++
        }
        groups.push({ label: String(yr), startDay: i, spanDays: span })
        i += span
      }
      let j = 0
      while (j < totalDays) {
        const d = addDays(timelineStart, j)
        const yr = d.getFullYear(); const mo = d.getMonth()
        let span = 0
        while (j + span < totalDays) {
          const dd = addDays(timelineStart, j + span)
          if (dd.getFullYear() !== yr || dd.getMonth() !== mo) break
          span++
        }
        const inRange = todayDay >= j && todayDay < j + span
        ticks.push({ label: d.toLocaleDateString('fr-FR', { month: 'short' }), startDay: j, spanDays: span, highlight: inRange })
        j += span
      }
    }
    return { headerGroups: groups, headerTicks: ticks }
  }, [zoom, totalDays, timelineStart])

  // ─── Row data ────────────────────────────────────────────────────────────────

  type PhaseRow = { type: 'phase'; phase: GanttPhase; taskCount: number }
  type TaskRow  = { type: 'task'; task: GanttTask }
  type Row = PhaseRow | TaskRow

  const rows = useMemo((): Row[] => {
    const result: Row[] = []
    const rootTasks = tasks.filter(t => !t.parent_id)

    for (const phase of phases) {
      const pts = rootTasks.filter(t => t.phase_id === phase.id)
      if (pts.length === 0) continue
      result.push({ type: 'phase', phase, taskCount: pts.length })
      if (!collapsedPhases.has(phase.id)) {
        pts.forEach(t => result.push({ type: 'task', task: t }))
      }
    }

    const unphasedTasks = rootTasks.filter(t => !t.phase_id || !phases.find(p => p.id === t.phase_id))
    if (unphasedTasks.length > 0) {
      const dummyPhase: GanttPhase = { id: '__none__', name: 'Non classé' }
      result.push({ type: 'phase', phase: dummyPhase, taskCount: unphasedTasks.length })
      if (!collapsedPhases.has('__none__')) {
        unphasedTasks.forEach(t => result.push({ type: 'task', task: t }))
      }
    }
    return result
  }, [tasks, phases, collapsedPhases])

  // ─── Drag helpers ────────────────────────────────────────────────────────────

  const computePreview = useCallback((taskId: string, type: 'move' | 'resize', dx: number) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task?.start_date || !(task.end_date ?? task.due_date)) return null
    const origStart = new Date(task.start_date)
    const origEnd = new Date(task.end_date ?? task.due_date!)
    const dDays = Math.round(dx / colW)
    if (type === 'move') {
      const newStart = addDays(origStart, dDays)
      const dur = daysBetween(origStart, origEnd)
      return { taskId, start: toISO(newStart), end: toISO(addDays(newStart, dur)) }
    } else {
      const newEnd = addDays(origEnd, dDays)
      if (newEnd < origStart) return null
      return { taskId, start: toISO(origStart), end: toISO(newEnd) }
    }
  }, [tasks, colW])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const preview = computePreview(dragging.current.taskId, dragging.current.type, dx)
    setDragPreview(preview)
  }, [computePreview])

  const handleMouseUp = useCallback(async () => {
    if (!dragging.current) return
    const snap = dragPreview
    dragging.current = null
    setDragPreview(null)
    if (snap && onTaskUpdate) {
      await onTaskUpdate(snap.taskId, snap.start, snap.end)
    }
  }, [dragPreview, onTaskUpdate])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Sync vertical scroll between left panel and timeline
  const onTimelineScroll = () => {
    if (leftBodyRef.current && timelineRef.current) {
      leftBodyRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }

  // ─── Position helpers ────────────────────────────────────────────────────────

  function barLeft(startISO: string): number {
    return Math.max(0, daysBetween(timelineStart, new Date(startISO))) * colW
  }
  function barWidth(startISO: string, endISO: string): number {
    return Math.max(colW, (daysBetween(new Date(startISO), new Date(endISO)) + 1) * colW)
  }

  const todayLeft = useMemo(
    () => daysBetween(timelineStart, new Date(todayISO())) * colW,
    [timelineStart, colW]
  )

  // ─── Empty state ─────────────────────────────────────────────────────────────

  const hasDatedTasks = tasks.some(t => t.start_date && (t.end_date ?? t.due_date))
  if (!hasDatedTasks) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center">
        <CalendarDays className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Aucune tâche avec des dates</p>
        <p className="mt-1 text-xs text-slate-400">Ajoutez des dates de début et de fin aux tâches pour les afficher ici.</p>
      </div>
    )
  }

  const bodyHeight = Math.min(rows.length * ROW_H, MAX_VISIBLE_H)

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 select-none" style={{ userSelect: dragging.current ? 'none' : undefined }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 mr-1">Zoom</span>
        {(['day', 'week', 'month'] as Zoom[]).map(z => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              zoom === z ? 'bg-slate-950 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {{ day: 'Jour', week: 'Semaine', month: 'Mois' }[z]}
          </button>
        ))}
        <span className="ml-auto hidden sm:block text-[11px] text-slate-400 italic">
          Glissez une barre pour déplacer · bord droit pour redimensionner
        </span>
      </div>

      {/* ── Grid ── */}
      <div className="flex overflow-hidden rounded-2xl border border-slate-200 shadow-sm">

        {/* Fixed left panel */}
        <div className="flex-shrink-0 flex flex-col border-r border-slate-200" style={{ width: LEFT_W }}>
          {/* Left header ghost */}
          <div className="flex-shrink-0 border-b border-slate-200 bg-slate-100 flex items-end px-3 pb-1.5" style={{ height: HEADER_H }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tâches</span>
          </div>
          {/* Left rows */}
          <div ref={leftBodyRef} className="overflow-hidden" style={{ height: bodyHeight }}>
            {rows.map((row, i) => {
              if (row.type === 'phase') {
                const collapsed = collapsedPhases.has(row.phase.id)
                return (
                  <div
                    key={`lph-${row.phase.id}-${i}`}
                    style={{ height: ROW_H }}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-200 bg-indigo-50 px-3 hover:bg-indigo-100 transition"
                    onClick={() => setCollapsedPhases(prev => {
                      const next = new Set(prev)
                      if (next.has(row.phase.id)) next.delete(row.phase.id)
                      else next.add(row.phase.id)
                      return next
                    })}
                  >
                    {collapsed
                      ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                      : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />}
                    <span className="flex-1 truncate text-xs font-semibold text-indigo-700">{row.phase.name}</span>
                    <span className="flex-shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                      {row.taskCount}
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={`lt-${row.task.id}`}
                  style={{ height: ROW_H }}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-100 bg-white px-3 hover:bg-slate-50 transition"
                  onClick={() => onTaskClick?.(row.task.id)}
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_BG[row.task.status] ?? 'bg-slate-300'}`} />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-800" title={row.task.title}>
                    {row.task.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Scrollable timeline */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          style={{ height: bodyHeight + HEADER_H }}
          onScroll={onTimelineScroll}
        >
          <div style={{ width: totalWidth, minWidth: totalWidth }}>

            {/* Date header */}
            <div className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200" style={{ height: HEADER_H }}>
              {/* Groups (months / years) */}
              <div className="relative" style={{ height: 24 }}>
                {headerGroups.map((g, i) => (
                  <div
                    key={i}
                    className="absolute flex items-center overflow-hidden border-r border-slate-200 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                    style={{ left: g.startDay * colW, width: g.spanDays * colW, height: 24 }}
                  >
                    <span className="truncate">{g.label}</span>
                  </div>
                ))}
              </div>
              {/* Ticks (days / weeks / months) */}
              <div className="relative" style={{ height: 28 }}>
                {headerTicks.map((t, i) => (
                  <div
                    key={i}
                    className={`absolute flex items-center justify-center overflow-hidden border-r border-slate-100 text-[10px] ${
                      t.highlight ? 'font-bold text-indigo-600' : 'text-slate-600'
                    }`}
                    style={{ left: t.startDay * colW, width: t.spanDays * colW, height: 28 }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline body */}
            <div className="relative" style={{ height: bodyHeight }}>

              {/* Weekend column shading (day zoom only) */}
              {zoom === 'day' && Array.from({ length: totalDays }, (_, i) => {
                const d = addDays(timelineStart, i)
                if (d.getDay() !== 0 && d.getDay() !== 6) return null
                return (
                  <div
                    key={`wk-${i}`}
                    className="pointer-events-none absolute inset-y-0 bg-slate-50/70"
                    style={{ left: i * colW, width: colW }}
                  />
                )
              })}

              {/* Today line */}
              {todayLeft >= 0 && todayLeft <= totalWidth && (
                <div
                  className="pointer-events-none absolute z-10 border-l-2 border-indigo-500"
                  style={{ left: todayLeft, top: 0, height: bodyHeight }}
                />
              )}

              {/* Rows */}
              {rows.map((row, rowIdx) => {
                const top = rowIdx * ROW_H

                if (row.type === 'phase') {
                  return (
                    <div
                      key={`tph-${row.phase.id}-${rowIdx}`}
                      className="absolute inset-x-0 border-b border-slate-200 bg-indigo-50/60"
                      style={{ top, height: ROW_H }}
                    />
                  )
                }

                const { task } = row
                const preview = dragPreview?.taskId === task.id ? dragPreview : null
                const displayStart = preview?.start ?? task.start_date
                const displayEnd = preview?.end ?? task.end_date ?? task.due_date
                const isDragging = !!preview

                return (
                  <div
                    key={`tr-${task.id}`}
                    className="absolute inset-x-0 border-b border-slate-100"
                    style={{ top, height: ROW_H }}
                  >
                    {displayStart && displayEnd && (() => {
                      const left = barLeft(displayStart)
                      const width = barWidth(displayStart, displayEnd)
                      const progress = STATUS_PROGRESS[task.status] ?? 0
                      const bg = STATUS_BG[task.status] ?? 'bg-slate-400'
                      return (
                        <div
                          className={`absolute flex items-center rounded-xl text-white shadow-sm ring-1 ring-white/20 transition-shadow ${bg} ${
                            isDragging ? 'shadow-xl ring-2 ring-white/40 cursor-grabbing' : 'hover:shadow-md cursor-grab'
                          }`}
                          style={{ left, width, top: 6, height: ROW_H - 12 }}
                          onMouseDown={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            const fromRight = rect.right - e.clientX
                            dragging.current = {
                              taskId: task.id,
                              type: fromRight <= RESIZE_W ? 'resize' : 'move',
                              startX: e.clientX,
                              origStart: task.start_date!,
                              origEnd: task.end_date ?? task.due_date!,
                            }
                          }}
                          onClick={e => {
                            if (!dragPreview) { e.stopPropagation(); onTaskClick?.(task.id) }
                          }}
                        >
                          {/* Progress fill */}
                          {progress > 0 && (
                            <div
                              className="pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-black/15"
                              style={{ width: `${progress}%` }}
                            />
                          )}
                          {/* Resize handle indicator */}
                          <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-xl bg-black/0 hover:bg-black/20 transition" />
                          {/* Label */}
                          <span className="relative z-10 truncate px-2 text-[10px] font-semibold">
                            {width > 64 ? task.title : ''}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BG[status]}`} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-0.5 rounded bg-indigo-500" />
          <span>Aujourd'hui</span>
        </div>
        <span className="ml-auto text-[11px] italic text-slate-400">
          Glissez pour déplacer · bord droit pour redimensionner
        </span>
      </div>
    </div>
  )
})
