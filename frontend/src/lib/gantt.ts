// Gantt chart data structures and helpers
export interface GanttTask {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  status: string
  priority: string
  progress: number // 0-100 based on status
  assigned_to?: string
  assignee_name?: string
  dependencies: string[] // task IDs this depends on
  project_id?: string
}

export interface GanttDay {
  date: string
  dayOfWeek: string
  isWeekend: boolean
}

export interface GanttPosition {
  left: number // percentage
  width: number // percentage
  isMultiDay: boolean
}

// Convert task to gantt format
export function formatGanttTask(task: any): GanttTask {
  const progress = getTaskProgress(task)
  const dependencies = extractDependencies(task)

  return {
    id: task.id,
    title: task.title,
    start_date: task.start_date,
    end_date: task.end_date || task.due_date,
    status: task.status,
    priority: task.priority,
    progress,
    assigned_to: task.assigned_to,
    dependencies,
  }
}

// Get task progress percentage based on status
function getTaskProgress(task: any): number {
  const statusProgress: Record<string, number> = {
    todo: 0,
    'in-progress': 50,
    review: 75,
    done: 100,
  }
  return statusProgress[task.status] || 0
}

// Extract dependency IDs (simplified - assumes parent_id = dependency)
function extractDependencies(task: any): string[] {
  const dependencies: string[] = []
  if (task.parent_id) {
    dependencies.push(task.parent_id)
  }
  return dependencies
}

// Calculate gantt position in timeline
export function calculateGanttPosition(
  task: GanttTask,
  startDate: Date,
  endDate: Date
): GanttPosition {
  if (!task.start_date || !task.end_date) {
    return { left: 0, width: 0, isMultiDay: false }
  }

  const taskStart = new Date(task.start_date)
  const taskEnd = new Date(task.end_date)
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))

  const taskStartDaysFromStart = Math.ceil(
    (taskStart.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
  )
  const taskDuration = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 3600 * 24)) + 1

  const left = (Math.max(0, taskStartDaysFromStart) / totalDays) * 100
  const width = (taskDuration / totalDays) * 100
  const isMultiDay = taskDuration > 1

  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(1, Math.min(100 - left, width)),
    isMultiDay,
  }
}

// Generate day labels for gantt timeline
export function generateGanttDays(startDate: Date, endDate: Date): GanttDay[] {
  const days: GanttDay[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    const dayOfWeek = current.toLocaleDateString('fr-FR', { weekday: 'short' })
    const isWeekend = current.getDay() === 0 || current.getDay() === 6

    days.push({
      date: current.toISOString().split('T')[0],
      dayOfWeek,
      isWeekend,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
}

// Get color for priority
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-200',
    medium: 'bg-yellow-200',
    high: 'bg-orange-200',
    urgent: 'bg-red-200',
  }
  return colors[priority] || 'bg-gray-200'
}

// Get color for status
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    todo: 'bg-gray-100',
    'in-progress': 'bg-blue-100',
    review: 'bg-purple-100',
    done: 'bg-green-100',
  }
  return colors[status] || 'bg-gray-100'
}

// Calculate timeline bounds from tasks
export function getTimelineBounds(tasks: GanttTask[]): { start: Date; end: Date } {
  let minDate = new Date()
  let maxDate = new Date()

  tasks.forEach((task) => {
    if (task.start_date) {
      const start = new Date(task.start_date)
      if (start < minDate) minDate = start
    }
    if (task.end_date) {
      const end = new Date(task.end_date)
      if (end > maxDate) maxDate = end
    }
  })

  // Add 1 week padding
  minDate.setDate(minDate.getDate() - 7)
  maxDate.setDate(maxDate.getDate() + 7)

  return { start: minDate, end: maxDate }
}

// Check for timeline conflicts (overlapping tasks)
export function checkTimelineConflicts(tasks: GanttTask[]): Map<string, string[]> {
  const conflicts = new Map<string, string[]>()

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const task1 = tasks[i]
      const task2 = tasks[j]

      if (tasksOverlap(task1, task2)) {
        if (!conflicts.has(task1.id)) conflicts.set(task1.id, [])
        if (!conflicts.has(task2.id)) conflicts.set(task2.id, [])

        conflicts.get(task1.id)?.push(task2.id)
        conflicts.get(task2.id)?.push(task1.id)
      }
    }
  }

  return conflicts
}

function tasksOverlap(task1: GanttTask, task2: GanttTask): boolean {
  if (!task1.start_date || !task1.end_date || !task2.start_date || !task2.end_date) {
    return false
  }

  const task1Start = new Date(task1.start_date)
  const task1End = new Date(task1.end_date)
  const task2Start = new Date(task2.start_date)
  const task2End = new Date(task2.end_date)

  return task1Start <= task2End && task2Start <= task1End
}
