import { useState, useEffect, useRef, useMemo } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import { Plus, ChevronRight, ChevronDown, X, Check, Trash2, Flag, User, Lock, Link2, Network, Pencil, List } from 'lucide-react'
import {
  TeamMember,
  LocalTask,
  SubTask,
  getDisplayName,
  getInitials,
  generateId,
} from '../utils/teamStore'
import { loadTasks, persistTask, removeTask, loadAllMembers, addTaskDependencyDb, removeTaskDependencyDb } from '../lib/db'
import { DateInput } from '../components/DateInput'
import { useAuth } from '../context/AuthContext'

type Lane = { id: LocalTask['status']; label: string; dot: string; bg: string; border: string }

const LANES: Lane[] = [
  { id: 'todo', label: 'À faire', dot: 'bg-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
  { id: 'in-progress', label: 'En cours', dot: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'review', label: 'En revue', dot: 'bg-blue-400', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'done', label: 'Terminé', dot: 'bg-emerald-400', bg: 'bg-emerald-50', border: 'border-emerald-100' },
]

const PRIORITY_CONFIG = {
  low: { label: 'Faible', color: 'text-slate-500 bg-slate-100' },
  medium: { label: 'Moyen', color: 'text-amber-700 bg-amber-100' },
  high: { label: 'Élevé', color: 'text-orange-700 bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-700 bg-red-100' },
}

const LANE_CONFIG: Record<LocalTask['status'], { label: string; dot: string }> = {
  'todo': { label: 'À faire', dot: 'bg-slate-400' },
  'in-progress': { label: 'En cours', dot: 'bg-amber-400' },
  'review': { label: 'En revue', dot: 'bg-blue-400' },
  'done': { label: 'Terminé', dot: 'bg-emerald-400' },
}

// ─── Utilitaires arborescence ────────────────────────────────────────────────

type TaskNode = LocalTask & { children: TaskNode[] }

function buildTaskTree(tasks: LocalTask[]): TaskNode[] {
  const map = new Map<string, TaskNode>(tasks.map((t) => [t.id, { ...t, children: [] }]))
  const roots: TaskNode[] = []
  map.forEach((node) => {
    if (node.parent_id) {
      const parent = map.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function flattenTaskRows(nodes: TaskNode[], depth = 0): Array<{ task: LocalTask; depth: number }> {
  return nodes.flatMap((node) => [
    { task: node, depth },
    ...flattenTaskRows(node.children, depth + 1),
  ])
}

function AvatarGroup({ ids, members, max = 3 }: { ids: string[]; members: TeamMember[]; max?: number }) {
  const assigned = ids.map((id) => members.find((m) => m.id === id)).filter(Boolean) as TeamMember[]
  if (assigned.length === 0) return null
  return (
    <div className="flex -space-x-1.5">
      {assigned.slice(0, max).map((m) => (
        <div
          key={m.id}
          title={getDisplayName(m)}
          className={`flex h-6 w-6 items-center justify-center rounded-full ${m.color} text-[9px] font-bold text-white ring-2 ring-white`}
        >
          {getInitials(m)}
        </div>
      ))}
      {assigned.length > max && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[9px] font-bold text-slate-700 ring-2 ring-white">
          +{assigned.length - max}
        </div>
      )}
    </div>
  )
}

function AssigneePicker({
  selected,
  onChange,
  members,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  members: TeamMember[]
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  return (
    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      {members.length === 0 && (
        <p className="px-4 py-3 text-xs text-slate-500">
          Aucun membre. Ajoutez des membres dans l'équipe.
        </p>
      )}
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => toggle(m.id)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition"
        >
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${m.color} text-xs font-bold text-white flex-shrink-0`}>
            {getInitials(m)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{getDisplayName(m)}</p>
          </div>
          {selected.includes(m.id) && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
        </button>
      ))}
    </div>
  )
}

function SubtaskRow({
  subtask,
  members,
  onToggle,
  onDelete,
}: {
  subtask: SubTask
  members: TeamMember[]
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-start gap-2 pl-6 pr-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
          subtask.status === 'done'
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-slate-300 hover:border-indigo-400'
        }`}
      >
        {subtask.status === 'done' && <Check className="h-2.5 w-2.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-xs leading-5 ${subtask.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {subtask.title}
        </p>
        {subtask.assigneeIds.length > 0 && (
          <AvatarGroup ids={subtask.assigneeIds} members={members} max={2} />
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="hidden group-hover:flex items-center justify-center h-5 w-5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function AddSubtaskRow({
  members,
  onAdd,
}: {
  members: TeamMember[]
  onAdd: (title: string, assigneeIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const subPickerRef = useRef<HTMLDivElement>(null)
  useClickOutside(subPickerRef, () => setPickerOpen(false), pickerOpen)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 pl-6 pr-2 py-1 text-xs text-slate-400 hover:text-indigo-600 transition"
      >
        <Plus className="h-3 w-3" />
        Sous-tâche
      </button>
    )
  }

  return (
    <div className="pl-6 pr-2 pb-2 space-y-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim(), assigneeIds)
            setTitle('')
            setAssigneeIds([])
            setOpen(false)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Titre de la sous-tâche..."
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
      />
      <div className="flex items-center gap-2">
        <div ref={subPickerRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            <User className="h-3 w-3" />
            {assigneeIds.length === 0 ? 'Assigner' : `${assigneeIds.length} sélectionné(s)`}
          </button>
          {pickerOpen && (
            <div className="absolute bottom-8 left-0 z-50 w-60">
              <AssigneePicker
                selected={assigneeIds}
                onChange={setAssigneeIds}
                members={members}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!title.trim()}
          onClick={() => {
            if (title.trim()) {
              onAdd(title.trim(), assigneeIds)
              setTitle('')
              setAssigneeIds([])
              setOpen(false)
            }
          }}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function TaskCard({
  task,
  members,
  allTasks,
  onUpdate,
  onDelete,
}: {
  task: LocalTask
  members: TeamMember[]
  allTasks: LocalTask[]
  onUpdate: (updated: LocalTask) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const assignPickerRef = useRef<HTMLDivElement>(null)
  useClickOutside(assignPickerRef, () => setShowAssignPicker(false), showAssignPicker)

  const completedSubs = task.subtasks.filter((s) => s.status === 'done').length
  const isBlocked = (task.dependsOn ?? []).some((depId) => {
    const dep = allTasks.find((t) => t.id === depId)
    return dep && dep.status !== 'done'
  })
  const parentTask = task.parent_id ? allTasks.find((t) => t.id === task.parent_id) : null

  const addSubtask = (title: string, assigneeIds: string[]) => {
    const newSub: SubTask = { id: generateId(), title, status: 'todo', assigneeIds }
    onUpdate({ ...task, subtasks: [...task.subtasks, newSub] })
  }

  const toggleSubtask = (subId: string) => {
    onUpdate({
      ...task,
      subtasks: task.subtasks.map((s) =>
        s.id === subId ? { ...s, status: s.status === 'done' ? 'todo' : 'done' } : s
      ),
    })
  }

  const deleteSubtask = (subId: string) => {
    onUpdate({ ...task, subtasks: task.subtasks.filter((s) => s.id !== subId) })
  }

  return (
    <div className={`group rounded-2xl border bg-white shadow-sm hover:shadow-md transition ${isBlocked ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-indigo-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {isBlocked && <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-5">{task.title}</p>
              {parentTask && (
                <p className="mt-0.5 text-[10px] text-slate-400 truncate">↑ {parentTask.title}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="hidden group-hover:flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {task.description && (
          <p className="mt-1 text-xs text-slate-500 leading-4 line-clamp-2">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_CONFIG[task.priority].color}`}>
            <Flag className="h-2.5 w-2.5" />
            {PRIORITY_CONFIG[task.priority].label}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-slate-400">
              {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div ref={assignPickerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAssignPicker((v) => !v)}
              className="flex items-center gap-1"
            >
              {task.assigneeIds.length > 0 ? (
                <AvatarGroup ids={task.assigneeIds} members={members} />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 hover:border-indigo-400 transition">
                  <User className="h-3 w-3 text-slate-400" />
                </div>
              )}
            </button>
            {showAssignPicker && (
              <div className="absolute bottom-8 left-0 z-50 w-64">
                <AssigneePicker
                  selected={task.assigneeIds}
                  onChange={(ids) => {
                    onUpdate({ ...task, assigneeIds: ids })
                    setShowAssignPicker(false)
                  }}
                  members={members}
                />
              </div>
            )}
          </div>

          {task.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {completedSubs}/{task.subtasks.length}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 py-1">
          {task.subtasks.map((sub) => (
            <SubtaskRow
              key={sub.id}
              subtask={sub}
              members={members}
              onToggle={() => toggleSubtask(sub.id)}
              onDelete={() => deleteSubtask(sub.id)}
            />
          ))}
        </div>
      )}

      <div className={`${expanded || task.subtasks.length === 0 ? '' : 'border-t border-slate-100'} rounded-b-2xl`}>
        <AddSubtaskRow members={members} onAdd={addSubtask} />
      </div>
    </div>
  )
}

type ModalMode = null | 'add-task'

// ─── Vue arborescence ─────────────────────────────────────────────────────────

interface TaskTreeRowProps {
  node: TaskNode
  depth: number
  allTasks: LocalTask[]
  members: TeamMember[]
  expanded: boolean
  onToggle: () => void
  onUpdate: (t: LocalTask) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onAddDep: (taskId: string) => void
  onRemoveDep: (taskId: string, depId: string) => void
  expandedIds: Set<string>
  onToggleId: (id: string) => void
}

function TaskTreeRow({
  node,
  depth,
  allTasks,
  members,
  onUpdate,
  onDelete,
  onAddChild,
  onAddDep,
  onRemoveDep,
  expandedIds,
  onToggleId,
}: TaskTreeRowProps) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const lane = LANE_CONFIG[node.status]
  const priority = PRIORITY_CONFIG[node.priority]
  const isBlocked = (node.dependsOn ?? []).some((depId) => {
    const dep = allTasks.find((t) => t.id === depId)
    return dep && dep.status !== 'done'
  })

  return (
    <div>
      <div
        className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 hover:shadow-sm transition ${
          isBlocked ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
        style={{ marginLeft: `${depth * 28}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => onToggleId(node.id)}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-400 transition ${
            hasChildren || (node.dependsOn?.length ?? 0) > 0
              ? 'hover:bg-slate-100 hover:text-slate-700 cursor-pointer'
              : 'cursor-default'
          }`}
        >
          {hasChildren || (node.dependsOn?.length ?? 0) > 0 ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 block" />
          )}
        </button>

        {/* Status dot */}
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${lane.dot}`} title={lane.label} />

        {/* Lock icon */}
        {isBlocked && <Lock className="h-3.5 w-3.5 flex-shrink-0 text-red-400" aria-label="Tâche bloquée" />}

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-5 ${isBlocked ? 'text-slate-600' : 'text-slate-900'}`}>
            {node.title}
          </p>
          {node.description && (
            <p className="text-xs text-slate-400 truncate max-w-sm">{node.description}</p>
          )}
        </div>

        {/* Badges */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.color}`}>
            <Flag className="h-2.5 w-2.5" />
            {priority.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            node.status === 'done' ? 'bg-emerald-100 text-emerald-700'
            : node.status === 'in-progress' ? 'bg-amber-100 text-amber-700'
            : node.status === 'review' ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-100 text-slate-600'
          }`}>
            {lane.label}
          </span>
          {node.dueDate && (
            <span className="text-[10px] text-slate-400">
              {new Date(node.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {node.children.length > 0 && (
            <span className="text-[10px] text-slate-400">{node.children.length} enfant{node.children.length > 1 ? 's' : ''}</span>
          )}
          {(node.dependsOn?.length ?? 0) > 0 && (
            <span className="text-[10px] text-slate-400">{node.dependsOn!.length} dép.</span>
          )}
        </div>

        {/* Actions (hover) */}
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            title="Ajouter une tâche enfant"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onAddDep(node.id)}
            title="Ajouter une dépendance"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            title="Supprimer"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Panel dépliable : dépendances + enfants */}
      {isExpanded && (
        <div style={{ marginLeft: `${depth * 28 + 16}px` }}>
          {/* Dépendances */}
          {(node.dependsOn?.length ?? 0) > 0 && (
            <div className="mt-1 mb-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Bloqué par
              </p>
              <div className="space-y-1.5">
                {node.dependsOn!.map((depId) => {
                  const dep = allTasks.find((t) => t.id === depId)
                  if (!dep) return null
                  const depLane = LANE_CONFIG[dep.status]
                  return (
                    <div key={depId} className="flex items-center gap-2">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${depLane.dot}`} />
                      <span className={`text-xs flex-1 ${dep.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {dep.title}
                      </span>
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${dep.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {depLane.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveDep(node.id, depId)}
                        className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tâches enfants */}
          {node.children.map((child) => (
            <TaskTreeRow
              key={child.id}
              node={child}
              depth={0}
              allTasks={allTasks}
              members={members}
              expanded={expandedIds.has(child.id)}
              onToggle={() => onToggleId(child.id)}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onAddDep={onAddDep}
              onRemoveDep={onRemoveDep}
              expandedIds={expandedIds}
              onToggleId={onToggleId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sélecteur de dépendance ─────────────────────────────────────────────────

function DependencyPicker({
  sourceTaskId,
  allTasks,
  onAdd,
  onClose,
}: {
  sourceTaskId: string
  allTasks: LocalTask[]
  onAdd: (targetId: string) => void
  onClose: () => void
}) {
  const sourceTask = allTasks.find((t) => t.id === sourceTaskId)
  const available = allTasks.filter(
    (t) =>
      t.id !== sourceTaskId &&
      !(sourceTask?.dependsOn ?? []).includes(t.id)
  )
  const [search, setSearch] = useState('')
  const filtered = available.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ajouter une dépendance</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              "{sourceTask?.title}" sera bloqué jusqu'à la fin de la tâche sélectionnée.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une tâche..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none mb-3"
        />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">Aucune tâche disponible</p>
          )}
          {filtered.map((t) => {
            const lane = LANE_CONFIG[t.status]
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { onAdd(t.id); onClose() }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-indigo-50 transition"
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${lane.dot}`} />
                <span className="flex-1 text-sm text-slate-900">{t.title}</span>
                <span className="text-[10px] text-slate-400">{lane.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const { user, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'tree' | 'list'>('kanban')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [depPickerFor, setDepPickerFor] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as LocalTask['status'],
    priority: 'medium' as LocalTask['priority'],
    assigneeIds: [] as string[],
    startDate: '',
    dueDate: '',
    parent_id: null as string | null,
  })
  const [showFormPicker, setShowFormPicker] = useState(false)
  const formPickerRef = useRef<HTMLDivElement>(null)
  useClickOutside(formPickerRef, () => setShowFormPicker(false), showFormPicker)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    Promise.all([loadTasks(user.id), loadAllMembers(user.id)]).then(([dbTasks, allMembers]) => {
      setTasks(dbTasks)
      setMembers(allMembers)
      setLoading(false)
    })
  }, [user?.id, authLoading])

  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks])
  const flatRows = useMemo(() => flattenTaskRows(taskTree), [taskTree])

  const addDependency = async (sourceId: string, targetId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === sourceId ? { ...t, dependsOn: [...(t.dependsOn ?? []), targetId] } : t
      )
    )
    await addTaskDependencyDb(sourceId, targetId)
  }

  const removeDependency = async (sourceId: string, targetId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === sourceId ? { ...t, dependsOn: (t.dependsOn ?? []).filter((id) => id !== targetId) } : t
      )
    )
    await removeTaskDependencyDb(sourceId, targetId)
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const syncTask = (updated: LocalTask) => {
    if (user) persistTask(updated, user.id)
  }

  const persistTasks = (updated: LocalTask[]) => {
    setTasks(updated)
  }

  const updateTask = (updated: LocalTask) => {
    persistTasks(tasks.map((t) => (t.id === updated.id ? updated : t)))
    syncTask(updated)
  }

  const deleteTask = (id: string) => {
    persistTasks(tasks.filter((t) => t.id !== id))
    removeTask(id)
  }

  const addTask = () => {
    if (!form.title.trim() || !user) return
    if (form.startDate && form.dueDate && form.startDate > form.dueDate) {
      setPageNotice('La date de début doit être antérieure à la date de fin')
      return
    }
    const task: LocalTask = {
      id: generateId(),
      title: form.title.trim(),
      description: form.description,
      status: form.status,
      priority: form.priority,
      assigneeIds: form.assigneeIds,
      startDate: form.startDate,
      dueDate: form.dueDate,
      subtasks: [],
      parent_id: form.parent_id ?? null,
      dependsOn: [],
    }
    persistTasks([...tasks, task])
    persistTask(task, user.id)
    setPageNotice('')
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', assigneeIds: [], startDate: '', dueDate: '', parent_id: null })
    setModal(null)
  }

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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gestion des taches</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {viewMode === 'kanban' ? 'Tableau Kanban' : viewMode === 'tree' ? 'Vue arborescence' : 'Vue liste'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Organisez les taches par statut. Chaque tache peut avoir des sous-taches assignees aux membres.
            </p>
          </div>
          <button
            onClick={() => setModal('add-task')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            <Plus className="h-4 w-4" />
            Nouvelle tache
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'kanban' ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'tree' ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            Arborescence
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'list' ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Liste
          </button>
        </div>
      </section>

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

      {/* Sélecteur de dépendance */}
      {depPickerFor && (
        <DependencyPicker
          sourceTaskId={depPickerFor}
          allTasks={tasks}
          onAdd={(targetId) => addDependency(depPickerFor, targetId)}
          onClose={() => setDepPickerFor(null)}
        />
      )}

      {/* Légende des statuts */}
      {viewMode === 'kanban' && (
        <section className="rounded-3xl bg-white p-6 shadow-lg" >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Légende des statuts</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LANES.filter(l => l.id !== 'done').map((lane) => (
              <div key={lane.id} className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${lane.dot}`} title={lane.label} />
                <span className="text-sm text-slate-700">{lane.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400" title="Terminé" />
              <span className="text-sm text-slate-700">Terminé</span>
            </div>
          </div>
        </section>
      )}

      {/* Vue Kanban */}
      {viewMode === 'kanban' && (
        <>
          <section className="grid gap-5 lg:grid-cols-4">
            {LANES.filter(l => l.id !== 'done').map((lane) => {
              const laneTasks = tasks.filter((t) => t.status === lane.id)
              return (
                <div key={lane.id} className={`rounded-3xl ${lane.bg} border ${lane.border} p-5 space-y-4`}>
                  <div className="group flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${lane.dot}`} />
                      <h2 className="text-sm font-semibold text-slate-900">{lane.label}</h2>
                      <button
                        type="button"
                        className="hidden group-hover:flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                        title="Éditer le nom de la zone"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
                      {laneTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {laneTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        allTasks={tasks}
                        members={members}
                        onUpdate={updateTask}
                        onDelete={() => deleteTask(task.id)}
                      />
                    ))}
                  </div>

                  {laneTasks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center">
                      <p className="text-xs text-slate-400">Aucune tache</p>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {/* Section tâches terminées réductible */}
          {(() => {
            const doneTasks = tasks.filter(t => t.status === 'done')
            return doneTasks.length > 0 ? (
              <section className="rounded-3xl bg-white border border-slate-200 shadow-lg">
                <button
                  onClick={() => setExpandedIds(prev => {
                    const next = new Set(prev)
                    if (next.has('done-section')) next.delete('done-section')
                    else next.add('done-section')
                    return next
                  })}
                  className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {expandedIds.has('done-section') ? (
                      <ChevronDown className="h-5 w-5 text-slate-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-600" />
                    )}
                    <h2 className="text-sm font-semibold text-slate-900">Tâches terminées</h2>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {doneTasks.length}
                    </span>
                  </div>
                </button>

                {expandedIds.has('done-section') && (
                  <div className="grid gap-5  lg:grid-cols-4 border-t border-slate-200 p-6">
                    {Array.from({ length: Math.ceil(doneTasks.length / Math.ceil(doneTasks.length / 4) || 1) }).map((_, colIdx) => (
                      <div key={colIdx} className="space-y-3">
                        {doneTasks.slice(colIdx * Math.ceil(doneTasks.length / 4), (colIdx + 1) * Math.ceil(doneTasks.length / 4)).map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            allTasks={tasks}
                            members={members}
                            onUpdate={updateTask}
                            onDelete={() => deleteTask(task.id)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null
          })()}
        </>
      )}

      {/* Vue Arborescence */}
      {viewMode === 'tree' && (
        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Arborescence des tâches</h2>
              <p className="mt-1 text-xs text-slate-400">
                {tasks.length} tâche{tasks.length > 1 ? 's' : ''} · hover pour ajouter une tâche enfant ou une dépendance
              </p>
            </div>
          </div>
          {taskTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 mb-4">
                <Network className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">Aucune tâche</p>
              <p className="mt-1 text-sm text-slate-500">Crée ta première tâche pour construire l'arborescence.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {taskTree.map((node) => (
                <TaskTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  allTasks={tasks}
                  members={members}
                  expanded={expandedIds.has(node.id)}
                  onToggle={() => toggleExpanded(node.id)}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                  onAddChild={(parentId) => {
                    setForm((f) => ({ ...f, parent_id: parentId }))
                    setModal('add-task')
                  }}
                  onAddDep={(taskId) => setDepPickerFor(taskId)}
                  onRemoveDep={removeDependency}
                  expandedIds={expandedIds}
                  onToggleId={toggleExpanded}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Vue Liste */}
      {viewMode === 'list' && (
        <section className="rounded-3xl bg-white p-5 shadow-lg sm:p-6">
          {flatRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 mb-4">
                <List className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">Aucune tâche</p>
              <p className="mt-1 text-sm text-slate-500">Crée ta première tâche pour démarrer la vue liste.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 font-semibold">Tâche</th>
                    <th className="px-3 py-3 font-semibold">Statut</th>
                    <th className="px-3 py-3 font-semibold">Priorité</th>
                    <th className="px-3 py-3 font-semibold">Assignés</th>
                    <th className="px-3 py-3 font-semibold">Échéance</th>
                    <th className="px-3 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flatRows.map(({ task, depth }) => {
                    const lane = LANE_CONFIG[task.status]
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-3">
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${depth * 14}px` }}
                          >
                            <span className={`h-2 w-2 rounded-full ${lane.dot}`} />
                            <span className="text-sm font-medium text-slate-900">{task.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={task.status}
                            onChange={(e) => updateTask({ ...task, status: e.target.value as LocalTask['status'] })}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                          >
                            {LANES.map((laneOption) => (
                              <option key={laneOption.id} value={laneOption.id}>{laneOption.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_CONFIG[task.priority].color}`}>
                            {PRIORITY_CONFIG[task.priority].label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {task.assigneeIds.length > 0 ? (
                            <AvatarGroup ids={task.assigneeIds} members={members} max={4} />
                          ) : (
                            <span className="text-xs text-slate-400">Non assignée</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="Supprimer la tâche"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modal === 'add-task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Nouvelle tache</h2>
              <button
                onClick={() => { setModal(null); setForm((f) => ({ ...f, parent_id: null })) }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                {form.parent_id && (
                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700 mb-4">
                    <Network className="h-3.5 w-3.5 flex-shrink-0" />
                    Tâche enfant de :&nbsp;<span className="font-semibold">{tasks.find((t) => t.id === form.parent_id)?.title}</span>
                  </div>
                )}
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Titre *
                </label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Titre de la tache..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Description optionnelle..."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Statut
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as LocalTask['status'] })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {LANES.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Priorite
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as LocalTask['priority'] })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {(Object.keys(PRIORITY_CONFIG) as Array<keyof typeof PRIORITY_CONFIG>).map((k) => (
                      <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Echeance
                </label>
                <DateInput
                  value={form.dueDate}
                  onChange={(value) => setForm({ ...form, dueDate: value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Début
                  </label>
                  <DateInput
                    value={form.startDate}
                    onChange={(value) => setForm({ ...form, startDate: value })}
                    max={form.dueDate || undefined}
                    error={form.startDate && form.dueDate && form.startDate > form.dueDate ? 'Avant la fin' : ''}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Échéance
                  </label>
                  <DateInput
                    value={form.dueDate}
                    onChange={(value) => setForm({ ...form, dueDate: value })}
                    min={form.startDate || undefined}
                    error={form.startDate && form.dueDate && form.startDate > form.dueDate ? 'Après le début' : ''}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Assignees
                </label>
                <div ref={formPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFormPicker((v) => !v)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-white transition"
                  >
                    {form.assigneeIds.length > 0 ? (
                      <AvatarGroup ids={form.assigneeIds} members={members} max={5} />
                    ) : (
                      <>
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-400">Selectionner des membres</span>
                      </>
                    )}
                  </button>
                  {showFormPicker && (
                    <div className="absolute bottom-14 left-0 z-10 w-full">
                      <AssigneePicker
                        selected={form.assigneeIds}
                        onChange={(ids) => setForm({ ...form, assigneeIds: ids })}
                        members={members}
                      />
                    </div>
                  )}
                </div>
                {members.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Ajoutez des membres dans la page Equipe pour pouvoir les assigner.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => { setModal(null); setForm((f) => ({ ...f, parent_id: null })) }}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!form.title.trim()}
                onClick={addTask}
                className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
              >
                Creer la tache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
