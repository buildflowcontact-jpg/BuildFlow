import { supabase } from './supabase'

export interface ActivityLog {
  id: string
  user_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string
  changes: Record<string, any>
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  created_at: string
}

export interface ActivityLogFormatted extends ActivityLog {
  user_name?: string
  action_label?: string
  summary?: string
}

type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface GlobalActivityFilters {
  action?: ActivityAction
  tableName?: string
}

// Format human-readable action description
const formatAction = (action: string, tableName: string): string => {
  const tableLabel = tableName === 'tasks' ? 'Tâche' : 
                    tableName === 'projects' ? 'Projet' :
                    tableName === 'documents' ? 'Document' : tableName

  switch (action) {
    case 'CREATE':
      return `Créé${tableName === 'tasks' || tableName === 'projects' ? '' : ''} ${tableLabel.toLowerCase()}`
    case 'UPDATE':
      return `Modifié ${tableLabel.toLowerCase()}`
    case 'DELETE':
      return `Supprimé ${tableLabel.toLowerCase()}`
    default:
      return action
  }
}

// Get activity logs for a specific resource
export async function getActivityLogs(
  tableName: string,
  recordId: string,
  limit: number = 50
): Promise<ActivityLogFormatted[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        id, 
        user_id, 
        action, 
        table_name, 
        record_id, 
        changes, 
        old_values, 
        new_values, 
        created_at
      `)
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const logs = (data || []) as ActivityLog[]
    const userIds = Array.from(new Set(logs.map((log) => log.user_id).filter(Boolean)))

    const userNameById = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .in('id', userIds)

      for (const profile of profiles || []) {
        userNameById.set(profile.id, profile.name || profile.email || 'Système')
      }
    }

    return logs.map((log) => ({
      ...log,
      user_name: userNameById.get(log.user_id) || 'Système',
      action_label: formatAction(log.action, log.table_name),
      summary: generateSummary(log),
    }))
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return []
  }
}

// Get activity logs for user (dashboard, recent activity)
export async function getUserActivityLogs(userId: string, limit: number = 20): Promise<ActivityLogFormatted[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((log: ActivityLog) => ({
      ...log,
      action_label: formatAction(log.action, log.table_name),
      summary: generateSummary(log),
    }))
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return []
  }
}

export async function getGlobalActivityLogs(
  limit: number = 100,
  filters: GlobalActivityFilters = {}
): Promise<ActivityLogFormatted[]> {
  try {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.tableName && filters.tableName !== 'all') {
      query = query.eq('table_name', filters.tableName)
    }

    const { data, error } = await query
    if (error) throw error

    const logs = (data || []) as ActivityLog[]
    const userIds = Array.from(new Set(logs.map((log) => log.user_id).filter(Boolean)))

    const userNameById = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .in('id', userIds)

      for (const profile of profiles || []) {
        userNameById.set(profile.id, profile.name || profile.email || 'Système')
      }
    }

    return logs.map((log) => ({
      ...log,
      user_name: userNameById.get(log.user_id) || 'Système',
      action_label: formatAction(log.action, log.table_name),
      summary: generateSummary(log),
    }))
  } catch (error) {
    console.error('Error fetching global activity:', error)
    return []
  }
}

// Generate human-readable summary of what changed
function generateSummary(log: ActivityLog): string {
  if (!log.new_values) return ''

  const changes: string[] = []

  // Track field changes
  if (log.action === 'UPDATE' && log.old_values) {
    Object.keys(log.new_values).forEach((key) => {
      if (log.old_values?.[key] !== log.new_values?.[key]) {
        const oldVal = formatValue(log.old_values?.[key])
        const newVal = formatValue(log.new_values?.[key])
        changes.push(`${key}: ${oldVal} → ${newVal}`)
      }
    })
  } else if (log.action === 'CREATE') {
    const title = log.new_values.title || log.new_values.name || 'Sans titre'
    changes.push(`Créé: ${title}`)
  }

  return changes.join(', ')
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return 'vide'
  if (typeof val === 'boolean') return val ? 'oui' : 'non'
  if (typeof val === 'string') return `"${val.substring(0, 30)}${val.length > 30 ? '...' : ''}"`
  if (typeof val === 'object') return '[objet]'
  return String(val)
}

// Enregistrer une activité (helper simple à appeler sur chaque mutation)
export async function logActivity(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: string,
  newValues?: Record<string, any>,
  oldValues?: Record<string, any>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const changes: Record<string, any> = {}
    if (action === 'UPDATE' && oldValues && newValues) {
      for (const key of Object.keys(newValues)) {
        if (oldValues[key] !== newValues[key]) {
          changes[key] = { from: oldValues[key], to: newValues[key] }
        }
      }
    }
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      table_name: tableName,
      record_id: recordId,
      changes,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    })
  } catch {
    // Ne jamais bloquer une opération principale à cause du log
  }
}

// Get activity stream for project (all changes in the project)
export async function getProjectActivityStream(projectId: string, limit: number = 50): Promise<ActivityLogFormatted[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .in('table_name', ['projects', 'tasks', 'documents'])
      .or(`record_id.eq.${projectId},new_values->>project_id.eq.${projectId}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((log: ActivityLog) => ({
      ...log,
      action_label: formatAction(log.action, log.table_name),
      summary: generateSummary(log),
    }))
  } catch (error) {
    console.error('Error fetching project activity:', error)
    return []
  }
}
