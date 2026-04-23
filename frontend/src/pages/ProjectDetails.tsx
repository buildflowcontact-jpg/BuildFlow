import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Settings, CheckCircle2, Circle, Clock, Eye, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { loadProject, type DbProject } from '../lib/db'
import { ProjectActionsModal } from '../components/ProjectActionsModal'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Terminé', className: 'bg-blue-100 text-blue-700' },
  'on-hold': { label: 'En pause', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
}

const TASK_STATUS = {
  todo:        { label: 'À faire',   icon: Circle,       color: 'text-slate-500',  dot: 'bg-slate-400' },
  'in-progress': { label: 'En cours', icon: Clock,       color: 'text-amber-600',  dot: 'bg-amber-400' },
  review:      { label: 'En revue',  icon: Eye,          color: 'text-blue-600',   dot: 'bg-blue-400' },
  done:        { label: 'Terminé',   icon: CheckCircle2, color: 'text-emerald-600',dot: 'bg-emerald-400' },
}

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

type DbTask = { id: string; title: string; status: string; priority: string; due_date: string | null }

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [project, setProject] = useState<DbProject | null>(null)
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!id) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const userId = data.session?.user?.id
      if (!userId) {
        setLoadError('Non authentifié')
        setLoading(false)
        return
      }
      const [result, { data: tasksData }] = await Promise.all([
        loadProject(id),
        supabase.from('tasks').select('id, title, status, priority, due_date').eq('project_id', id).order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (!result) setLoadError('Projet non trouvé')
      else setProject(result)
      setTasks((tasksData ?? []) as DbTask[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <div className="bf-surface p-8 text-red-600">
        Erreur : ID du projet manquant
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bf-surface p-5 sm:p-6 lg:p-8">
        Chargement du projet...
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="bf-surface p-5 text-red-600 sm:p-6 lg:p-8">
        {loadError || 'Projet non trouvé'}
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section aria-labelledby="project-details-title" className="bf-surface p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Détails du projet</p>
            <h1 id="project-details-title" className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">{project.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{project.description || 'Aucune description'}</p>
          </div>
          <div className="space-y-3 text-left lg:text-right">
            <p className="text-sm text-slate-500">Statut</p>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${STATUS_LABELS[project.status]?.className ?? 'bg-slate-100 text-slate-700'}`}>
                {STATUS_LABELS[project.status]?.label ?? project.status}
              </span>
          <button
            onClick={() => setShowActionsModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          <div className="bf-panel-muted p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Budget</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">€{project.budget ? Number(project.budget).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '0'}</p>
          </div>
          <div className="bf-panel-muted p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Tâches</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{tasks.length}</p>
            <p className="mt-2 text-xs text-slate-500">{tasks.filter(t => t.status === 'done').length} terminée(s)</p>
          </div>
          <div className="bf-panel-muted p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">En retard</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{(() => {
              const today = new Date(); today.setHours(0,0,0,0)
              return tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today).length
            })()}</p>
          </div>
          <div className="bf-panel-muted p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">En revue</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{tasks.filter(t => t.status === 'review').length}</p>
          </div>
        </div>

        {(project.start_date || project.end_date) && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {project.start_date && (
              <div className="bf-panel-muted p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Date de début</p>
                <p className="mt-4 text-xl font-semibold text-slate-900">{new Date(project.start_date).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {project.end_date && (
              <div className="bf-panel-muted p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Date de fin</p>
                <p className="mt-4 text-xl font-semibold text-slate-900">{new Date(project.end_date).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="bf-surface p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Tâches du projet</h2>
              <p className="mt-1 text-sm text-slate-500">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''} au total</p>
            </div>
            <Link
              to={`/projects/${id}/tasks`}
              className="bf-button-primary"
            >
              Gérer les tâches
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-slate-200" />
              <p className="mt-4 font-semibold text-slate-500">Aucune tâche pour ce projet</p>
              <Link to={`/projects/${id}/tasks`} className="mt-3 text-sm text-indigo-600 hover:underline">
                Créer la première tâche →
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {tasks.map((task) => {
                const s = TASK_STATUS[task.status as keyof typeof TASK_STATUS] ?? TASK_STATUS.todo
                const Icon = s.icon
                const today = new Date(); today.setHours(0,0,0,0)
                const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < today
                return (
                  <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-slate-200 transition sm:flex-nowrap sm:gap-3">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${s.color}`} />
                    <p className={`w-full text-sm font-medium sm:flex-1 sm:truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}>
                        {task.priority === 'urgent' ? 'Urgent' : task.priority === 'high' ? 'Élevé' : task.priority === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                      <span className={`hidden sm:block text-xs font-medium ${s.color}`}>{s.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)}%` }}
              />
            </div>
          )}
          {tasks.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {tasks.filter(t => t.status === 'done').length} / {tasks.length} terminée{tasks.filter(t => t.status === 'done').length !== 1 ? 's' : ''}
              {' '}({Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)}%)
            </p>
          )}
        </div>

        <aside className="bf-surface space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="bf-panel-muted p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Récapitulatif</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold">Statut :</span> {STATUS_LABELS[project.status]?.label ?? project.status}
              </p>
              <p>
                <span className="font-semibold">Budget :</span> €{project.budget ? Number(project.budget).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '0'}
              </p>
              <p>
                <span className="font-semibold">Tâches :</span> {tasks.length}
              </p>
              <p>
                <span className="font-semibold">Terminées :</span> {tasks.filter(t => t.status === 'done').length} ({tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%)
              </p>
              <p>
                <span className="font-semibold">En retard :</span> {(() => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  return tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today).length
                })()}
              </p>
              <p>
                <span className="font-semibold">En revue :</span> {tasks.filter(t => t.status === 'review').length}
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-6">
            <Link to="/projects" className="bf-button-primary w-full">
              ← Retour aux projets
            </Link>
          </div>
        </aside>
      </section>

      {showActionsModal && (
        <ProjectActionsModal
          projectId={project.id}
          projectName={project.name}
          projectDescription={project.description ?? undefined}
          projectBudget={project.budget ?? undefined}
          projectStartDate={project.start_date ?? undefined}
          projectEndDate={project.end_date ?? undefined}
          onClose={() => setShowActionsModal(false)}
          onSuccess={() => {
            navigate('/projects')
          }}
        />
      )}
    </div>
  )
}