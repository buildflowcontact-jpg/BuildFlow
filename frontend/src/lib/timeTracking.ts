import { supabase } from './supabase'

export interface TaskEstimation {
  id: string
  task_id: string
  estimated_hours: number
  actual_hours: number
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  task_id: string
  user_id: string
  hours: number
  date: string
  notes: string
  created_at: string
  updated_at: string
}

function validateTimeEntryInput(hours: number, date: string): void {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    throw new Error('Le nombre d\'heures doit être compris entre 0 et 24')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Le format de date doit être YYYY-MM-DD')
  }
}

// Get estimation for a task
export async function getTaskEstimation(taskId: string): Promise<TaskEstimation | null> {
  try {
    const { data, error } = await supabase
      .from('task_estimations')
      .select('*')
      .eq('task_id', taskId)
      .single()

    if (error?.code === 'PGRST116') return null
    if (error) throw error

    return data
  } catch (error) {
    console.error('Error fetching estimation:', error)
    return null
  }
}

// Create or update task estimation
export async function setTaskEstimation(taskId: string, estimatedHours: number): Promise<TaskEstimation | null> {
  try {
    const { data: existing } = await supabase
      .from('task_estimations')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('task_estimations')
        .update({ estimated_hours: estimatedHours })
        .eq('task_id', taskId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // Create new
      const { data, error } = await supabase
        .from('task_estimations')
        .insert([
          {
            task_id: taskId,
            estimated_hours: estimatedHours,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    }
  } catch (error) {
    console.error('Error setting estimation:', error)
    return null
  }
}

// Get time entries for a task
export async function getTimeEntries(taskId: string, userId?: string): Promise<TimeEntry[]> {
  try {
    let query = supabase.from('time_entries').select('*').eq('task_id', taskId)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching time entries:', error)
    return []
  }
}

// Log time for a task
export async function logTime(
  taskId: string,
  hours: number,
  date: string,
  notes: string = ''
): Promise<TimeEntry | null> {
  try {
    validateTimeEntryInput(hours, date)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { data, error } = await supabase
      .from('time_entries')
      .insert([
        {
          task_id: taskId,
          user_id: user.id,
          hours,
          date,
          notes,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error logging time:', error)
    return null
  }
}

// Update a time entry
export async function updateTimeEntry(entryId: string, hours: number, notes: string = ''): Promise<boolean> {
  try {
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      throw new Error('Le nombre d\'heures doit être compris entre 0 et 24')
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { error } = await supabase
      .from('time_entries')
      .update({ hours, notes })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating time entry:', error)
    return false
  }
}

// Delete a time entry
export async function deleteTimeEntry(entryId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { error } = await supabase.from('time_entries').delete().eq('id', entryId).eq('user_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return false
  }
}

// Get total time logged for a task
export async function getTotalTimeLogged(taskId: string): Promise<number> {
  try {
    const entries = await getTimeEntries(taskId)
    return entries.reduce((total, entry) => total + entry.hours, 0)
  } catch (error) {
    console.error('Error calculating total time:', error)
    return 0
  }
}

// Get time logged by user for a date range
export async function getUserTimeLog(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TimeEntry[]> {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user time log:', error)
    return []
  }
}

// Get productivity stats for user (time logged per week/month)
export async function getUserProductivityStats(userId: string, months: number = 3): Promise<any[]> {
  try {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)

    const entries = await getUserTimeLog(userId, startDate.toISOString().split('T')[0], now.toISOString().split('T')[0])

    // Group by week
    const stats: Record<string, number> = {}
    entries.forEach((entry) => {
      const date = new Date(entry.date)
      const week = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`
      stats[week] = (stats[week] || 0) + entry.hours
    })

    return Object.entries(stats).map(([week, hours]) => ({ week, hours }))
  } catch (error) {
    console.error('Error calculating productivity stats:', error)
    return []
  }
}
