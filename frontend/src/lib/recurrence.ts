import { supabase } from './supabase'

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurrentTask {
  id: string
  template_task_id: string
  frequency: Frequency
  next_occurrence: string
  last_generated?: string
  end_date?: string
  created_at: string
  updated_at: string
}

// Get recurrence config for a task
export async function getRecurrenceConfig(templateTaskId: string): Promise<RecurrentTask | null> {
  try {
    const { data, error } = await supabase
      .from('recurrent_tasks')
      .select('*')
      .eq('template_task_id', templateTaskId)
      .single()

    if (error?.code === 'PGRST116') return null
    if (error) throw error

    return data
  } catch (error) {
    console.error('Error fetching recurrence config:', error)
    return null
  }
}

// Create or update recurrence
export async function setRecurrence(
  taskId: string,
  frequency: Frequency,
  startDate: string,
  endDate?: string
): Promise<RecurrentTask | null> {
  try {
    const nextOccurrence = addFrequency(new Date(startDate), frequency)

    const { data: existing } = await supabase
      .from('recurrent_tasks')
      .select('id')
      .eq('template_task_id', taskId)
      .maybeSingle()

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('recurrent_tasks')
        .update({
          frequency,
          next_occurrence: nextOccurrence.toISOString().split('T')[0],
          end_date: endDate,
        })
        .eq('template_task_id', taskId)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // Create
      const { data, error } = await supabase
        .from('recurrent_tasks')
        .insert([
          {
            template_task_id: taskId,
            frequency,
            next_occurrence: nextOccurrence.toISOString().split('T')[0],
            end_date: endDate,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    }
  } catch (error) {
    console.error('Error setting recurrence:', error)
    return null
  }
}

// Remove recurrence from task
export async function removeRecurrence(recurrenceId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('recurrent_tasks').delete().eq('id', recurrenceId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error removing recurrence:', error)
    return false
  }
}

// Generate next occurrence of recurrent task
export async function generateNextOccurrence(recurrenceId: string): Promise<string | null> {
  try {
    const { data: recurrence, error: fetchError } = await supabase
      .from('recurrent_tasks')
      .select('*')
      .eq('id', recurrenceId)
      .single()

    if (fetchError) throw fetchError

    const nextDate = addFrequency(new Date(recurrence.next_occurrence), recurrence.frequency)

    // Check if we should stop generating
    if (recurrence.end_date && nextDate > new Date(recurrence.end_date)) {
      return null
    }

    // Create new task instance from the template
    const { data: templateTask } = await supabase
      .from('tasks')
      .select('project_id, title, description, priority, assignee_ids, created_by')
      .eq('id', recurrence.template_task_id)
      .maybeSingle()

    if (templateTask) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('tasks').insert({
        project_id: templateTask.project_id,
        title: templateTask.title,
        description: templateTask.description,
        status: 'todo',
        priority: templateTask.priority,
        assignee_ids: templateTask.assignee_ids ?? [],
        created_by: user?.id ?? templateTask.created_by,
        due_date: nextDate.toISOString().split('T')[0],
        start_date: nextDate.toISOString().split('T')[0],
        end_date: nextDate.toISOString().split('T')[0],
      })
    }

    // Update next occurrence
    const { error: updateError } = await supabase
      .from('recurrent_tasks')
      .update({
        next_occurrence: nextDate.toISOString().split('T')[0],
        last_generated: new Date().toISOString(),
      })
      .eq('id', recurrenceId)

    if (updateError) throw updateError

    return nextDate.toISOString().split('T')[0]
  } catch (error) {
    console.error('Error generating next occurrence:', error)
    return null
  }
}

// Get all tasks needing recurrence generation (for cron job)
export async function getTasksNeedingGeneration(): Promise<RecurrentTask[]> {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('recurrent_tasks')
      .select('*')
      .lte('next_occurrence', today)
      .or(`end_date.is.null,end_date.gte.${today}`)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching tasks needing generation:', error)
    return []
  }
}

// Helper: Add frequency to a date
function addFrequency(date: Date, frequency: Frequency): Date {
  const newDate = new Date(date)

  switch (frequency) {
    case 'daily':
      newDate.setDate(newDate.getDate() + 1)
      break
    case 'weekly':
      newDate.setDate(newDate.getDate() + 7)
      break
    case 'biweekly':
      newDate.setDate(newDate.getDate() + 14)
      break
    case 'monthly':
      newDate.setMonth(newDate.getMonth() + 1)
      break
    case 'quarterly':
      newDate.setMonth(newDate.getMonth() + 3)
      break
    case 'yearly':
      newDate.setFullYear(newDate.getFullYear() + 1)
      break
  }

  return newDate
}

// Get frequency label (fr)
export function getFrequencyLabel(frequency: Frequency): string {
  const labels: Record<Frequency, string> = {
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    biweekly: 'Bi-hebdomadaire',
    monthly: 'Mensuel',
    quarterly: 'Trimestriel',
    yearly: 'Annuel',
  }
  return labels[frequency] || frequency
}

// Calculate next 5 occurrences (for preview)
export function getNextOccurrences(startDate: string, frequency: Frequency, count: number = 5): string[] {
  const occurrences: string[] = []
  let currentDate = new Date(startDate)

  for (let i = 0; i < count; i++) {
    currentDate = addFrequency(currentDate, frequency)
    occurrences.push(currentDate.toISOString().split('T')[0])
  }

  return occurrences
}

// Clone task as recurrent instance
export async function cloneTaskAsRecurrence(
  templateTaskId: string,
  dueDate: string,
  projectId: string
): Promise<string | null> {
  try {
    // Fetch template task
    const { data: template, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', templateTaskId)
      .single()

    if (fetchError) throw fetchError

    // Create new task with suffix
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert([
        {
          project_id: template.project_id || projectId,
          title: `${template.title} - ${new Date(dueDate).toLocaleDateString('fr-FR')}`,
          description: template.description,
          status: 'todo',
          priority: template.priority,
          assigned_to: template.assigned_to,
          due_date: dueDate,
          start_date: dueDate,
          created_by: user.id,
        },
      ])
      .select()
      .single()

    if (insertError) throw insertError

    return newTask.id
  } catch (error) {
    console.error('Error cloning recurrent task:', error)
    return null
  }
}
