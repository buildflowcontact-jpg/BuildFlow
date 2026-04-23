import { supabase } from './supabase'

export async function duplicateTask(taskId: string, asSubtask: boolean = false): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    // Fetch original task
    const { data: originalTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError) throw fetchError

    // Create duplicate
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert([
        {
          project_id: originalTask.project_id,
          parent_id: asSubtask ? taskId : originalTask.parent_id,
          title: `${originalTask.title} (copie)`,
          description: originalTask.description,
          status: 'todo',
          priority: originalTask.priority,
          assigned_to: null, // Don't auto-assign copy
          created_by: user.id,
          start_date: originalTask.start_date,
          end_date: originalTask.end_date,
          due_date: originalTask.due_date,
        },
      ])
      .select()
      .single()

    if (insertError) throw insertError

    // Copy subtasks if not creating subtask
    if (!asSubtask && originalTask.parent_id === null) {
      const { data: subtasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', taskId)

      if (subtasks && subtasks.length > 0) {
        const copiedSubtasks = subtasks.map((st: any) => ({
          ...st,
          id: undefined,
          parent_id: newTask.id,
          created_by: user.id,
          status: 'todo',
        }))

        await supabase.from('tasks').insert(copiedSubtasks)
      }
    }

    return newTask.id
  } catch (error) {
    console.error('Error duplicating task:', error)
    return null
  }
}

// Duplicate task multiple times
export async function duplicateTaskMultiple(
  taskId: string,
  count: number = 3,
  intervalDays: number = 1
): Promise<string[]> {
  const taskIds: string[] = []

  for (let i = 0; i < count; i++) {
    const newId = await duplicateTask(taskId)
    if (newId) {
      // Shift due date
      if (intervalDays > 0) {
        const { data: newTask } = await supabase
          .from('tasks')
          .select('due_date, start_date')
          .eq('id', newId)
          .single()

        if (newTask) {
          const newDueDate = newTask.due_date ? new Date(newTask.due_date) : null
          const newStartDate = newTask.start_date ? new Date(newTask.start_date) : null

          if (newDueDate) {
            newDueDate.setDate(newDueDate.getDate() + intervalDays * (i + 1))
          }
          if (newStartDate) {
            newStartDate.setDate(newStartDate.getDate() + intervalDays * (i + 1))
          }

          await supabase
            .from('tasks')
            .update({
              due_date: newDueDate?.toISOString().split('T')[0],
              start_date: newStartDate?.toISOString().split('T')[0],
            })
            .eq('id', newId)
        }
      }

      taskIds.push(newId)
    }
  }

  return taskIds
}
