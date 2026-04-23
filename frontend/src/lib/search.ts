import { supabase } from './supabase'

export interface SavedFilter {
  id: string
  user_id: string
  name: string
  criteria: FilterCriteria
  created_at: string
}

export interface FilterCriteria {
  status?: string[]
  priority?: string[]
  assignedTo?: string[]
  projectId?: string
  dateRange?: { start: string; end: string }
  searchText?: string
  tags?: string[]
}

function escapeIlike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,')
    .replace(/[()]/g, '')
    .trim()
}

// Save filter
export async function saveFilter(name: string, criteria: FilterCriteria): Promise<SavedFilter | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const { data, error } = await supabase
      .from('saved_filters')
      .insert([
        {
          user_id: user.id,
          name,
          criteria,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error saving filter:', error)
    return null
  }
}

// Get user filters
export async function getUserFilters(): Promise<SavedFilter[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('saved_filters')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching filters:', error)
    return []
  }
}

// Delete filter
export async function deleteFilter(filterId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('saved_filters').delete().eq('id', filterId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting filter:', error)
    return false
  }
}

// Apply filter to tasks
export function applyFilter(tasks: any[], criteria: FilterCriteria): any[] {
  return tasks.filter((task) => {
    if (criteria.status && !criteria.status.includes(task.status)) return false
    if (criteria.priority && !criteria.priority.includes(task.priority)) return false
    if (criteria.assignedTo && !criteria.assignedTo.some(id => (task.assignee_ids ?? []).includes(id))) return false

    if (criteria.dateRange) {
      const taskDate = task.due_date || task.end_date
      if (!taskDate) return false
      if (taskDate < criteria.dateRange.start || taskDate > criteria.dateRange.end) return false
    }

    if (criteria.searchText) {
      const search = criteria.searchText.toLowerCase()
      if (!task.title.toLowerCase().includes(search) && !task.description?.toLowerCase().includes(search)) {
        return false
      }
    }

    return true
  })
}

// Full-text search
export async function searchTasks(query: string, projectId?: string): Promise<any[]> {
  try {
    const safeQuery = escapeIlike(query)
    if (!safeQuery) return []
    let sqlQuery = supabase
      .from('tasks')
      .select('*')
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)

    if (projectId) {
      sqlQuery = sqlQuery.eq('project_id', projectId)
    }

    const { data, error } = await sqlQuery.limit(50)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching tasks:', error)
    return []
  }
}

// Search documents
export async function searchDocuments(query: string, projectId?: string): Promise<any[]> {
  try {
    const safeQuery = escapeIlike(query)
    if (!safeQuery) return []
    let sqlQuery = supabase
      .from('documents')
      .select('*')
      .or(`name.ilike.%${safeQuery}%`)

    if (projectId) {
      sqlQuery = sqlQuery.eq('project_id', projectId)
    }

    const { data, error } = await sqlQuery.limit(50)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching documents:', error)
    return []
  }
}

// Global search (tasks + docs + projects)
export async function globalSearch(query: string): Promise<{ tasks: any[]; documents: any[]; projects: any[] }> {
  try {
    const safeQuery = escapeIlike(query)
    if (!safeQuery) return { tasks: [], documents: [], projects: [] }
    const [tasks, documents, projects] = await Promise.all([
      searchTasks(safeQuery),
      searchDocuments(safeQuery),
      supabase
        .from('projects')
        .select('*')
        .or(`name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
        .limit(20)
        .then((res) => res.data || []),
    ])

    return { tasks, documents, projects }
  } catch (error) {
    console.error('Error in global search:', error)
    return { tasks: [], documents: [], projects: [] }
  }
}
