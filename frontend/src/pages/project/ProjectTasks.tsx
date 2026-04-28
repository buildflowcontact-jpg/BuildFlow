import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, ChevronDown, ChevronRight, Check, Bookmark, Trash2, LayoutGrid, List, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadVirtualMembers } from '../../lib/db'
import { DateInput } from '../../components/DateInput'
import { CommentSection } from '../../components/CommentSection'
import { TimeTracker } from '../../components/TimeTracker'
import { RecurrenceModal } from '../../components/RecurrenceModal'
import { TaskTemplateSelector } from '../../components/TaskTemplateSelector'
import { saveFilter, getUserFilters, deleteFilter, type SavedFilter, type FilterCriteria } from '../../lib/search'
import { checkAndExecuteRules } from '../../lib/automationRules'
import { getTaskDependencies, recalculateDependentTaskDates } from '../../lib/taskDependencies'

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  start_date: string | null
  end_date: string | null
  due_date?: string | null
  completed_at?: string | null
  project_id: string
  parent_id: string | null
  phase_id: string | null
  created_by: string
  assignee_ids: string[]
  children: Task[]
}

type KanbanLane = {
  id: string          // phase uuid ou '__none__'
  name: string
  isPhase: boolean    // false = colonne "Non classé"
}

type ConstructionPhaseOption = {
  id: string
  name: string
}

type PMember = {
  id: string
  name: string
  initials: string
  color: string
  isAppUser: boolean
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: 'Faible',  color: 'text-slate-500 bg-slate-100' },
  medium: { label: 'Moyen',   color: 'text-amber-700 bg-amber-100' },
  high:   { label: 'Élevé',   color: 'text-orange-700 bg-orange-100' },
  urgent: { label: 'Urgent',  color: 'text-red-700 bg-red-100' },
}

const STATUS_STYLE: Record<TaskStatus, { text: string; ring: string; dot: string }> = {
  todo:          { text: 'text-slate-500',   ring: 'bg-slate-50',   dot: 'bg-slate-400' },
  'in-progress': { text: 'text-amber-700',   ring: 'bg-amber-50',   dot: 'bg-amber-400' },
  review:        { text: 'text-blue-700',    ring: 'bg-blue-50',    dot: 'bg-blue-400' },
  done:          { text: 'text-emerald-700', ring: 'bg-emerald-50', dot: 'bg-emerald-500' },
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  review: 'En revue',
  done: 'Terminé',
}

const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in-progress'],
  'in-progress': ['todo', 'review'],
  review: ['in-progress', 'done'],
  done: ['review'],
}

const INDENT_COLORS = [
  'border-l-slate-300',
  'border-l-indigo-200',
  'border-l-sky-200',
  'border-l-violet-200',
]

