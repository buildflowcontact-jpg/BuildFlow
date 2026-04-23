/**
 * db.ts — Couche d'accès aux données Supabase pour BuildFlow.
 * Remplace les fonctions localStorage de teamStore.ts pour la persistance réelle.
 */

import { supabase } from './supabase'
import type { LocalTask, SubTask, VirtualMember, AppMember, TeamMember } from '../utils/teamStore'
import { pickColor } from '../utils/teamStore'
import { logActivity } from './auditLog'

export type FavoriteContactInput = {
  firstName: string
  lastName: string
  position: string
  company: string
  email: string
  color?: string
}

export type ProjectInviteResult = {
  mode: 'app' | 'virtual'
  memberId: string
  userId?: string
  alreadyExists?: boolean
}

// ─── Helpers de conversion ───────────────────────────────────────────────────

function dbRowToLocalTask(row: any): LocalTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    assigneeIds: row.assignee_ids ?? [],
    startDate: row.start_date ?? '',
    dueDate: row.end_date ?? row.due_date ?? '',
    subtasks: (row.subtasks ?? []).map((s: any): SubTask => ({
      id: s.id,
      title: s.title,
      status: s.status,
      assigneeIds: s.assignee_ids ?? [],
    })),
    parent_id: row.parent_id ?? null,
    dependsOn: [],
  }
}

// ─── Tâches ──────────────────────────────────────────────────────────────────

export async function loadTasks(userId: string): Promise<LocalTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, subtasks(*)')
    .or(`created_by.eq.${userId},assignee_ids.cs.{${userId}}`)
    .is('project_id', null)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadTasks:', error); return [] }
  const tasks = (data ?? []).map(dbRowToLocalTask)

  // Charger les dépendances en lot
  if (tasks.length > 0) {
    const ids = tasks.map((t) => t.id)
    const { data: deps } = await supabase
      .from('task_dependencies')
      .select('source_task_id, target_task_id')
      .in('source_task_id', ids)
    if (deps) {
      const depsMap = new Map<string, string[]>()
      deps.forEach((d: any) => {
        if (!depsMap.has(d.source_task_id)) depsMap.set(d.source_task_id, [])
        depsMap.get(d.source_task_id)!.push(d.target_task_id)
      })
      tasks.forEach((t) => { t.dependsOn = depsMap.get(t.id) ?? [] })
    }
  }

  return tasks
}

/** Insère ou met à jour une tâche + resynchronise ses sous-tâches. */
export async function persistTask(task: LocalTask, userId: string): Promise<void> {
  const { error } = await supabase.from('tasks').upsert({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee_ids: task.assigneeIds,
    start_date: task.startDate || null,
    end_date: task.dueDate || null,
    due_date: task.dueDate || null,
    project_id: null,
    created_by: userId,
    parent_id: task.parent_id ?? null,
  })
  if (error) { console.error('persistTask:', error); return }

  // Resynchronise les sous-tâches (upsert + suppression des orphelins)
  if (task.subtasks.length > 0) {
    await supabase.from('subtasks').upsert(
      task.subtasks.map((s) => ({
        id: s.id,
        task_id: task.id,
        title: s.title,
        status: s.status,
        assignee_ids: s.assigneeIds,
      })),
      { onConflict: 'id' }
    )
  }
  // Supprime les sous-tâches qui ne sont plus dans la liste
  const currentIds = task.subtasks.map((s) => s.id)
  if (currentIds.length > 0) {
    await supabase.from('subtasks').delete().eq('task_id', task.id).not('id', 'in', `(${currentIds.join(',')})`)
  } else {
    await supabase.from('subtasks').delete().eq('task_id', task.id)
  }
}

export async function removeTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) { console.error('removeTask:', error); return }
  void logActivity('DELETE', 'tasks', taskId)
}

// ─── Membres ─────────────────────────────────────────────────────────────────

