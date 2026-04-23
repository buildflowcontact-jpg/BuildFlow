import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { loadProjects, type DbProjectWithTasks } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { CreateProjectModal } from '../components/CreateProjectModal'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Terminé', className: 'bg-blue-100 text-blue-700' },
  'on-hold': { label: 'En pause', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
}

export default function Projects() {
  const { user, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [projects, setProjects] = useState<DbProjectWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fetchProjects = useCallback(async () => {
    const result = await loadProjects()
    setProjects(result)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoadError('Non authentifié'); setLoading(false); return }
    fetchProjects().then(() => setLoading(false))
  }, [user?.id, authLoading, fetchProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) || (p.description || '').toLowerCase().includes(query.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-3xl bg-white p-5 shadow-lg animate-pulse sm:p-6 lg:p-8">
            <div className="h-6 w-1/3 rounded-lg bg-slate-200 mb-4" />
            <div className="h-3 w-2/3 rounded-lg bg-slate-100 mb-2" />
            <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-lg text-red-600 sm:p-6 lg:p-8">Erreur : {loadError}</div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section aria-labelledby="projects-page-title" className="rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gestion de projets</p>
            <h1 id="projects-page-title" className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">Tous vos projets</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Suivez l'avancement, les budgets et les équipes dans un seul tableau de bord.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              aria-label="Rechercher un projet"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un projet"
              className="bf-input w-full sm:w-72"
            />
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bf-button-primary px-5 py-3">
              Nouveau projet
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
          <div className="grid gap-6">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 p-6 text-center text-slate-500 sm:p-8">
                {projects.length === 0 ? 'Aucun projet créé.' : 'Aucun projet ne correspond à ta recherche.'}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="bf-button-secondary"
                  >
                    Créer un projet
                  </button>
                </div>
              </div>
            ) : (
              filtered.map((project) => {
                const done = project.tasks.filter(t => t.status === 'done').length
                const total = project.tasks.length
                const pct = total === 0 ? 0 : Math.round((done / total) * 100)
                return (
              <Link
                to={`/projects/${project.id}`}
                key={project.id}
                className="bf-card-interactive group block rounded-[28px] border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none sm:rounded-[32px] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900 truncate sm:text-xl">{project.name}</h2>
                    <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">{project.description || 'Aucune description'}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:px-3 sm:text-sm ${STATUS_LABELS[project.status]?.className ?? 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[project.status]?.label ?? project.status}
                  </span>
                </div>
                {total > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
                      <span>{done} / {total} tâche{total !== 1 ? 's' : ''}</span>
                      <span className="font-semibold text-slate-700">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Budget</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">€{project.budget ? Number(project.budget).toLocaleString('fr-FR') : '0'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Créé le</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{project.created_at ? new Date(project.created_at).toLocaleDateString('fr-FR') : '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Mis à jour</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">{project.updated_at ? new Date(project.updated_at).toLocaleDateString('fr-FR') : '—'}</p>
                  </div>
                </div>
              </Link>
              )
              }))}
          </div>
        </div>

        <aside className="space-y-6 rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Résumé</p>
            <p className="mt-4 text-lg font-semibold text-slate-900">{projects.length} projet{projects.length !== 1 ? 's' : ''}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Focalise-toi sur les tâches bloquantes et surveille les budgets restants.</p>
          </div>
        </aside>

      </section>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async () => {
          await fetchProjects()
          setShowCreateModal(false)
        }}
      />
    </div>
  )
}