const TASKS_SELECT = 'id, title, description, status, priority, start_date, end_date, due_date, completed_at, project_id, parent_id, phase_id, created_by, assignee_ids'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTree(rows: Omit<Task, 'children'>[]): Task[] {
  const map = new Map<string, Task>()
  rows.forEach(r => map.set(r.id, { ...r, children: [] }))
  const roots: Task[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function flattenTree(tasks: Task[]): Task[] {
  return tasks.flatMap(t => [t, ...flattenTree(t.children)])
}

function countAll(tasks: Task[]): number {
  return tasks.reduce((acc, t) => acc + 1 + countAll(t.children), 0)
}

function countDone(tasks: Task[]): number {
  return tasks.reduce((acc, t) => {
    const self = t.status === 'done' ? 1 : 0
    return acc + self + countDone(t.children)
  }, 0)
}

function mapTask(tasks: Task[], id: string, fn: (t: Task) => Task): Task[] {
  return tasks.map(t => {
    if (t.id === id) return fn(t)
    return { ...t, children: mapTask(t.children, id, fn) }
  })
}

function filterTask(tasks: Task[], id: string): Task[] {
  return tasks
    .filter(t => t.id !== id)
    .map(t => ({ ...t, children: filterTask(t.children, id) }))
}

function addChildToTask(tasks: Task[], parentId: string, child: Task): Task[] {
  return tasks.map(t => {
    if (t.id === parentId) return { ...t, children: [...t.children, child] }
    return { ...t, children: addChildToTask(t.children, parentId, child) }
  })
}

function findTask(tasks: Task[], id: string): Task | undefined {
  for (const t of tasks) {
    if (t.id === id) return t
    const found = findTask(t.children, id)
    if (found) return found
  }
}

function collectSubtreeIds(task: Task): string[] {
  return [task.id, ...task.children.flatMap(collectSubtreeIds)]
}

function updatePhaseForTaskIds(tasks: Task[], ids: Set<string>, phaseId: string | null): Task[] {
  return tasks.map((t) => ({
    ...t,
    phase_id: ids.has(t.id) ? phaseId : t.phase_id,
    children: updatePhaseForTaskIds(t.children, ids, phaseId),
  }))
}

function applyCascadedDateUpdates(tasks: Task[], updates: Map<string, { start_date: string | null; end_date: string | null; due_date: string | null }>): Task[] {
  return tasks.map((t) => {
    const patch = updates.get(t.id)
    return {
      ...t,
      start_date: patch ? patch.start_date : t.start_date,
      end_date: patch ? patch.end_date : t.end_date,
      due_date: patch ? patch.due_date : t.due_date,
      children: applyCascadedDateUpdates(t.children, updates),
    }
  })
}

function initials(name: string): string {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.charAt(0).toUpperCase()
}

function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus, isManager: boolean): boolean {
  if (from === to) return true
  if (to === 'done' && !isManager) return false
  return (STATUS_TRANSITIONS[from] ?? []).includes(to)
}

function getEditableStatuses(current: TaskStatus, isManager: boolean): TaskStatus[] {
  const candidates = [current, ...(STATUS_TRANSITIONS[current] ?? [])]
  const unique = candidates.filter((value, index, arr) => arr.indexOf(value) === index)
  return unique.filter((status) => status !== 'done' || isManager || status === current)
}

function getCreatableStatuses(isManager: boolean): TaskStatus[] {
  return isManager ? ['todo', 'in-progress', 'review'] : ['todo', 'in-progress']
}

function getTaskMutationErrorMessage(rawMessage: string | undefined, fallback: string): string {
  const message = (rawMessage ?? '').toLowerCase()

  if (message.includes('transition de statut invalide')) {
    return 'Transition de statut invalide pour cette tâche.'
  }
  if (message.includes('statut initial invalide')) {
    return 'Statut initial invalide pour une nouvelle tâche.'
  }
  if (message.includes('owner/admin/manager')) {
    return 'Seuls owner/admin/manager peuvent passer une tâche à terminé.'
  }
  if (message.includes('suppression bloquee') && message.includes('sous-taches')) {
    return 'Suppression bloquée: retirez d\'abord les sous-tâches.'
  }
  if (message.includes('suppression bloquee') && message.includes('dependances')) {
    return 'Suppression bloquée: retirez d\'abord les dépendances de cette tâche.'
  }

  return fallback
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function sendTaskNotifications(
  taskId: string,
  projectId: string,
  taskTitle: string,
  newAssigneeIds: string[],
  appUserIdSet: Set<string>,
): Promise<void> {
  const realIds = newAssigneeIds.filter(id => appUserIdSet.has(id))
  if (realIds.length === 0) return

  // Filtrer selon la préférence notify_in_app (activé par défaut)
  const { data: prefs } = await supabase
    .from('user_profiles')
    .select('id, notify_in_app')
    .in('id', realIds)

  const prefMap = new Map((prefs ?? []).map(p => [p.id, p]))
  const inAppIds = realIds.filter(id => {
    const p = prefMap.get(id)
    return !p || p.notify_in_app !== false
  })

  if (inAppIds.length === 0) return
  await supabase.from('notifications').insert(
    inAppIds.map(userId => ({
      user_id: userId,
      project_id: projectId,
      task_id: taskId,
      type: 'task_assigned',
      title: 'Tâche assignée',
      body: `Vous avez été assigné à "${taskTitle}"`,
      read: false,
    }))
  )
}

// ─── MemberAvatar ─────────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 'sm' }: { member: PMember; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-xs'
  return (
    <div
      title={member.name}
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${member.color} ${cls}`}
    >
      {member.initials}
    </div>
  )
}

// ─── MemberPicker ─────────────────────────────────────────────────────────────

function MemberPicker({
  members,
  selected,
  onChange,
}: {
  members: PMember[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  if (members.length === 0) {
    return <p className="text-xs text-slate-400 italic">Aucun membre dans ce projet.</p>
  }
  return (
    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
      {members.map(m => (
        <label key={m.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={selected.includes(m.id)}
            onChange={() => toggle(m.id)}
            className="rounded accent-indigo-600"
          />
          <MemberAvatar member={m} size="md" />
          <span className="flex-1 text-sm text-slate-900">{m.name}</span>
          {!m.isAppUser && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">Virtuel</span>
          )}
        </label>
      ))}
    </div>
  )
}

// ─── TaskDetailModal ──────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  members,
  phases,
  onClose,
  onSave,
  onDelete,
  onOpenAddModal,
  onOpenRecurrence,
  isManager,
}: {
  task: Task
  members: PMember[]
  phases: ConstructionPhaseOption[]
  onClose: () => void
  onSave: (updated: Omit<Task, 'children'>, newlyAssigned: string[], prevStatus: TaskStatus) => void
  onDelete: (id: string) => Promise<boolean>
  onOpenAddModal: (parentId: string) => void
  onOpenRecurrence: (taskId: string) => void
  isManager: boolean
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    start_date: task.start_date ?? '',
    end_date: task.end_date ?? task.due_date ?? '',
    phase_id: task.phase_id ?? '',
    assignee_ids: [...task.assignee_ids],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const prevAssigneeIds = task.assignee_ids
  const editableStatuses = getEditableStatuses(task.status, isManager)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Titre requis'); return }
    if (!canTransitionTaskStatus(task.status, form.status, isManager)) {
      setError('Transition de statut non autorisée')
      return
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      setError('La date de début doit être antérieure à la date de fin')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('tasks').update({
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      due_date: form.end_date || null,
      phase_id: form.phase_id || null,
      assignee_ids: form.assignee_ids,
    }).eq('id', task.id)
    setSaving(false)
    if (err) {
      setError(getTaskMutationErrorMessage(err.message, 'Impossible de mettre à jour la tâche.'))
      return
    }
    const newlyAssigned = form.assignee_ids.filter(id => !prevAssigneeIds.includes(id))
    onSave(
      {
        ...task,
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        due_date: form.end_date || null,
        phase_id: form.phase_id || null,
      },
      newlyAssigned,
      task.status,
    )
    onClose()
  }

  const handleDelete = async () => {
    if (task.children.length > 0) {
      setError('Suppression bloquée: retirez d\'abord les sous-tâches.')
      return
    }

    const dependencies = await getTaskDependencies(task.id)
    if (dependencies.length > 0) {
      setError('Suppression bloquée: retirez d\'abord les dépendances de cette tâche.')
      return
    }

    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const deleted = await onDelete(task.id)
    if (!deleted) {
      setError('La suppression a été refusée par les règles du projet.')
      return
    }
    onClose()
  }

  const childCount = task.children.length
  const doneChildCount = task.children.filter(c => c.status === 'done').length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Détail de la tâche</h2>
            {childCount > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {doneChildCount}/{childCount} sous-tâche{childCount > 1 ? 's' : ''} terminée{childCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Titre */}
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre de la tâche *"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />

          {/* Description */}
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Description (optionnelle)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none resize-none"
          />

          {/* Statut + Priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Priorité</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de début</label>
              <DateInput
                value={form.start_date}
                onChange={value => setForm(f => ({ ...f, start_date: value }))}
                max={form.end_date || undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de fin</label>
              <DateInput
                value={form.end_date}
                onChange={value => setForm(f => ({ ...f, end_date: value }))}
                min={form.start_date || undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Phase chantier</label>
            <select
              value={form.phase_id}
              onChange={e => setForm(f => ({ ...f, phase_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Aucune phase</option>
              {phases.map(phase => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
            </select>
          </div>

          {/* Personnes assignées */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Personnes assignées
              {form.assignee_ids.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 normal-case">
                  {form.assignee_ids.length} sélectionné{form.assignee_ids.length > 1 ? 's' : ''}
                </span>
              )}
            </label>
            <MemberPicker
              members={members}
              selected={form.assignee_ids}
              onChange={ids => setForm(f => ({ ...f, assignee_ids: ids }))}
            />
          </div>

          {/* Sous-tâches */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Sous-tâches
            </label>
            {task.children.length > 0 ? (
              <div className="space-y-1 mb-2">
                {task.children.map(child => (
                  <div key={child.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_STYLE[child.status].dot}`} />
                    <span className={`flex-1 text-xs ${child.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {child.title}
                    </span>
                    {child.children.length > 0 && (
                      <span className="text-[10px] text-slate-400">{child.children.length} enfant{child.children.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-slate-400 italic">Aucune sous-tâche pour l'instant.</p>
            )}
            <button
              type="button"
              onClick={() => { onClose(); onOpenAddModal(task.id) }}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition w-full justify-center"
            >
              <Plus className="h-3 w-3" />
              Ajouter une sous-tâche
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automatisation</p>
              <button
                type="button"
                onClick={() => onOpenRecurrence(task.id)}
                className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition"
              >
                Configurer la récurrence
              </button>
            </div>
            <TimeTracker taskId={task.id} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <CommentSection taskId={task.id} />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                confirmDelete
                  ? 'border-red-200 bg-red-600 text-white hover:bg-red-700'
                  : 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              {confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
            {confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler suppression
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal ajout tâche (racine ou sous-tâche) ───────────────────────────────

function AddTaskModal({
  projectId,
  parentId = null,
  parentTitle,
  members,
  phases,
  isManager,
  appUserIdSet,
  onClose,
  onAdded,
}: {
  projectId: string
  parentId?: string | null
  parentTitle?: string
  members: PMember[]
  phases: ConstructionPhaseOption[]
  isManager: boolean
  appUserIdSet: Set<string>
  onClose: () => void
  onAdded: (task: Task) => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    start_date: '',
    end_date: '',
    phase_id: '',
    assignee_ids: [] as string[],
  })
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const creatableStatuses = getCreatableStatuses(isManager)

  const applyTemplate = (template: {
    name: string
    description: string
    priority: string
    estimated_hours?: number
  }) => {
    setForm(f => ({
      ...f,
      title: template.name,
      description: template.description || f.description,
      priority: (template.priority as TaskPriority) || f.priority,
    }))
    setShowTemplateSelector(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Titre requis'); return }
    if (!creatableStatuses.includes(form.status)) {
      setError('Statut initial non autorisé')
      return
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      setError('La date de début doit être antérieure à la date de fin')
      return
    }
    setSaving(true)
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user?.id
    if (!userId) { setError('Non authentifié'); setSaving(false); return }
    const { data, error: err } = await supabase
      .from('tasks')
      .insert({
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        due_date: form.end_date || null,
        phase_id: form.phase_id || null,
        assignee_ids: form.assignee_ids,
        project_id: projectId,
        parent_id: parentId,
        created_by: userId,
      })
      .select()
      .single()
    setSaving(false)
    if (err) {
      setError(getTaskMutationErrorMessage(err.message, 'Impossible de créer la tâche.'))
      return
    }
    await sendTaskNotifications(data.id, projectId, form.title.trim(), form.assignee_ids, appUserIdSet)
    onAdded({ ...(data as any), children: [] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche'}
            </h2>
            {parentId && parentTitle && (
              <p className="mt-0.5 text-xs text-slate-400">
                dans <span className="font-medium text-slate-600">{parentTitle}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="bf-button-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre de la tâche *"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="Description (optionnelle)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none resize-none"
          />

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modèles</p>
              <button
                type="button"
                onClick={() => setShowTemplateSelector(v => !v)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                {showTemplateSelector ? 'Masquer' : 'Utiliser un modèle'}
              </button>
            </div>
            {showTemplateSelector && (
              <TaskTemplateSelector
                projectId={projectId}
                showCreate
                onSelect={applyTemplate}
                onClose={() => setShowTemplateSelector(false)}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
                {creatableStatuses.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Priorité</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de début</label>
              <DateInput
                value={form.start_date}
                onChange={value => setForm(f => ({ ...f, start_date: value }))}
                max={form.end_date || undefined}
                error={form.start_date && form.end_date && form.start_date > form.end_date ? 'Avant la fin' : ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de fin</label>
              <DateInput
                value={form.end_date}
                onChange={value => setForm(f => ({ ...f, end_date: value }))}
                min={form.start_date || undefined}
                error={form.start_date && form.end_date && form.start_date > form.end_date ? 'Après le début' : ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Phase chantier</label>
            <select
              value={form.phase_id}
              onChange={e => setForm(f => ({ ...f, phase_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Aucune phase</option>
              {phases.map(phase => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Personnes assignées
              {form.assignee_ids.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 normal-case">
                  {form.assignee_ids.length} sélectionné{form.assignee_ids.length > 1 ? 's' : ''}
                </span>
              )}
            </label>
            <MemberPicker members={members} selected={form.assignee_ids} onChange={ids => setForm(f => ({ ...f, assignee_ids: ids }))} />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">
              {saving ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Composant récursif : nœud de tâche ──────────────────────────────────────

function TaskNode({
  task,
  depth,
  members,
  currentUserId,
  isManager,
  onDuplicate,
  onDragStartTask,
  onToggleDone,
  onOpenDetail,
}: {
  task: Task
  depth: number
  members: PMember[]
  currentUserId: string
  isManager: boolean
  onDuplicate: (taskId: string) => void
  onDragStartTask: (taskId: string) => void
  onToggleDone: (id: string) => void
  onOpenDetail: (taskId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = task.children.length > 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const endDate = task.end_date ?? task.due_date ?? null
  const isOverdue = endDate && task.status !== 'done' && new Date(endDate) < today
  const pc = PRIORITY_CONFIG[task.priority]
  const isMine = task.assignee_ids.includes(currentUserId)
  const isUnassigned = task.assignee_ids.length === 0
  const lineColor = INDENT_COLORS[Math.min(depth - 1, INDENT_COLORS.length - 1)]
  const cardTone = isOverdue
    ? 'bg-red-50 border-red-200'
    : task.status === 'done'
      ? 'bg-emerald-50 border-emerald-200'
      : task.status === 'in-progress' || task.status === 'review'
        ? 'bg-orange-50 border-orange-200'
        : 'bg-white border-slate-100'

  const assignees = task.assignee_ids
    .map(id => members.find(m => m.id === id))
    .filter((m): m is PMember => m != null)
    .slice(0, 3)

  return (
    <div className={depth > 0 ? `ml-3 border-l-2 pl-2.5 ${lineColor}` : ''}>
      <div
        className={`group mb-1 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer ${cardTone}`}
        onClick={() => onOpenDetail(task.id)}
        draggable={isManager}
        onDragStart={(e) => {
          e.stopPropagation()
          onDragStartTask(task.id)
        }}
      >
        <div className="flex items-start gap-1.5 px-2.5 py-2">
          {/* Checkbox done - action réservée au chef de projet */}
          <button
            type="button"
            disabled={!isManager}
            title={isManager ? undefined : 'Seul le chef de projet peut marquer une tâche comme terminée'}
            onClick={e => { e.stopPropagation(); onToggleDone(task.id) }}
            className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition ${
              task.status === 'done'
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : isManager
                  ? 'border-slate-300 hover:border-indigo-400'
                  : 'border-slate-200 cursor-not-allowed opacity-50'
            }`}
          >
            {task.status === 'done' && <Check className="h-2 w-2" />}
          </button>

          {/* Chevron enfants */}
          {hasChildren ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center text-slate-300 hover:text-slate-500 transition"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 block" />
          )}

          {/* Contenu */}
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium leading-snug ${
              task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
            }`}>
              {task.title}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${pc.color}`}>
                {pc.label}
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${STATUS_STYLE[task.status].ring} ${STATUS_STYLE[task.status].text}`}>
                {STATUS_LABELS[task.status]}
              </span>
              {endDate && (
                <span className={`text-[9px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                  {isOverdue ? '⚠ ' : ''}{new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>

            {/* Date de complétion */}
            {task.status === 'done' && task.completed_at && (
              <p className="mt-0.5 text-[9px] text-emerald-600 font-medium">
                ✓ Terminé le {new Date(task.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(task.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Assignés */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {isMine && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700">
                  Moi
                </span>
              )}
              {isUnassigned ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                  Non assigné
                </span>
              ) : (
                <div className="flex items-center -space-x-1">
                  {assignees.map(m => <MemberAvatar key={m.id} member={m} size="sm" />)}
                  {task.assignee_ids.length > 3 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">
                      +{task.assignee_ids.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isManager && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(task.id) }}
                  className="rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-white transition"
                >
                  Dupliquer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enfants récursifs */}
      {hasChildren && expanded && (
        <div className="mb-1">
          {task.children.map(child => (
            <TaskNode
              key={child.id}
              task={child}
              depth={depth + 1}
              members={members}
              currentUserId={currentUserId}
              isManager={isManager}
              onDuplicate={onDuplicate}
              onDragStartTask={onDragStartTask}
              onToggleDone={onToggleDone}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Utilitaire interne ───────────────────────────────────────────────────────

function resetPhaseIds(tasks: Task[], phaseId: string): Task[] {
  return tasks.map(t => ({
    ...t,
    phase_id: t.phase_id === phaseId ? null : t.phase_id,
    children: resetPhaseIds(t.children, phaseId),
  }))
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ProjectTasks() {
  const { id: projectId } = useParams<{ id: string }>()
  const [rootTasks, setRootTasks] = useState<Task[]>([])
  const [phases, setPhases] = useState<ConstructionPhaseOption[]>([])
  const [members, setMembers] = useState<PMember[]>([])
  const [appUserIdSet, setAppUserIdSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [isManager, setIsManager] = useState(false)
  const [projectOwnerId, setProjectOwnerId] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [recurrenceTaskId, setRecurrenceTaskId] = useState<string | null>(null)
  const [showAddLane, setShowAddLane] = useState(false)
  const [newLaneName, setNewLaneName] = useState('')
  const [addingLane, setAddingLane] = useState(false)
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null)
  const [editingLaneName, setEditingLaneName] = useState('')
  const [savingLaneEdit, setSavingLaneEdit] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<'all' | 'mine' | string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [pageNotice, setPageNotice] = useState('')
  const [laneDeleteConfirmId, setLaneDeleteConfirmId] = useState<string | null>(null)
  const [duplicateTaskId, setDuplicateTaskId] = useState<string | null>(null)
  const [duplicateLaneId, setDuplicateLaneId] = useState<string>('__none__')

  const detailTask = useMemo(() => {
    if (!detailTaskId) return null
    return findTask(rootTasks, detailTaskId) ?? null
  }, [detailTaskId, rootTasks])

  const fetchProjectTasks = useCallback(async (): Promise<Task[]> => {
    if (!projectId) return []
    const { data: tasksData } = await supabase
      .from('tasks')
      .select(TASKS_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    return buildTree((tasksData ?? []) as Omit<Task, 'children'>[])
  }, [projectId])

  useEffect(() => {
    if (!projectId) return

    let cancelled = false

    const loadData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user?.id ?? ''
      if (cancelled) return
      setCurrentUserId(uid)

      // Tâches du projet
      const nextTasks = await fetchProjectTasks()
      if (cancelled) return
      setRootTasks(nextTasks)

      // Membres + rôle de l'utilisateur courant
      const { data: pmRows } = await supabase
        .from('project_members')
        .select('user_id, role')
        .eq('project_id', projectId)

      const pmUserIds: string[] = (pmRows ?? []).map((r: any) => r.user_id)
      const myRole = (pmRows ?? []).find((r: any) => r.user_id === uid)?.role ?? 'member'
      const manager = ['owner', 'admin', 'manager'].includes(myRole)
      if (cancelled) return
      setIsManager(manager)
      const ownerRow = (pmRows ?? []).find((r: any) => r.role === 'owner')
      setProjectOwnerId(ownerRow?.user_id ?? '')

      // Phases comme colonnes Kanban
      const { data: phasesData } = await supabase
        .from('construction_phases')
        .select('id, name')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })

      let effectivePhases = (phasesData ?? []) as ConstructionPhaseOption[]

      // Si aucune colonne n'existe encore, on initialise les colonnes par défaut.
      if (effectivePhases.length === 0 && manager && uid) {
        const defaultNames = ['Commercial', "Bureau d'études", 'Chantier']
        const { data: seededPhases } = await supabase
          .from('construction_phases')
          .insert(
            defaultNames.map((name) => ({
              project_id: projectId,
              created_by: uid,
              name,
              progress_percent: 0,
              allocated_budget: 0,
              spent_budget: 0,
            }))
          )
          .select('id, name')

        effectivePhases = (seededPhases ?? []) as ConstructionPhaseOption[]
      }

      if (cancelled) return
      setPhases(effectivePhases)

      let realMembers: PMember[] = []
      if (pmUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name, color')
          .in('id', pmUserIds)
        realMembers = (profiles ?? []).map((p: any): PMember => ({
          id: p.id,
          name: p.name ?? 'Inconnu',
          initials: initials(p.name ?? '?'),
          color: p.color ?? 'bg-indigo-500',
          isAppUser: true,
        }))
      }

      let virtualMembers: PMember[] = []
      if (uid) {
        const virtuals = await loadVirtualMembers(uid)
        virtualMembers = virtuals.map(v => ({
          id: v.id,
          name: `${v.firstName} ${v.lastName}`,
          initials: `${v.firstName.charAt(0)}${v.lastName.charAt(0)}`.toUpperCase(),
          color: v.color,
          isAppUser: false,
        }))
      }

      setMembers([...realMembers, ...virtualMembers])
      setAppUserIdSet(new Set(pmUserIds))

      const filters = await getUserFilters()
      if (cancelled) return
      setSavedFilters(filters)
      setLoading(false)
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [projectId, fetchProjectTasks])

  const handleTaskAdded = (task: Task) => {
    if (task.parent_id) {
      setRootTasks(prev => addChildToTask(prev, task.parent_id!, task))
    } else {
      setRootTasks(prev => [task, ...prev])
    }
  }

  const toggleDone = async (id: string) => {
    if (!isManager) return  // Seul le chef de projet peut cocher "Terminé"
    const current = findTask(rootTasks, id)?.status
    if (!current) return
    const newStatus: TaskStatus = current === 'done' ? 'review' : 'done'
    if (!canTransitionTaskStatus(current, newStatus, isManager)) return
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null
    const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: completedAt }).eq('id', id)
    if (error) {
      setPageNotice(getTaskMutationErrorMessage(error.message, 'Impossible de changer le statut de la tâche.'))
      return
    }
    setRootTasks(prev => mapTask(prev, id, t => ({ ...t, status: newStatus, completed_at: completedAt })))
    if (projectId) void checkAndExecuteRules(projectId, 'task_status_change', id)
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      console.error('Error deleting task:', error)
      setPageNotice(getTaskMutationErrorMessage(error.message, 'Impossible de supprimer la tâche.'))
      return false
    }
    setRootTasks(prev => filterTask(prev, id))
    return true
  }

  const saveTaskDetail = async (updated: Omit<Task, 'children'>, newlyAssigned: string[], prevStatus: TaskStatus) => {
    if (!canTransitionTaskStatus(prevStatus, updated.status, isManager)) {
      return
    }

    const previous = findTask(rootTasks, updated.id)
    const datesChanged =
      previous?.start_date !== updated.start_date ||
      previous?.end_date !== updated.end_date ||
      previous?.due_date !== updated.due_date

    // Gestion du completed_at
    let completedAt: string | null | undefined = updated.completed_at
    if (updated.status === 'done' && prevStatus !== 'done') {
      completedAt = new Date().toISOString()
      await supabase.from('tasks').update({ completed_at: completedAt }).eq('id', updated.id)
    } else if (updated.status !== 'done' && prevStatus === 'done') {
      completedAt = null
      await supabase.from('tasks').update({ completed_at: null }).eq('id', updated.id)
    }
    setRootTasks(prev => mapTask(prev, updated.id, t => ({ ...t, ...updated, completed_at: completedAt })))

    if (datesChanged) {
      const cascadedUpdates = await recalculateDependentTaskDates(updated.id)
      if (cascadedUpdates.length > 0) {
        const updateMap = new Map(
          cascadedUpdates.map((item) => [
            item.id,
            {
              start_date: item.start_date,
              end_date: item.end_date,
              due_date: item.due_date,
            },
          ])
        )
        setRootTasks(prev => applyCascadedDateUpdates(prev, updateMap))
      }
    }

    if (projectId) void checkAndExecuteRules(projectId, 'task_status_change', updated.id)

    // Notification au PM si passage en revue
    if (updated.status === 'review' && prevStatus !== 'review' && projectOwnerId && projectOwnerId !== currentUserId && projectId) {
      await supabase.from('notifications').insert({
        user_id: projectOwnerId,
        project_id: projectId,
        task_id: updated.id,
        type: 'task_review',
        title: 'Tâche en attente de validation',
        body: `"${updated.title}" est prête pour validation`,
        read: false,
      })
    }

    if (newlyAssigned.length > 0 && projectId) {
      await sendTaskNotifications(updated.id, projectId, updated.title, newlyAssigned, appUserIdSet)
    }
  }

  const reloadTasks = async () => {
    const nextTasks = await fetchProjectTasks()
    setRootTasks(nextTasks)
  }

  const moveTaskToLane = async (taskId: string, laneId: string) => {
    const targetPhaseId = laneId === '__none__' ? null : laneId
    const sourceTask = findTask(rootTasks, taskId)
    if (!sourceTask) return

    const ids = collectSubtreeIds(sourceTask)
    await supabase.from('tasks').update({ phase_id: targetPhaseId }).in('id', ids)
    setRootTasks((prev) => updatePhaseForTaskIds(prev, new Set(ids), targetPhaseId))
  }

  const duplicateTaskTreeToLane = async (taskId: string, laneId: string) => {
    if (!projectId) return
    const sourceTask = findTask(rootTasks, taskId)
    if (!sourceTask) return

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return

    const targetPhaseId = laneId === '__none__' ? null : laneId

    const duplicateRecursive = async (node: Task, parentId: string | null): Promise<void> => {
      const { data: inserted } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          parent_id: parentId,
          title: `${node.title} (copie)`,
          description: node.description,
          status: node.status,
          priority: node.priority,
          start_date: node.start_date,
          end_date: node.end_date,
          due_date: node.due_date ?? null,
          phase_id: targetPhaseId,
          created_by: uid,
          assignee_ids: node.assignee_ids,
          assigned_to: null,
        })
        .select('id')
        .single()

      if (!inserted?.id) return
      for (const child of node.children) {
        await duplicateRecursive(child, inserted.id)
      }
    }

    await duplicateRecursive(sourceTask, null)
    await reloadTasks()
  }

  const handleDuplicate = (taskId: string) => {
    const defaultLane = phases[0]?.id ?? '__none__'
    setDuplicateTaskId(taskId)
    setDuplicateLaneId(defaultLane)
  }

  const confirmDuplicateToLane = async () => {
    if (!duplicateTaskId) return
    await duplicateTaskTreeToLane(duplicateTaskId, duplicateLaneId)
    setDuplicateTaskId(null)
  }

  const addLane = async () => {
    if (!newLaneName.trim() || !projectId) return
    setAddingLane(true)
    const { data } = await supabase
      .from('construction_phases')
      .insert({
        project_id: projectId,
        name: newLaneName.trim(),
        progress_percent: 0,
        allocated_budget: 0,
        spent_budget: 0,
      })
      .select('id, name')
      .single()
    if (data) setPhases(prev => [...prev, data as ConstructionPhaseOption])
    setNewLaneName('')
    setShowAddLane(false)
    setAddingLane(false)
  }

  const startEditLane = (lane: KanbanLane) => {
    setEditingLaneId(lane.id)
    setEditingLaneName(lane.name)
  }

  const cancelEditLane = () => {
    setEditingLaneId(null)
    setEditingLaneName('')
  }

  const saveLaneEdit = async () => {
    if (!editingLaneId || !editingLaneName.trim()) return
    setSavingLaneEdit(true)
    const cleaned = editingLaneName.trim()
    await supabase.from('construction_phases').update({ name: cleaned }).eq('id', editingLaneId)
    setPhases((prev) => prev.map((p) => (p.id === editingLaneId ? { ...p, name: cleaned } : p)))
    setSavingLaneEdit(false)
    cancelEditLane()
  }

  const deleteLane = async (phaseId: string) => {
    const hasTasks = flattenTree(rootTasks).some(t => t.phase_id === phaseId)
    if (hasTasks && laneDeleteConfirmId !== phaseId) {
      setLaneDeleteConfirmId(phaseId)
      setPageNotice('Cette colonne contient des tâches. Cliquez à nouveau sur supprimer pour les déplacer dans « Non classé ».')
      return
    }
    if (hasTasks) {
      await supabase.from('tasks').update({ phase_id: null }).eq('phase_id', phaseId)
      setRootTasks(prev => resetPhaseIds(prev, phaseId))
    }
    await supabase.from('construction_phases').delete().eq('id', phaseId)
    setPhases(prev => prev.filter(p => p.id !== phaseId))
    setLaneDeleteConfirmId(null)
  }

  const totalTasks = useMemo(() => countAll(rootTasks), [rootTasks])
  const doneTasks = useMemo(() => countDone(rootTasks), [rootTasks])

  const allFlat = useMemo(() => flattenTree(rootTasks), [rootTasks])
  const searchNeedle = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

  const roleVisibleIds = useMemo(() => (
    isManager
      ? new Set(allFlat.map((t) => t.id))
      : new Set(allFlat.filter((t) => t.assignee_ids.includes(currentUserId)).map((t) => t.id))
  ), [allFlat, isManager, currentUserId])

  const visibleTaskIds = useMemo(() => {
    if (memberFilter === 'mine') {
      return new Set(
        allFlat
          .filter((t) => roleVisibleIds.has(t.id) && t.assignee_ids.includes(currentUserId))
          .map((t) => t.id)
      )
    }
    if (memberFilter !== 'all') {
      return new Set(
        allFlat
          .filter((t) => roleVisibleIds.has(t.id) && t.assignee_ids.includes(memberFilter))
          .map((t) => t.id)
      )
    }
    return roleVisibleIds
  }, [allFlat, roleVisibleIds, memberFilter, currentUserId])

  const visibleRoots = useMemo(() => {
    const isTaskVisible = (task: Task): boolean => {
      const matchesText =
        searchNeedle.length === 0 ||
        task.title.toLowerCase().includes(searchNeedle) ||
        task.description.toLowerCase().includes(searchNeedle)

      return (visibleTaskIds.has(task.id) && matchesText) || task.children.some((child) => isTaskVisible(child))
    }

    const filterVisible = (tasks: Task[]): Task[] =>
      tasks
        .filter(isTaskVisible)
        .map((t) => ({ ...t, children: filterVisible(t.children) }))

    return filterVisible(rootTasks)
  }, [rootTasks, visibleTaskIds, searchNeedle])

  const visibleCount = useMemo(() => countAll(visibleRoots), [visibleRoots])

  // Colonnes Kanban = phases + « Non classé » si besoin
  const kanbanLanes = useMemo<KanbanLane[]>(() => {
    const lanes: KanbanLane[] = phases.map((p) => ({ id: p.id, name: p.name, isPhase: true }))
    lanes.push({ id: '__none__', name: 'Non classé', isPhase: false })
    return lanes
  }, [phases])

  const listSortedTasks = useMemo(() => {
    const flat = flattenTree(visibleRoots)
    const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    return [...flat].sort((a, b) =>
      (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    )
  }, [visibleRoots])

  if (loading) return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-8 shadow-lg animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="h-3 w-2/3 rounded-lg bg-slate-100 mb-2" />
          <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  )
  if (!projectId) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl bg-white px-5 py-5 shadow-lg sm:px-6 lg:px-8 lg:py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">Tâches du projet</h1>
          {!isManager && (
            <p className="mt-0.5 text-xs text-indigo-500 font-medium">Vue personnelle — vos tâches uniquement</p>
          )}
          {totalTasks > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              {doneTasks}/{totalTasks} terminée{totalTasks > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="lg:hidden flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une tâche"
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer la recherche"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une tâche"
              className="w-48 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterPanel(v => !v)}
              title="Filtres sauvegardés"
              aria-haspopup="dialog"
              aria-expanded={showFilterPanel}
              aria-controls="saved-filters-panel"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                showFilterPanel ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bookmark className="h-4 w-4" />
              {savedFilters.length > 0 && (
                <span className="text-xs font-semibold text-indigo-600">{savedFilters.length}</span>
              )}
            </button>
            {showFilterPanel && (
              <div id="saved-filters-panel" role="dialog" aria-label="Filtres sauvegardés" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Filtres sauvegardés</p>
                {savedFilters.length === 0 && (
                  <p className="text-xs text-slate-400 mb-2">Aucun filtre sauvegardé</p>
                )}
                {savedFilters.map(f => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        const assignee = f.criteria.assignedTo?.[0] ?? 'all'
                        setMemberFilter(assignee)
                        setShowFilterPanel(false)
                      }}
                      className="flex-1 text-left text-sm text-slate-700 hover:text-indigo-600 truncate"
                    >
                      {f.name}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteFilter(f.id)
                        setSavedFilters(prev => prev.filter(x => x.id !== f.id))
                      }}
                      className="ml-2 flex-shrink-0 text-slate-300 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="mt-2 border-t border-slate-100 pt-2">
                  {showSaveInput ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        value={newFilterName}
                        onChange={e => setNewFilterName(e.target.value)}
                        placeholder="Nom du filtre"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newFilterName.trim()) {
                            const criteria: FilterCriteria = { assignedTo: memberFilter === 'all' ? [] : [memberFilter] }
                            const saved = await saveFilter(newFilterName.trim(), criteria)
                            if (saved) setSavedFilters(prev => [...prev, saved])
                            setNewFilterName('')
                            setShowSaveInput(false)
                          }
                          if (e.key === 'Escape') { setShowSaveInput(false); setNewFilterName('') }
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newFilterName.trim()) return
                          const criteria: FilterCriteria = { assignedTo: memberFilter === 'all' ? [] : [memberFilter] }
                          const saved = await saveFilter(newFilterName.trim(), criteria)
                          if (saved) setSavedFilters(prev => [...prev, saved])
                          setNewFilterName('')
                          setShowSaveInput(false)
                        }}
                        className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 transition"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSaveInput(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Sauvegarder le filtre actuel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 sm:w-auto"
          >
            <option value="all">Tout le monde</option>
            <option value="mine">Moi</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {isManager && (
            <button
              type="button"
              onClick={() => { setAddParentId(null); setShowAdd(true) }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </button>
          )}
          {/* Toggle vue */}
          <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Vue Kanban"
              aria-label="Activer la vue Kanban"
              aria-pressed={viewMode === 'kanban'}
              className={`px-2.5 py-2 transition ${viewMode === 'kanban' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            ><LayoutGrid className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Vue Liste"
              aria-label="Activer la vue liste"
              aria-pressed={viewMode === 'list'}
              className={`px-2.5 py-2 transition ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            ><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-slate-500">
          {visibleCount} tâche{visibleCount > 1 ? 's' : ''} visible{visibleCount > 1 ? 's' : ''}
        </p>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Réinitialiser la recherche
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {visibleCount} tâche{visibleCount > 1 ? 's' : ''} visible{visibleCount > 1 ? 's' : ''}
      </p>

      {pageNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <span>{pageNotice}</span>
          <button
            type="button"
            onClick={() => setPageNotice('')}
            className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Légende pour le chef de projet */}
      {isManager && (
        <div className="flex flex-wrap items-center gap-3 px-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Moi</span>
            <span className="text-xs text-slate-500">= vous êtes assigné à cette tâche</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">Non assigné</span>
            <span className="text-xs text-slate-500">= tâche à assigner</span>
          </div>
        </div>
      )}

      {/* Vue Liste */}
      {viewMode === 'list' && (
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Titre</th>
                  <th scope="col" className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Statut</th>
                  <th scope="col" className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Priorité</th>
                  <th scope="col" className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phase</th>
                  <th scope="col" className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Échéance</th>
                  <th scope="col" className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assignés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {listSortedTasks.map(task => {
                  const ss = STATUS_STYLE[task.status]
                  const pp = PRIORITY_CONFIG[task.priority]
                  const phase = phases.find(p => p.id === task.phase_id)
                  const assignees = members.filter(m => task.assignee_ids.includes(m.id))
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setDetailTaskId(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDetailTaskId(task.id)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ouvrir la tâche ${task.title}`}
                      className="cursor-pointer hover:bg-indigo-50/40 transition"
                    >
                      <td className="px-5 py-3 font-medium text-slate-800 max-w-xs truncate">{task.title}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ss.ring} ${ss.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                          {STATUS_LABELS[task.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${pp.color}`}>{pp.label}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{phase?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{task.due_date ?? task.end_date ?? '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex -space-x-1">
                          {assignees.slice(0, 3).map(m => <MemberAvatar key={m.id} member={m} />)}
                          {assignees.length > 3 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">+{assignees.length - 3}</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {listSortedTasks.length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400">Aucune tâche</p>
            )}
          </div>
      )}

      {/* Kanban */}
      {viewMode === 'kanban' && <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanLanes.map(lane => {
          const laneTasks = lane.id === '__none__'
            ? visibleRoots.filter(t => !t.phase_id)
            : visibleRoots.filter(t => t.phase_id === lane.id)
          return (
            <div key={lane.id} className="min-w-[82vw] max-w-[86vw] flex-shrink-0 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:min-w-[260px] sm:max-w-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${lane.isPhase ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                {editingLaneId === lane.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingLaneName}
                    onChange={(e) => setEditingLaneName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveLaneEdit()
                      if (e.key === 'Escape') cancelEditLane()
                    }}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider truncate flex-1">
                    {lane.name}
                  </span>
                )}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 flex-shrink-0">
                  {laneTasks.length}
                </span>
                {isManager && lane.isPhase && (
                  <>
                    {editingLaneId === lane.id ? (
                      <>
                        <button
                          type="button"
                          onClick={saveLaneEdit}
                          disabled={savingLaneEdit || !editingLaneName.trim()}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditLane}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditLane(lane)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
                        title="Renommer la colonne"
                      >
                        Renommer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLane(lane.id)}
                      className={`h-5 w-5 flex-shrink-0 flex items-center justify-center rounded transition ${
                        laneDeleteConfirmId === lane.id
                          ? 'text-red-600 bg-red-100 hover:bg-red-200'
                          : 'text-slate-300 hover:text-red-500'
                      }`}
                      title={laneDeleteConfirmId === lane.id ? 'Confirmer la suppression' : 'Supprimer la colonne'}
                    >
                      {laneDeleteConfirmId === lane.id ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
              <div
                className="space-y-1"
                onDragOver={(e) => {
                  if (isManager) e.preventDefault()
                }}
                onDrop={async () => {
                  if (!isManager || !draggedTaskId) return
                  await moveTaskToLane(draggedTaskId, lane.id)
                  setDraggedTaskId(null)
                }}
              >
                {laneTasks.map(task => (
                  <TaskNode
                    key={task.id}
                    task={task}
                    depth={0}
                    members={members}
                    currentUserId={currentUserId}
                    isManager={isManager}
                    onDuplicate={handleDuplicate}
                    onDragStartTask={setDraggedTaskId}
                    onToggleDone={toggleDone}
                    onOpenDetail={setDetailTaskId}
                  />
                ))}
                {laneTasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-400">Aucune tâche</p>
                  </div>
                )}
                {isManager && (
                  <button
                    type="button"
                    onClick={() => { setAddParentId(null); setShowAdd(true) }}
                    className="w-full mt-1 flex items-center gap-1 justify-center rounded-xl border border-dashed border-slate-200 py-1.5 text-[11px] text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une tâche
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Ajouter une colonne — PM uniquement */}
        {isManager && (
          <div className="min-w-[220px] flex-shrink-0">
            {showAddLane ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newLaneName}
                  onChange={e => setNewLaneName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addLane()
                    if (e.key === 'Escape') { setShowAddLane(false); setNewLaneName('') }
                  }}
                  placeholder="Ex: Bureau d'études…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addLane}
                    disabled={addingLane || !newLaneName.trim()}
                    className="flex-1 rounded-xl bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddLane(false); setNewLaneName('') }}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddLane(true)}
                className="h-full w-full min-h-[80px] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs font-medium">Ajouter une colonne</span>
              </button>
            )}
          </div>
        )}
      </div>}

      {/* Modal création */}
      {showAdd && (
        <AddTaskModal
          projectId={projectId}
          parentId={addParentId}
          parentTitle={addParentId ? findTask(rootTasks, addParentId)?.title : undefined}
          members={members}
          phases={phases}
          isManager={isManager}
          appUserIdSet={appUserIdSet}
          onClose={() => { setShowAdd(false); setAddParentId(null) }}
          onAdded={handleTaskAdded}
        />
      )}

      {/* Modal détail */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          members={members}
          phases={phases}
          isManager={isManager}
          onClose={() => setDetailTaskId(null)}
          onSave={saveTaskDetail}
          onDelete={deleteTask}
          onOpenAddModal={(pid) => { setDetailTaskId(null); setAddParentId(pid); setShowAdd(true) }}
          onOpenRecurrence={setRecurrenceTaskId}
        />
      )}

      {duplicateTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDuplicateTaskId(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">Dupliquer la tâche</h3>
            <p className="mt-1 text-sm text-slate-500">Choisissez la section de destination.</p>
            <select
              value={duplicateLaneId}
              onChange={(e) => setDuplicateLaneId(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
              <option value="__none__">Non classé</option>
            </select>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateTaskId(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDuplicateToLane}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Dupliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {recurrenceTaskId && (
        <RecurrenceModal
          taskId={recurrenceTaskId}
          onClose={() => setRecurrenceTaskId(null)}
        />
      )}
    </div>
  )
}