function mapVirtualMemberRow(row: any): VirtualMember {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position ?? '',
    company: row.company ?? '',
    email: row.email ?? '',
    type: 'virtual',
    color: row.color ?? pickColor(0),
    projectId: row.project_id ?? null,
    linkedUserId: row.linked_user_id ?? null,
    isFavorite: row.is_favorite ?? false,
    sourceFavoriteId: row.source_favorite_id ?? null,
  }
}

async function findUserProfileByEmail(email: string): Promise<{ id: string; name: string | null; email: string | null; color: string | null } | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name, email, color')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (error) {
    console.error('findUserProfileByEmail:', error)
    return null
  }

  return data ?? null
}

async function ensureProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        role: 'member',
      },
      { onConflict: 'project_id,user_id', ignoreDuplicates: true }
    )

  if (error) {
    console.error('ensureProjectMember:', error)
  }
}

export async function loadVirtualMembers(userId: string): Promise<VirtualMember[]> {
  const { data, error } = await supabase
    .from('virtual_members')
    .select('*')
    .eq('created_by', userId)
    .is('project_id', null)
    .eq('is_favorite', true)
    .order('created_at', { ascending: true })
  if (error) { console.error('loadVirtualMembers:', error); return [] }
  return (data ?? []).map(mapVirtualMemberRow)
}

export async function loadFavoriteMembers(userId: string): Promise<VirtualMember[]> {
  return loadVirtualMembers(userId)
}

