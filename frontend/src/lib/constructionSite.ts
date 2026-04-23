import { supabase } from './supabase'

const SITE_JOURNAL_BUCKET = 'documents'
const MAX_SITE_JOURNAL_PHOTO_SIZE = 10 * 1024 * 1024

export type ConstructionPhase = {
  id: string
  project_id: string
  created_by: string
  zone_id: string | null
  subcontractor_id: string | null
  name: string
  start_date: string | null
  end_date: string | null
  progress_percent: number
  allocated_budget: number
  spent_budget: number
  created_at: string
  updated_at: string
}

export type WorkerQualification = {
  id: string
  project_id: string
  created_by: string
  subcontractor_id: string | null
  worker_name: string
  qualification_name: string
  expiry_date: string | null
  created_at: string
  updated_at: string
}

export type SafetyChecklistItem = {
  id: string
  project_id: string
  created_by: string
  label: string
  done: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type SupplyOrder = {
  id: string
  project_id: string
  created_by: string
  zone_id: string | null
  subcontractor_id: string | null
  material_name: string
  quantity_label: string
  expected_delivery_date: string | null
  status: 'draft' | 'ordered' | 'received'
  created_at: string
  updated_at: string
}

export type EquipmentBooking = {
  id: string
  project_id: string
  created_by: string
  zone_id: string | null
  subcontractor_id: string | null
  equipment_name: string
  assigned_to_name: string
  booking_start: string | null
  booking_end: string | null
  created_at: string
  updated_at: string
}

export type SiteJournalEntry = {
  id: string
  project_id: string
  created_by: string
  zone_id: string | null
  subcontractor_id: string | null
  entry_date: string
  location_label: string
  photo_path: string
  photo_url: string
  note: string
  created_at: string
  updated_at: string
}

export type SiteZone = {
  id: string
  project_id: string
  created_by: string
  parent_zone_id: string | null
  kind: 'zone' | 'lot'
  code: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export type ProjectSubcontractor = {
  id: string
  project_id: string
  created_by: string
  company_name: string
  trade_label: string
  contact_name: string
  contact_phone: string
  status: 'active' | 'on_hold' | 'inactive'
  notes: string
  created_at: string
  updated_at: string
}

export type SiteIncident = {
  id: string
  project_id: string
  created_by: string
  zone_id: string | null
  subcontractor_id: string | null
  linked_phase_id: string | null
  incident_type: 'incident' | 'non_conformity' | 'observation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  occurred_on: string
  title: string
  description: string
  corrective_action: string
  owner_name: string
  due_date: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type ConstructionSiteData = {
  zones: SiteZone[]
  subcontractors: ProjectSubcontractor[]
  phases: ConstructionPhase[]
  qualifications: WorkerQualification[]
  safetyItems: SafetyChecklistItem[]
  supplies: SupplyOrder[]
  equipmentBookings: EquipmentBooking[]
  journalEntries: SiteJournalEntry[]
  incidents: SiteIncident[]
}

export type ConstructionPhaseMetrics = {
  phase_id: string
  linked_tasks: number
  completed_tasks: number
  linked_expenses: number
  validated_expenses_total: number
  committed_expenses_total: number
  total_expenses: number
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Utilisateur non authentifie')
  return user.id
}

function sanitizeStorageFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_')
}

async function uploadSiteJournalPhoto(projectId: string, userId: string, file: File): Promise<{ photo_path: string; photo_url: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le journal chantier accepte uniquement des images')
  }

  if (file.size > MAX_SITE_JOURNAL_PHOTO_SIZE) {
    throw new Error('La photo depasse la taille maximale de 10 Mo')
  }

  const filePath = `${userId}/site-journal/${projectId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(SITE_JOURNAL_BUCKET)
    .upload(filePath, file, { upsert: false })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(SITE_JOURNAL_BUCKET).getPublicUrl(filePath)
  return {
    photo_path: filePath,
    photo_url: data.publicUrl,
  }
}

async function deleteSiteJournalPhoto(photoPath: string): Promise<void> {
  if (!photoPath) return
  const { error } = await supabase.storage.from(SITE_JOURNAL_BUCKET).remove([photoPath])
  if (error) {
    console.error('Error deleting journal photo:', error)
  }
}

export async function loadConstructionSiteData(projectId: string): Promise<ConstructionSiteData> {
  const [zonesRes, subcontractorsRes, phasesRes, qualificationsRes, safetyRes, suppliesRes, equipmentRes, journalRes, incidentsRes] = await Promise.all([
    supabase.from('site_zones').select('*').eq('project_id', projectId).order('kind', { ascending: true }).order('code', { ascending: true }).order('name', { ascending: true }),
    supabase.from('project_subcontractors').select('*').eq('project_id', projectId).order('company_name', { ascending: true }),
    supabase.from('construction_phases').select('*').eq('project_id', projectId).order('start_date', { ascending: true }),
    supabase.from('worker_qualifications').select('*').eq('project_id', projectId).order('expiry_date', { ascending: true }),
    supabase.from('safety_checklist_items').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
    supabase.from('supply_orders').select('*').eq('project_id', projectId).order('expected_delivery_date', { ascending: true }),
    supabase.from('equipment_bookings').select('*').eq('project_id', projectId).order('booking_start', { ascending: true }),
    supabase.from('site_journal_entries').select('*').eq('project_id', projectId).order('entry_date', { ascending: false }),
    supabase.from('site_incidents').select('*').eq('project_id', projectId).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
  ])

  return {
    zones: (zonesRes.data || []) as SiteZone[],
    subcontractors: (subcontractorsRes.data || []) as ProjectSubcontractor[],
    phases: (phasesRes.data || []) as ConstructionPhase[],
    qualifications: (qualificationsRes.data || []) as WorkerQualification[],
    safetyItems: (safetyRes.data || []) as SafetyChecklistItem[],
    supplies: (suppliesRes.data || []) as SupplyOrder[],
    equipmentBookings: (equipmentRes.data || []) as EquipmentBooking[],
    journalEntries: (journalRes.data || []) as SiteJournalEntry[],
    incidents: (incidentsRes.data || []) as SiteIncident[],
  }
}

export async function loadConstructionPhaseMetrics(projectId: string): Promise<Record<string, ConstructionPhaseMetrics>> {
  const [tasksRes, expensesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('phase_id, status')
      .eq('project_id', projectId)
      .not('phase_id', 'is', null),
    supabase
      .from('expenses')
      .select('phase_id, amount, status')
      .eq('project_id', projectId)
      .not('phase_id', 'is', null),
  ])

  const metrics: Record<string, ConstructionPhaseMetrics> = {}

  for (const task of tasksRes.data || []) {
    const phaseId = task.phase_id as string | null
    if (!phaseId) continue
    metrics[phaseId] ??= {
      phase_id: phaseId,
      linked_tasks: 0,
      completed_tasks: 0,
      linked_expenses: 0,
      validated_expenses_total: 0,
      committed_expenses_total: 0,
      total_expenses: 0,
    }
    metrics[phaseId].linked_tasks += 1
    if (task.status === 'done') {
      metrics[phaseId].completed_tasks += 1
    }
  }

  for (const expense of expensesRes.data || []) {
    const phaseId = expense.phase_id as string | null
    if (!phaseId) continue
    metrics[phaseId] ??= {
      phase_id: phaseId,
      linked_tasks: 0,
      completed_tasks: 0,
      linked_expenses: 0,
      validated_expenses_total: 0,
      committed_expenses_total: 0,
      total_expenses: 0,
    }
    const amount = Number(expense.amount || 0)
    metrics[phaseId].linked_expenses += 1
    metrics[phaseId].total_expenses += amount
    if (expense.status === 'Validé') {
      metrics[phaseId].validated_expenses_total += amount
    }
    if (expense.status === 'En cours') {
      metrics[phaseId].committed_expenses_total += amount
    }
  }

  return metrics
}

export async function ensureDefaultSafetyChecklist(projectId: string): Promise<SafetyChecklistItem[]> {
  const { data: existing } = await supabase
    .from('safety_checklist_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if ((existing || []).length > 0) return (existing || []) as SafetyChecklistItem[]

  const userId = await getCurrentUserId()
  const defaults = [
    { label: 'Brief securite quotidien', sort_order: 1 },
    { label: 'Verification EPI', sort_order: 2 },
    { label: 'Balise zone dangereuse', sort_order: 3 },
  ]

  const { data, error } = await supabase
    .from('safety_checklist_items')
    .insert(defaults.map((item) => ({ ...item, project_id: projectId, created_by: userId })))
    .select()

  if (error) {
    console.error('Error seeding safety checklist:', error)
    return []
  }

  return (data || []) as SafetyChecklistItem[]
}

export async function createConstructionPhase(
  projectId: string,
  input: { name: string; start_date?: string; end_date?: string; progress_percent?: number; allocated_budget?: number; spent_budget?: number; zone_id?: string; subcontractor_id?: string }
): Promise<ConstructionPhase | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('construction_phases')
    .insert({
      project_id: projectId,
      created_by: userId,
      name: input.name,
      zone_id: input.zone_id || null,
      subcontractor_id: input.subcontractor_id || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      progress_percent: input.progress_percent ?? 0,
      allocated_budget: input.allocated_budget ?? 0,
      spent_budget: input.spent_budget ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating phase:', error)
    return null
  }
  return data as ConstructionPhase
}

export async function deleteConstructionPhase(id: string): Promise<boolean> {
  const { error } = await supabase.from('construction_phases').delete().eq('id', id)
  if (error) {
    console.error('Error deleting phase:', error)
    return false
  }
  return true
}

export async function updateConstructionPhase(
  id: string,
  updates: Partial<Pick<ConstructionPhase, 'name' | 'zone_id' | 'subcontractor_id' | 'start_date' | 'end_date' | 'progress_percent' | 'allocated_budget' | 'spent_budget'>>
): Promise<ConstructionPhase | null> {
  const { data, error } = await supabase
    .from('construction_phases')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating phase:', error)
    return null
  }

  return data as ConstructionPhase
}

export async function createWorkerQualification(
  projectId: string,
  input: { worker_name: string; qualification_name: string; expiry_date?: string; subcontractor_id?: string }
): Promise<WorkerQualification | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('worker_qualifications')
    .insert({
      project_id: projectId,
      created_by: userId,
      subcontractor_id: input.subcontractor_id || null,
      worker_name: input.worker_name,
      qualification_name: input.qualification_name,
      expiry_date: input.expiry_date || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating qualification:', error)
    return null
  }
  return data as WorkerQualification
}

export async function deleteWorkerQualification(id: string): Promise<boolean> {
  const { error } = await supabase.from('worker_qualifications').delete().eq('id', id)
  if (error) {
    console.error('Error deleting qualification:', error)
    return false
  }
  return true
}

export async function updateWorkerQualification(
  id: string,
  updates: Partial<Pick<WorkerQualification, 'worker_name' | 'qualification_name' | 'expiry_date' | 'subcontractor_id'>>
): Promise<WorkerQualification | null> {
  const { data, error } = await supabase
    .from('worker_qualifications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating qualification:', error)
    return null
  }

  return data as WorkerQualification
}

export async function createSafetyChecklistItem(projectId: string, label: string, sortOrder: number): Promise<SafetyChecklistItem | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('safety_checklist_items')
    .insert({ project_id: projectId, created_by: userId, label, sort_order: sortOrder })
    .select()
    .single()

  if (error) {
    console.error('Error creating safety item:', error)
    return null
  }
  return data as SafetyChecklistItem
}

export async function toggleSafetyChecklistItem(id: string, done: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('safety_checklist_items')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error toggling safety item:', error)
    return false
  }
  return true
}

export async function deleteSafetyChecklistItem(id: string): Promise<boolean> {
  const { error } = await supabase.from('safety_checklist_items').delete().eq('id', id)
  if (error) {
    console.error('Error deleting safety item:', error)
    return false
  }
  return true
}

export async function updateSafetyChecklistItem(id: string, label: string): Promise<SafetyChecklistItem | null> {
  const { data, error } = await supabase
    .from('safety_checklist_items')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating safety item:', error)
    return null
  }

  return data as SafetyChecklistItem
}

export async function createSupplyOrder(
  projectId: string,
  input: { material_name: string; quantity_label?: string; expected_delivery_date?: string; status: SupplyOrder['status']; zone_id?: string; subcontractor_id?: string }
): Promise<SupplyOrder | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('supply_orders')
    .insert({
      project_id: projectId,
      created_by: userId,
      zone_id: input.zone_id || null,
      subcontractor_id: input.subcontractor_id || null,
      material_name: input.material_name,
      quantity_label: input.quantity_label || '',
      expected_delivery_date: input.expected_delivery_date || null,
      status: input.status,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating supply order:', error)
    return null
  }
  return data as SupplyOrder
}

export async function updateSupplyOrderStatus(id: string, status: SupplyOrder['status']): Promise<boolean> {
  const { error } = await supabase
    .from('supply_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating supply order:', error)
    return false
  }
  return true
}

export async function deleteSupplyOrder(id: string): Promise<boolean> {
  const { error } = await supabase.from('supply_orders').delete().eq('id', id)
  if (error) {
    console.error('Error deleting supply order:', error)
    return false
  }
  return true
}

export async function updateSupplyOrder(
  id: string,
  updates: Partial<Pick<SupplyOrder, 'material_name' | 'quantity_label' | 'expected_delivery_date' | 'status' | 'zone_id' | 'subcontractor_id'>>
): Promise<SupplyOrder | null> {
  const { data, error } = await supabase
    .from('supply_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating supply order:', error)
    return null
  }

  return data as SupplyOrder
}

export async function createEquipmentBooking(
  projectId: string,
  input: { equipment_name: string; assigned_to_name?: string; booking_start?: string; booking_end?: string; zone_id?: string; subcontractor_id?: string }
): Promise<EquipmentBooking | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('equipment_bookings')
    .insert({
      project_id: projectId,
      created_by: userId,
      zone_id: input.zone_id || null,
      subcontractor_id: input.subcontractor_id || null,
      equipment_name: input.equipment_name,
      assigned_to_name: input.assigned_to_name || '',
      booking_start: input.booking_start || null,
      booking_end: input.booking_end || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating equipment booking:', error)
    return null
  }
  return data as EquipmentBooking
}

export async function deleteEquipmentBooking(id: string): Promise<boolean> {
  const { error } = await supabase.from('equipment_bookings').delete().eq('id', id)
  if (error) {
    console.error('Error deleting equipment booking:', error)
    return false
  }
  return true
}

export async function updateEquipmentBooking(
  id: string,
  updates: Partial<Pick<EquipmentBooking, 'equipment_name' | 'assigned_to_name' | 'booking_start' | 'booking_end' | 'zone_id' | 'subcontractor_id'>>
): Promise<EquipmentBooking | null> {
  const { data, error } = await supabase
    .from('equipment_bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating equipment booking:', error)
    return null
  }

  return data as EquipmentBooking
}

export async function createSiteJournalEntry(
  projectId: string,
  input: { entry_date: string; location_label?: string; note?: string; photo_file?: File | null; zone_id?: string; subcontractor_id?: string }
): Promise<SiteJournalEntry | null> {
  const userId = await getCurrentUserId()
  let photo = { photo_path: '', photo_url: '' }

  try {
    if (input.photo_file) {
      photo = await uploadSiteJournalPhoto(projectId, userId, input.photo_file)
    }
  } catch (error) {
    console.error('Error uploading journal photo:', error)
    return null
  }

  const { data, error } = await supabase
    .from('site_journal_entries')
    .insert({
      project_id: projectId,
      created_by: userId,
      entry_date: input.entry_date,
      zone_id: input.zone_id || null,
      subcontractor_id: input.subcontractor_id || null,
      location_label: input.location_label || '',
      photo_path: photo.photo_path,
      photo_url: photo.photo_url,
      note: input.note || '',
    })
    .select()
    .single()

  if (error) {
    await deleteSiteJournalPhoto(photo.photo_path)
    console.error('Error creating journal entry:', error)
    return null
  }
  return data as SiteJournalEntry
}

export async function deleteSiteJournalEntry(id: string, photoPath?: string): Promise<boolean> {
  const { error } = await supabase.from('site_journal_entries').delete().eq('id', id)
  if (error) {
    console.error('Error deleting journal entry:', error)
    return false
  }

  if (photoPath) {
    await deleteSiteJournalPhoto(photoPath)
  }

  return true
}

export async function updateSiteJournalEntry(
  id: string,
  updates: {
    project_id: string
    entry_date?: string
    zone_id?: string | null
    subcontractor_id?: string | null
    location_label?: string
    note?: string
    photo_file?: File | null
    current_photo_path?: string | null
    remove_photo?: boolean
  }
): Promise<SiteJournalEntry | null> {
  const userId = await getCurrentUserId()
  let nextPhotoPath: string | undefined
  let nextPhotoUrl: string | undefined

  try {
    if (updates.photo_file) {
      const uploaded = await uploadSiteJournalPhoto(updates.project_id, userId, updates.photo_file)
      nextPhotoPath = uploaded.photo_path
      nextPhotoUrl = uploaded.photo_url
    }
  } catch (error) {
    console.error('Error uploading replacement journal photo:', error)
    return null
  }

  const payload: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof updates.entry_date !== 'undefined') payload.entry_date = updates.entry_date
  if (typeof updates.zone_id !== 'undefined') payload.zone_id = updates.zone_id
  if (typeof updates.subcontractor_id !== 'undefined') payload.subcontractor_id = updates.subcontractor_id
  if (typeof updates.location_label !== 'undefined') payload.location_label = updates.location_label
  if (typeof updates.note !== 'undefined') payload.note = updates.note

  if (nextPhotoPath && nextPhotoUrl) {
    payload.photo_path = nextPhotoPath
    payload.photo_url = nextPhotoUrl
  } else if (updates.remove_photo) {
    payload.photo_path = ''
    payload.photo_url = ''
  }

  const { data, error } = await supabase
    .from('site_journal_entries')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (nextPhotoPath) {
      await deleteSiteJournalPhoto(nextPhotoPath)
    }
    console.error('Error updating journal entry:', error)
    return null
  }

  if ((nextPhotoPath || updates.remove_photo) && updates.current_photo_path) {
    await deleteSiteJournalPhoto(updates.current_photo_path)
  }

  return data as SiteJournalEntry
}

export async function createSiteZone(
  projectId: string,
  input: { kind: SiteZone['kind']; code?: string; name: string; description?: string; parent_zone_id?: string }
): Promise<SiteZone | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('site_zones')
    .insert({
      project_id: projectId,
      created_by: userId,
      kind: input.kind,
      code: input.code || '',
      name: input.name,
      description: input.description || '',
      parent_zone_id: input.parent_zone_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating site zone:', error)
    return null
  }
  return data as SiteZone
}

export async function updateSiteZone(
  id: string,
  updates: Partial<Pick<SiteZone, 'kind' | 'code' | 'name' | 'description' | 'parent_zone_id'>>
): Promise<SiteZone | null> {
  const { data, error } = await supabase
    .from('site_zones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating site zone:', error)
    return null
  }
  return data as SiteZone
}

export async function deleteSiteZone(id: string): Promise<boolean> {
  const { error } = await supabase.from('site_zones').delete().eq('id', id)
  if (error) {
    console.error('Error deleting site zone:', error)
    return false
  }
  return true
}

export async function createProjectSubcontractor(
  projectId: string,
  input: { company_name: string; trade_label?: string; contact_name?: string; contact_phone?: string; status?: ProjectSubcontractor['status']; notes?: string }
): Promise<ProjectSubcontractor | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('project_subcontractors')
    .insert({
      project_id: projectId,
      created_by: userId,
      company_name: input.company_name,
      trade_label: input.trade_label || '',
      contact_name: input.contact_name || '',
      contact_phone: input.contact_phone || '',
      status: input.status || 'active',
      notes: input.notes || '',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating subcontractor:', error)
    return null
  }
  return data as ProjectSubcontractor
}

export async function updateProjectSubcontractor(
  id: string,
  updates: Partial<Pick<ProjectSubcontractor, 'company_name' | 'trade_label' | 'contact_name' | 'contact_phone' | 'status' | 'notes'>>
): Promise<ProjectSubcontractor | null> {
  const { data, error } = await supabase
    .from('project_subcontractors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating subcontractor:', error)
    return null
  }
  return data as ProjectSubcontractor
}

export async function deleteProjectSubcontractor(id: string): Promise<boolean> {
  const { error } = await supabase.from('project_subcontractors').delete().eq('id', id)
  if (error) {
    console.error('Error deleting subcontractor:', error)
    return false
  }
  return true
}

export async function createSiteIncident(
  projectId: string,
  input: {
    zone_id?: string
    subcontractor_id?: string
    linked_phase_id?: string
    incident_type: SiteIncident['incident_type']
    severity: SiteIncident['severity']
    status?: SiteIncident['status']
    occurred_on: string
    title: string
    description?: string
    corrective_action?: string
    owner_name?: string
    due_date?: string
  }
): Promise<SiteIncident | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('site_incidents')
    .insert({
      project_id: projectId,
      created_by: userId,
      zone_id: input.zone_id || null,
      subcontractor_id: input.subcontractor_id || null,
      linked_phase_id: input.linked_phase_id || null,
      incident_type: input.incident_type,
      severity: input.severity,
      status: input.status || 'open',
      occurred_on: input.occurred_on,
      title: input.title,
      description: input.description || '',
      corrective_action: input.corrective_action || '',
      owner_name: input.owner_name || '',
      due_date: input.due_date || null,
      resolved_at: input.status === 'resolved' || input.status === 'closed' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating site incident:', error)
    return null
  }
  return data as SiteIncident
}

export async function updateSiteIncident(
  id: string,
  updates: Partial<Pick<SiteIncident, 'zone_id' | 'subcontractor_id' | 'linked_phase_id' | 'incident_type' | 'severity' | 'status' | 'occurred_on' | 'title' | 'description' | 'corrective_action' | 'owner_name' | 'due_date'>>
): Promise<SiteIncident | null> {
  const payload: Record<string, string | null> = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (updates.status) {
    payload.resolved_at = updates.status === 'resolved' || updates.status === 'closed'
      ? new Date().toISOString()
      : null
  }

  const { data, error } = await supabase
    .from('site_incidents')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating site incident:', error)
    return null
  }
  return data as SiteIncident
}

export async function deleteSiteIncident(id: string): Promise<boolean> {
  const { error } = await supabase.from('site_incidents').delete().eq('id', id)
  if (error) {
    console.error('Error deleting site incident:', error)
    return false
  }
  return true
}
