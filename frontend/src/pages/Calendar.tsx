import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, User, X, Plus, Eye } from 'lucide-react'
import {
  TeamMember,
  LocalTask,
  getDisplayName,
  getInitials,
  generateId,
} from '../utils/teamStore'
import { loadTasks, persistTask, removeTask, loadAllMembers } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { DateInput } from '../components/DateInput'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // lundi=0
}
const FR_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const FR_DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const STATUS_COLOR: Record<string, string> = {
  todo: 'bg-slate-200 text-slate-700',
  'in-progress': 'bg-amber-100 text-amber-800',
  review: 'bg-blue-100 text-blue-800',
  done: 'bg-emerald-100 text-emerald-800',
}

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-slate-400',
  'in-progress': 'bg-amber-400',
  review: 'bg-blue-400',
  done: 'bg-emerald-400',
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── Event pill ─────────────────────────────────────────────────────────────

function EventPill({
  task,
  grayed,
  onClick,
}: {
  task: LocalTask
  grayed: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 transition-opacity ${
        grayed
          ? 'bg-slate-200 text-slate-400 cursor-default'
          : `${STATUS_COLOR[task.status]} hover:opacity-80`
      }`}
    >
      {grayed ? '— (privé)' : task.title}
    </button>
  )
}

// ─── Add event modal ─────────────────────────────────────────────────────────

function AddEventModal({
  defaultDate,
  members,
  onClose,
  onAdd,
}: {
  defaultDate: string
  members: TeamMember[]
  onClose: () => void
  onAdd: (task: LocalTask) => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as LocalTask['status'],
    priority: 'medium' as LocalTask['priority'],
    assigneeIds: [] as string[],
    dueDate: defaultDate,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Ajouter un événement</h2>
          <button onClick={onClose} className="bf-button-secondary" title="Fermer la fenêtre calendrier" aria-label="Fermer la fenêtre calendrier">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Titre *"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
          <DateInput
            value={form.dueDate}
            onChange={(value) => setForm({ ...form, dueDate: value })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as LocalTask['priority'] })}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          >
            <option value="low">Faible</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="urgent">Urgent</option>
          </select>
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            {members.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500">Aucun membre. Ajoutez-en dans la page Équipe.</p>
            ) : (
              members.map((m) => (
                <label key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assigneeIds.includes(m.id)}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        assigneeIds: e.target.checked
                          ? [...form.assigneeIds, m.id]
                          : form.assigneeIds.filter((x) => x !== m.id),
                      })
                    }}
                    className="rounded accent-indigo-600"
                  />
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${m.color} text-xs font-bold text-white`}>
                    {getInitials(m)}
                  </div>
                  <span className="text-sm text-slate-900">{getDisplayName(m)}</span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="bf-button-secondary">
            Annuler
          </button>
          <button
            disabled={!form.title.trim()}
            onClick={() => {
              onAdd({
                id: generateId(),
                title: form.title.trim(),
                description: form.description,
                status: form.status,
                priority: form.priority,
                assigneeIds: form.assigneeIds,
                startDate: form.dueDate,
                dueDate: form.dueDate,
                subtasks: [],
              })
              onClose()
            }}
            className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
            title="Ajouter l'événement au calendrier"
            aria-label="Ajouter l'événement au calendrier"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const { user, loading: authLoading } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('me')
  const [addModalDate, setAddModalDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<LocalTask | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    Promise.all([loadTasks(user.id), loadAllMembers(user.id)]).then(([dbTasks, allMembers]) => {
      setTasks(dbTasks)
      setMembers(allMembers)
    })
  }, [user?.id, authLoading])

  const persistTasks = (t: LocalTask[]) => { setTasks(t) }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayOffset = getFirstDayOfWeek(currentYear, currentMonth)

  const todayKey = toDateKey(today)

  // tasks indexed by due date
  const tasksByDate = useMemo(() => {
    const map: Record<string, LocalTask[]> = {}
    tasks.forEach((t) => {
      if (t.dueDate) {
        map[t.dueDate] = [...(map[t.dueDate] || []), t]
      }
    })
    return map
  }, [tasks])

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()) }

  const totalCells = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7

  const upcomingTasks = tasks
    .filter((t) => t.dueDate && t.dueDate >= todayKey && t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8)

  const selectedMemberObj = selectedMember !== 'me' ? members.find((m) => m.id === selectedMember) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Calendrier</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Planning & jalons</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* View: me / member */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setSelectedMember('me')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedMember === 'me' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <User className="h-3.5 w-3.5" />
                Mon calendrier
              </button>
              {members.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedMember === 'me' ? '' : selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value || 'me')}
                    className="appearance-none rounded-xl border-0 bg-transparent pr-6 pl-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="">Voir un membre...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{getDisplayName(m)}</option>
                    ))}
                  </select>
                  <Eye className="pointer-events-none absolute right-1 top-2.5 h-3 w-3 text-slate-400" />
                </div>
              )}
            </div>

            <button
              onClick={() => setAddModalDate(todayKey)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Bandeau membre selectionne */}
        {selectedMemberObj && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${selectedMemberObj.color} text-sm font-bold text-white`}>
              {getInitials(selectedMemberObj)}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{getDisplayName(selectedMemberObj)}</p>
              <p className="text-xs text-slate-500">
                Calendrier en lecture seule. Les événements non liés à ce projet sont grisés (vie privée).
              </p>
            </div>
            <button
              onClick={() => setSelectedMember('me')}
              className="ml-auto rounded-xl p-1.5 text-slate-400 hover:bg-indigo-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Calendrier */}
        <div className="rounded-3xl bg-white shadow-lg overflow-hidden">
          {/* Navigation mois */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button onClick={prevMonth} className="bf-button-secondary">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                {FR_MONTHS[currentMonth]} {currentYear}
              </h2>
              <button
                onClick={goToday}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Aujourd'hui
              </button>
            </div>
            <button onClick={nextMonth} className="bf-button-secondary">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* En-tetes jours */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {FR_DAYS_SHORT.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Grille jours */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNumber = idx - firstDayOffset + 1
              const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth
              const dateKey = isCurrentMonth
                ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
                : ''
              const isToday = dateKey === todayKey
              const dayTasks = dateKey ? (tasksByDate[dateKey] || []) : []

              // Filtrer selon le membre selectionne
              const visibleTasks = selectedMember === 'me'
                ? dayTasks
                : dayTasks.filter((t) => t.assigneeIds.includes(selectedMember))
              const grayedTasks = selectedMember !== 'me'
                ? dayTasks.filter((t) => !t.assigneeIds.includes(selectedMember))
                : []

              return (
                <div
                  key={idx}
                  onClick={() => isCurrentMonth && setAddModalDate(dateKey)}
                  className={`min-h-[110px] border-r border-b border-slate-100 p-2 transition cursor-pointer group ${
                    !isCurrentMonth ? 'bg-slate-50/50' : 'hover:bg-indigo-50/30'
                  } ${isToday ? 'bg-indigo-50' : ''}`}
                >
                  {isCurrentMonth && (
                    <>
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700 group-hover:bg-slate-100'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        <Plus className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {visibleTasks.slice(0, 3).map((t) => (
                          <EventPill
                            key={t.id}
                            task={t}
                            grayed={false}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(t) }}
                          />
                        ))}
                        {grayedTasks.slice(0, 2).map((t) => (
                          <EventPill key={t.id} task={t} grayed={true} onClick={() => {}} />
                        ))}
                        {(visibleTasks.length + grayedTasks.length) > 4 && (
                          <p className="text-[9px] text-slate-400 pl-1.5">
                            +{visibleTasks.length + grayedTasks.length - 4} autres
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panneau lateral */}
        <aside className="space-y-5">
          {/* Legende statuts */}
          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Legende</p>
            <div className="space-y-2">
              {Object.entries(STATUS_DOT).map(([key, dot]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  <span className="text-xs text-slate-600 capitalize">
                    {key === 'todo' ? 'A faire' : key === 'in-progress' ? 'En cours' : key === 'review' ? 'En revue' : 'Termine'}
                  </span>
                </div>
              ))}
              {selectedMember !== 'me' && (
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-400">Evenement prive (autre projet)</span>
                </div>
              )}
            </div>
          </div>

          {/* Prochains evenements */}
          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              A venir ({upcomingTasks.length})
            </p>
            {upcomingTasks.length === 0 ? (
              <p className="text-xs text-slate-400">Aucune tache a venir</p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedEvent(t)}
                    className="w-full rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50 hover:border-indigo-200 transition"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(t.dueDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stats mois */}
          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Ce mois ({FR_MONTHS[currentMonth]})
            </p>
            {(() => {
              const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
              const monthTasks = tasks.filter((t) => t.dueDate.startsWith(monthPrefix))
              const done = monthTasks.filter((t) => t.status === 'done').length
              return (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Total</span><span className="font-semibold">{monthTasks.length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Terminees</span><span className="font-semibold text-emerald-600">{done}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>En cours</span>
                    <span className="font-semibold text-amber-600">
                      {monthTasks.filter((t) => t.status === 'in-progress').length}
                    </span>
                  </div>
                  {monthTasks.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.round((done / monthTasks.length) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400 text-right">
                        {Math.round((done / monthTasks.length) * 100)}% complete
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </aside>
      </div>

      {/* Modal ajouter evenement */}
      {addModalDate !== null && (
        <AddEventModal
          defaultDate={addModalDate}
          members={members}
          onClose={() => setAddModalDate(null)}
          onAdd={(t) => {
            persistTasks([...tasks, t])
            if (user) persistTask(t, user.id)
            setAddModalDate(null)
          }}
        />
      )}

      {/* Modal detail event */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900 truncate pr-4">{selectedEvent.title}</h2>
              <button onClick={() => setSelectedEvent(null)} className="bf-button-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[selectedEvent.status]}`}>
                  {selectedEvent.status === 'todo' ? 'A faire' : selectedEvent.status === 'in-progress' ? 'En cours' : selectedEvent.status === 'review' ? 'En revue' : 'Termine'}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(selectedEvent.dueDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              {selectedEvent.description && (
                <p className="text-sm text-slate-600">{selectedEvent.description}</p>
              )}
              {selectedEvent.assigneeIds.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Assignee(s)</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.assigneeIds.map((id) => {
                      const m = members.find((x) => x.id === id)
                      if (!m) return null
                      return (
                        <div key={id} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                          <div className={`h-5 w-5 rounded-full ${m.color} flex items-center justify-center text-[9px] font-bold text-white`}>
                            {getInitials(m)}
                          </div>
                          <span className="text-xs text-slate-700">{getDisplayName(m)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedEvent.subtasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Sous-taches ({selectedEvent.subtasks.filter((s) => s.status === 'done').length}/{selectedEvent.subtasks.length})
                  </p>
                  <div className="space-y-1">
                    {selectedEvent.subtasks.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'done' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        <span className={s.status === 'done' ? 'line-through text-slate-400' : ''}>{s.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => {
                  persistTasks(tasks.filter((t) => t.id !== selectedEvent.id))
                  removeTask(selectedEvent.id)
                  setSelectedEvent(null)
                }}
                className="w-full rounded-2xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Supprimer cet evenement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
