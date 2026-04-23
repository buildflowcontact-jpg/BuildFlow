// Shared team member store — types & UI helpers only (persistence via db.ts)

export const MEMBER_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-pink-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-cyan-500',
]

export type AppMember = {
  id: string
  name: string
  email: string
  type: 'app'
  color: string
}

export type VirtualMember = {
  id: string
  firstName: string
  lastName: string
  position: string
  company: string
  email?: string
  type: 'virtual'
  color: string
  projectId?: string | null
  linkedUserId?: string | null
  isFavorite?: boolean
  sourceFavoriteId?: string | null
}

export type TeamMember = AppMember | VirtualMember

export function getDisplayName(m: TeamMember): string {
  return m.type === 'virtual' ? `${m.firstName} ${m.lastName}` : m.name
}

export function getInitials(m: TeamMember): string {
  if (m.type === 'virtual') {
    return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase()
  }
  const parts = m.name.trim().split(' ')
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : m.name.charAt(0).toUpperCase()
}

export function getSubtitle(m: TeamMember): string {
  if (m.type === 'virtual') {
    const parts = [m.position, m.company, m.email].filter(Boolean)
    return parts.join(' · ')
  }
  return m.email
}

export function pickColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}

// Task types
export type SubTask = {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  assigneeIds: string[]
}

export type LocalTask = {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeIds: string[]
  subtasks: SubTask[]
  startDate: string
  dueDate: string
  parent_id?: string | null
  dependsOn?: string[]  // IDs des tâches qui bloquent celle-ci
}

export function generateId(): string {
  return crypto.randomUUID()
}
