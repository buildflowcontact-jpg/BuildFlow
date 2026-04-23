import { supabase } from './supabase'

export type PermissionLevel = 'view' | 'edit' | 'admin'

export interface ResourcePermission {
  id: string
  resource_id: string
  resource_type: 'task' | 'project' | 'document'
  user_id: string
  permission_level: PermissionLevel
  expires_at?: string
  created_at: string
  granted_by: string
}

export interface PermissionGrant {
  user_id: string
  permission_level: PermissionLevel
  expires_at?: Date
}

// Check if user has permission to access a resource
export async function checkPermission(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  requiredLevel: PermissionLevel = 'view'
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // First check if user is the owner (implicit admin)
    if (resourceType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', resourceId)
        .single()

      if (project?.created_by === user.id) return true
    }

    if (resourceType === 'task') {
      const { data: task } = await supabase
        .from('tasks')
        .select('created_by, project_id')
        .eq('id', resourceId)
        .single()

      if (task?.created_by === user.id) return true

      // Check if member of project
      if (task?.project_id) {
        const memberInProject = await isProjectMember(task.project_id, user.id)
        if (memberInProject) return true
      }
    }

    // Check explicit permissions
    const { data: permissions } = await supabase
      .from('resource_permissions')
      .select('permission_level, expires_at')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!permissions) return false

    // Check if permission expired
    if (permissions.expires_at) {
      const expiresAt = new Date(permissions.expires_at)
      if (expiresAt < new Date()) return false
    }

    // Check permission level
    const levelHierarchy: Record<PermissionLevel, number> = {
      view: 1,
      edit: 2,
      admin: 3,
    }

    return levelHierarchy[permissions.permission_level as PermissionLevel] >= levelHierarchy[requiredLevel]
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

// Get user permissions on a resource
export async function getUserPermission(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  userId?: string
): Promise<PermissionLevel | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = userId || user?.id

    if (!targetUserId) return null

    // Check if owner (implicit admin)
    if (resourceType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', resourceId)
        .single()

      if (project?.created_by === targetUserId) return 'admin'
    }

    // Check explicit permissions
    const { data: permission } = await supabase
      .from('resource_permissions')
      .select('permission_level, expires_at')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (!permission) return null

    // Check if expired
    if (permission.expires_at) {
      const expiresAt = new Date(permission.expires_at)
      if (expiresAt < new Date()) return null
    }

    return permission.permission_level
  } catch (error) {
    console.error('Error getting user permission:', error)
    return null
  }
}

// Grant permission to a user
export async function grantPermission(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  targetUserId: string,
  permissionLevel: PermissionLevel,
  expiresAt?: Date
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    // Verify user is allowed to grant permissions
    const canGrant = await canGrantPermission(resourceId, resourceType, user.id)
    if (!canGrant) throw new Error('Permission refusée')

    const { error } = await supabase.from('resource_permissions').upsert(
      [
        {
          resource_id: resourceId,
          resource_type: resourceType,
          user_id: targetUserId,
          permission_level: permissionLevel,
          expires_at: expiresAt?.toISOString(),
          granted_by: user.id,
        },
      ],
      { onConflict: 'resource_id,resource_type,user_id' }
    )

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error granting permission:', error)
    return false
  }
}

// Revoke permission
export async function revokePermission(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  targetUserId: string
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    // Verify user is allowed to revoke permissions
    const canRevoke = await canGrantPermission(resourceId, resourceType, user.id)
    if (!canRevoke) throw new Error('Permission refusée')

    const { error } = await supabase
      .from('resource_permissions')
      .delete()
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .eq('user_id', targetUserId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error revoking permission:', error)
    return false
  }
}

// Get all permissions on a resource
export async function getResourcePermissions(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document'
): Promise<ResourcePermission[]> {
  try {
    const { data, error } = await supabase
      .from('resource_permissions')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('resource_type', resourceType)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return []
  }
}

// Check if user can grant/revoke permissions (owner/admin)
async function canGrantPermission(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  userId: string
): Promise<boolean> {
  try {
    if (resourceType === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', resourceId)
        .single()

      return project?.created_by === userId
    }

    if (resourceType === 'task') {
      const { data: task } = await supabase
        .from('tasks')
        .select('created_by')
        .eq('id', resourceId)
        .single()

      return task?.created_by === userId
    }

    return false
  } catch (error) {
    console.error('Error checking grant permission:', error)
    return false
  }
}

// Check if user is member of project
async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()

    return !!data
  } catch {
    return false
  }
}

// Share resource temporarily (with expiration)
export async function shareResourceTemporarily(
  resourceId: string,
  resourceType: 'task' | 'project' | 'document',
  userIds: string[],
  daysToExpire: number = 7
): Promise<boolean> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysToExpire)

    for (const userId of userIds) {
      await grantPermission(resourceId, resourceType, userId, 'view', expiresAt)
    }

    return true
  } catch (error) {
    console.error('Error sharing resource:', error)
    return false
  }
}