/** Insère un membre virtuel et retourne l'UUID Supabase généré. */
export async function addVirtualMember(
  member: Omit<VirtualMember, 'id' | 'type'>,
  userId: string
): Promise<string | null> {
  const linkedProfile = member.email ? await findUserProfileByEmail(member.email) : null
  const { data, error } = await supabase
    .from('virtual_members')
    .insert({
      project_id: member.projectId ?? null,
      first_name: member.firstName,
      last_name: member.lastName,
      position: member.position,
      company: member.company,
      email: member.email ?? '',
      color: member.color,
      linked_user_id: member.linkedUserId ?? linkedProfile?.id ?? null,
      created_by: userId,
      is_favorite: member.isFavorite ?? true,
      source_favorite_id: member.sourceFavoriteId ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) { console.error('addVirtualMember:', error); return null }
  return data.id
}

export async function createFavoriteMember(
  member: FavoriteContactInput,
  userId: string
): Promise<VirtualMember | null> {
  const linkedProfile = await findUserProfileByEmail(member.email)
  const { data, error } = await supabase
    .from('virtual_members')
    .insert({
      created_by: userId,
      project_id: null,
      first_name: member.firstName,
      last_name: member.lastName,
      position: member.position,
      company: member.company,
      email: member.email.trim().toLowerCase(),
      color: member.color ?? pickColor(Math.floor(Math.random() * 10)),
      linked_user_id: linkedProfile?.id ?? null,
      is_favorite: true,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('createFavoriteMember:', error)
    return null
  }

  return mapVirtualMemberRow(data)
}

export async function loadProjectVirtualMembers(projectId: string): Promise<VirtualMember[]> {
  const { data, error } = await supabase
    .from('virtual_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('loadProjectVirtualMembers:', error)
    return []
  }

  return (data ?? []).map(mapVirtualMemberRow)
}

export async function createProjectVirtualMember(
  projectId: string,
  member: FavoriteContactInput,
  userId: string,
  options?: { saveToFavorites?: boolean }
): Promise<ProjectInviteResult | null> {
  const normalizedEmail = member.email.trim().toLowerCase()
  const linkedProfile = await findUserProfileByEmail(normalizedEmail)

  if (options?.saveToFavorites) {
    await createFavoriteMember({ ...member, email: normalizedEmail, color: member.color }, userId)
  }

  if (linkedProfile?.id) {
    await ensureProjectMember(projectId, linkedProfile.id)
    return { mode: 'app', memberId: linkedProfile.id, userId: linkedProfile.id }
  }

  const { data, error } = await supabase
    .from('virtual_members')
    .insert({
      created_by: userId,
      project_id: projectId,
      first_name: member.firstName,
      last_name: member.lastName,
      position: member.position,
      company: member.company,
      email: normalizedEmail,
      color: member.color ?? pickColor(Math.floor(Math.random() * 10)),
      linked_user_id: null,
      is_favorite: false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('createProjectVirtualMember:', error)
    return null
  }

  return { mode: 'virtual', memberId: data.id }
}

export async function inviteFavoriteToProject(
  favoriteId: string,
  projectId: string,
  userId: string
): Promise<ProjectInviteResult | null> {
  const { data: favoriteRow, error: favoriteError } = await supabase
    .from('virtual_members')
    .select('*')
    .eq('id', favoriteId)
    .eq('created_by', userId)
    .maybeSingle()

  if (favoriteError || !favoriteRow) {
    console.error('inviteFavoriteToProject:', favoriteError)
    return null
  }

  const favorite = mapVirtualMemberRow(favoriteRow)
  const linkedProfile = favorite.email ? await findUserProfileByEmail(favorite.email) : null

  if (linkedProfile?.id) {
    await ensureProjectMember(projectId, linkedProfile.id)

    if (favorite.linkedUserId !== linkedProfile.id) {
      await supabase
        .from('virtual_members')
        .update({ linked_user_id: linkedProfile.id, updated_at: new Date().toISOString() })
        .eq('id', favoriteId)
    }

    const { data: existingProjectVirtual } = await supabase
      .from('virtual_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('source_favorite_id', favoriteId)
      .maybeSingle()

    if (existingProjectVirtual?.id) {
      await linkProjectVirtualMemberToAccount(existingProjectVirtual.id)
    }

    return { mode: 'app', memberId: linkedProfile.id, userId: linkedProfile.id }
  }

  const { data: existingProjectVirtual } = await supabase
    .from('virtual_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('source_favorite_id', favoriteId)
    .maybeSingle()

  if (existingProjectVirtual?.id) {
    return { mode: 'virtual', memberId: existingProjectVirtual.id, alreadyExists: true }
  }

  const { data, error } = await supabase
    .from('virtual_members')
    .insert({
      created_by: userId,
      project_id: projectId,
      first_name: favorite.firstName,
      last_name: favorite.lastName,
      position: favorite.position,
      company: favorite.company,
      email: favorite.email ?? '',
      color: favorite.color,
      linked_user_id: null,
      is_favorite: false,
      source_favorite_id: favoriteId,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('inviteFavoriteToProject insert:', error)
    return null
  }

  return { mode: 'virtual', memberId: data.id }
}

export async function linkProjectVirtualMemberToAccount(projectVirtualId: string): Promise<{ linkedUserId: string } | null> {
  const { data: virtualRow, error: virtualError } = await supabase
    .from('virtual_members')
    .select('*')
    .eq('id', projectVirtualId)
    .maybeSingle()

  if (virtualError || !virtualRow) {
    console.error('linkProjectVirtualMemberToAccount:', virtualError)
    return null
  }

  const virtualMember = mapVirtualMemberRow(virtualRow)
  if (!virtualMember.projectId || !virtualMember.email) return null

  const linkedProfile = await findUserProfileByEmail(virtualMember.email)
  if (!linkedProfile?.id) {
    return null
  }

  await ensureProjectMember(virtualMember.projectId, linkedProfile.id)

  const { data: projectTasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, assignee_ids')
    .eq('project_id', virtualMember.projectId)

  if (tasksError) {
    console.error('linkProjectVirtualMemberToAccount tasks:', tasksError)
  }

  const affectedTasks = (projectTasks ?? []).filter((task: any) => Array.isArray(task.assignee_ids) && task.assignee_ids.includes(projectVirtualId))

  await Promise.all(
    affectedTasks.map((task: any) => {
      const nextIds = Array.from(new Set(task.assignee_ids.map((id: string) => id === projectVirtualId ? linkedProfile.id : id)))
      return supabase.from('tasks').update({ assignee_ids: nextIds }).eq('id', task.id)
    })
  )

  const projectTaskIds = (projectTasks ?? []).map((task: any) => task.id)
  if (projectTaskIds.length > 0) {
    const { data: subtasks, error: subtasksError } = await supabase
      .from('subtasks')
      .select('id, assignee_ids')
      .in('task_id', projectTaskIds)

    if (subtasksError) {
      console.error('linkProjectVirtualMemberToAccount subtasks:', subtasksError)
    }

    const affectedSubtasks = (subtasks ?? []).filter((subtask: any) => Array.isArray(subtask.assignee_ids) && subtask.assignee_ids.includes(projectVirtualId))

    await Promise.all(
      affectedSubtasks.map((subtask: any) => {
        const nextIds = Array.from(new Set(subtask.assignee_ids.map((id: string) => id === projectVirtualId ? linkedProfile.id : id)))
        return supabase.from('subtasks').update({ assignee_ids: nextIds }).eq('id', subtask.id)
      })
    )
  }

  const { error } = await supabase
    .from('virtual_members')
    .delete()
    .eq('id', projectVirtualId)

  if (error) {
    console.error('linkProjectVirtualMemberToAccount delete:', error)
    return null
  }

  return { linkedUserId: linkedProfile.id }
}

export async function loadProjectTeamMembers(projectId: string): Promise<TeamMember[]> {
  const { data: memberRows, error: membersError } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)

  if (membersError) {
    console.error('loadProjectTeamMembers members:', membersError)
  }

  const memberIds = Array.from(new Set((memberRows ?? []).map((row: { user_id: string }) => row.user_id)))
  let realMembers: AppMember[] = []

  if (memberIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, name, email, color')
      .in('id', memberIds)

    if (profilesError) {
      console.error('loadProjectTeamMembers profiles:', profilesError)
    }

    realMembers = (profiles ?? []).map((profile: any): AppMember => ({
      id: profile.id,
      type: 'app',
      name: profile.name || profile.email || 'Utilisateur',
      email: profile.email || '',
      color: profile.color || pickColor(0),
    }))
  }

  const virtualMembers = (await loadProjectVirtualMembers(projectId)).filter((member) => !member.linkedUserId)
  return [...realMembers, ...virtualMembers]
}

export async function deleteVirtualMemberDb(id: string): Promise<void> {
  const { error } = await supabase.from('virtual_members').delete().eq('id', id)
  if (error) console.error('deleteVirtualMemberDb:', error)
}

/** Synchronise le profil de l'utilisateur courant dans user_profiles. */
export async function upsertUserProfile(userId: string, email: string, name: string): Promise<void> {
  await supabase.from('user_profiles').upsert(
    { id: userId, email, name, color: pickColor(0), updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
}

/**
 * Charge les membres complets (app localStorage + virtuels Supabase).
 * Les app members restent en localStorage pour Phase 1.
 */
export async function loadAllMembers(userId: string): Promise<TeamMember[]> {
  const [virtuals, sessionRes] = await Promise.all([
    loadVirtualMembers(userId),
    supabase.auth.getSession(),
  ])

  const user = sessionRes.data.session?.user
  const appMembers: AppMember[] = []

  if (user) {
    appMembers.push({
      id: user.id,
      name: (user.user_metadata as any)?.name || user.email || 'Moi',
      email: user.email || '',
      type: 'app',
      color: pickColor(0),
    })
  }

  return [...appMembers, ...virtuals]
}

// ─── Dépenses ────────────────────────────────────────────────────────────────

export type DbExpense = {
  id: string
  category: string
  amount: number
  status: 'Prévu' | 'En cours' | 'Validé'
  date: string
  description: string
  parent_id?: string | null
}

export async function loadExpensesDb(userId: string): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, category, amount, status, date, description, parent_id')
    .eq('created_by', userId)
    .order('date', { ascending: false })
  if (error) { console.error('loadExpensesDb:', error); return [] }
  return (data ?? []) as DbExpense[]
}

export async function createExpenseDb(
  expense: Omit<DbExpense, 'id'>,
  userId: string
): Promise<DbExpense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      category: expense.category,
      amount: expense.amount,
      status: expense.status,
      date: expense.date,
      description: expense.description,
      parent_id: expense.parent_id ?? null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) { console.error('createExpenseDb:', error); return null }
  return data as DbExpense
}

export async function updateExpenseDb(id: string, updates: Partial<DbExpense>): Promise<boolean> {
  const { error } = await supabase
    .from('expenses')
    .update({
      category: updates.category,
      amount: updates.amount,
      status: updates.status,
      date: updates.date,
      description: updates.description,
      parent_id: updates.parent_id ?? null,
    })
    .eq('id', id)
  if (error) { console.error('updateExpenseDb:', error); return false }
  return true
}

// ─── Dépendances de tâches ───────────────────────────────────────────────────

export async function addTaskDependencyDb(
  sourceTaskId: string,
  targetTaskId: string,
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish' = 'finish_to_start'
): Promise<boolean> {
  const { error } = await supabase.from('task_dependencies').insert({
    source_task_id: sourceTaskId,
    target_task_id: targetTaskId,
    dependency_type: type,
  })
  if (error) { console.error('addTaskDependencyDb:', error); return false }
  return true
}

export async function removeTaskDependencyDb(
  sourceTaskId: string,
  targetTaskId: string
): Promise<void> {
  const { error } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('source_task_id', sourceTaskId)
    .eq('target_task_id', targetTaskId)
  if (error) console.error('removeTaskDependencyDb:', error)
}

export async function deleteExpenseDb(id: string): Promise<boolean> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) { console.error('deleteExpenseDb:', error); return false }
  return true
}

export async function loadBudgetTotalDb(userId: string): Promise<number> {
  const { data } = await supabase
    .from('budget_settings')
    .select('total_budget')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.total_budget ?? 0
}

export async function saveBudgetTotalDb(userId: string, total: number): Promise<void> {
  await supabase.from('budget_settings').upsert(
    { user_id: userId, total_budget: total, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
}

// ─── Documents ───────────────────────────────────────────────────────────────

export type DbDocument = {
  id: string
  name: string
  url: string
  storage_path?: string | null
  type: string
  project_name: string
  uploaded_by_name: string
  size: string
  created_at: string
}

function extractStoragePathFromDocumentUrl(url: string): string | null {
  try {
    const match = decodeURIComponent(url).match(/\/documents\/([^?]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

async function resolveDocumentAccessUrl(storagePath: string | null | undefined, fallbackUrl: string): Promise<string> {
  const path = storagePath ?? extractStoragePathFromDocumentUrl(fallbackUrl)
  if (!path) return fallbackUrl

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) {
    return fallbackUrl
  }

  return data.signedUrl
}

async function hydrateDocumentUrls(rows: DbDocument[]): Promise<DbDocument[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      url: await resolveDocumentAccessUrl(row.storage_path, row.url),
    }))
  )
}

export async function loadDocumentsDb(userId: string): Promise<DbDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, url, storage_path, type, project_name, uploaded_by_name, size, created_at')
    .eq('uploaded_by', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadDocumentsDb:', error); return [] }
  return hydrateDocumentUrls((data ?? []) as DbDocument[])
}

export async function loadProjectDocumentsDb(projectId: string): Promise<DbDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, url, storage_path, type, project_name, uploaded_by_name, size, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) { console.error('loadProjectDocumentsDb:', error); return [] }
  return hydrateDocumentUrls((data ?? []) as DbDocument[])
}

export async function uploadDocumentDb(
  file: File,
  projectName: string,
  userId: string,
  userName: string,
  projectId?: string
): Promise<DbDocument | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const filePath = `${userId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file)
  if (uploadError) { console.error('uploadDocumentDb storage:', uploadError); return null }

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath)

  const { data, error } = await supabase
    .from('documents')
    .insert({
      name: file.name,
      url: publicUrl,
      storage_path: filePath,
      type: resolveDocType(file.name, file.type),
      project_id: projectId ?? null,
      project_name: projectName || '—',
      uploaded_by: userId,
      uploaded_by_name: userName,
      size: formatBytes(file.size),
    })
    .select()
    .single()
  if (error) { console.error('uploadDocumentDb insert:', error); return null }

  const row = data as DbDocument
  return {
    ...row,
    url: await resolveDocumentAccessUrl(row.storage_path, row.url),
  }
}

export async function deleteDocumentDb(id: string, url: string, storagePath?: string | null): Promise<void> {
  // Supprime le fichier du bucket Storage
  try {
    const path = storagePath ?? extractStoragePathFromDocumentUrl(url)
    if (path) {
      await supabase.storage.from('documents').remove([path])
    }
  } catch { /* ignore erreurs storage */ }
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) console.error('deleteDocumentDb:', error)
}

function resolveDocType(name: string, mime: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') return 'PDF'
  if (['xls', 'xlsx'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'Excel'
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) return 'Word'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) return 'Image'
  return 'Autre'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── Projets ─────────────────────────────────────────────────────────────────

export type DbProject = {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  start_date: string | null
  end_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type DbProjectWithTasks = DbProject & {
  tasks: { id: string; status: string }[]
}

export async function loadProjects(): Promise<DbProjectWithTasks[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(id, status)')
    .order('created_at', { ascending: false })
  if (error) { console.error('loadProjects:', error); return [] }
  return (data ?? []).map((row: any) => ({ ...row, tasks: row.tasks ?? [] })) as DbProjectWithTasks[]
}

export async function loadProjectsSimple(): Promise<DbProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, description, budget, start_date, end_date, created_by, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) { console.error('loadProjectsSimple:', error); return [] }
  return (data ?? []) as DbProject[]
}

export async function loadProject(id: string): Promise<DbProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) { console.error('loadProject:', error); return null }
  return data as DbProject | null
}

export async function createProjectDb(
  values: { name: string; description?: string; budget?: number; start_date?: string; end_date?: string },
  userId: string
): Promise<{ project: DbProject | null; error?: string }> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: values.name,
      description: values.description ?? null,
      budget: values.budget ?? null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      status: 'active',
      created_by: userId,
    })
    .select()
    .single()
  if (error) {
    console.error('createProjectDb:', error)
    return { project: null, error: error.message }
  }

  const defaultPhases = ['Commercial', "Bureau d'études", 'Chantier']
  const { error: phaseError } = await supabase
    .from('construction_phases')
    .insert(
      defaultPhases.map((name) => ({
        project_id: data.id,
        created_by: userId,
        name,
        progress_percent: 0,
        allocated_budget: 0,
        spent_budget: 0,
      }))
    )

  if (phaseError) {
    console.error('createProjectDb: default phases', phaseError)
  }

  return { project: data as DbProject }
}

export async function updateProjectDb(
  id: string,
  updates: Partial<{ name: string; description: string; budget: number; start_date: string; end_date: string }>,
  userId: string
): Promise<boolean> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.budget !== undefined) payload.budget = updates.budget
  if (updates.start_date !== undefined) payload.start_date = updates.start_date || null
  if (updates.end_date !== undefined) payload.end_date = updates.end_date || null
  const { error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .eq('created_by', userId)
  if (error) { console.error('updateProjectDb:', error); return false }
  return true
}

export async function archiveProjectDb(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update({ status: 'on-hold', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', userId)
  if (error) { console.error('archiveProjectDb:', error); return false }
  return true
}

export async function deleteProjectDb(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('created_by', userId)
  if (error) { console.error('deleteProjectDb:', error); return false }
  return true
}
