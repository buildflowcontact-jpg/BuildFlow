import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Settings2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { loadProjects, type DbProjectWithTasks } from '../lib/db'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Terminé', className: 'bg-blue-100 text-blue-700' },
  'on-hold': { label: 'En pause', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
}

type WidgetKey = 'kpis' | 'recentProjects' | 'summary' | 'nextActions'

const DASHBOARD_CONFIG_NAME = '__home_dashboard__'

const DEFAULT_WIDGETS: Record<WidgetKey, boolean> = {
  kpis: true,
  recentProjects: true,
  summary: true,
  nextActions: true,
}

const WIDGET_LABELS: Record<WidgetKey, string> = {
  kpis:            'KPIs (Projets, Tâches…)',
  recentProjects:  'Projets récents',
  summary:         'Résumé activité',
  nextActions:     'Prochaines actions',
}

function loadWidgetConfig(): Record<WidgetKey, boolean> {
  try {
    const stored = localStorage.getItem('bf_dashboard_widgets')
    if (stored) {
      return normalizeWidgetConfig(JSON.parse(stored))
    }
  } catch {
    return DEFAULT_WIDGETS
  }
  return DEFAULT_WIDGETS
}

function normalizeWidgetConfig(value: unknown): Record<WidgetKey, boolean> {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Partial<Record<WidgetKey, boolean>>
  return {
    kpis: source.kpis ?? DEFAULT_WIDGETS.kpis,
    recentProjects: source.recentProjects ?? DEFAULT_WIDGETS.recentProjects,
    summary: source.summary ?? DEFAULT_WIDGETS.summary,
    nextActions: source.nextActions ?? DEFAULT_WIDGETS.nextActions,
  }
}

export default function Dashboard() {
  const [projects, setProjects] = useState<DbProjectWithTasks[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(loadWidgetConfig)
  const [dashboardConfigId, setDashboardConfigId] = useState<string | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [savingWidgets, setSavingWidgets] = useState(false)

  const persistWidgetConfig = async (nextWidgets: Record<WidgetKey, boolean>, uid?: string | null) => {
    localStorage.setItem('bf_dashboard_widgets', JSON.stringify(nextWidgets))
    const authorId = uid ?? userId
    if (!authorId) return

    setSavingWidgets(true)
    const payload = { widgets: nextWidgets }

    if (dashboardConfigId) {
      await supabase
        .from('portfolio_dashboards')
        .update({ view_config: payload })
        .eq('id', dashboardConfigId)
      setSavingWidgets(false)
      return
    }

    const { data: existing } = await supabase
      .from('portfolio_dashboards')
      .select('id, view_config')
      .eq('created_by', authorId)
      .eq('name', DASHBOARD_CONFIG_NAME)
      .maybeSingle()

    if (existing?.id) {
      setDashboardConfigId(existing.id)
      await supabase
        .from('portfolio_dashboards')
        .update({ view_config: payload })
        .eq('id', existing.id)
      setSavingWidgets(false)
      return
    }

    const { data: created } = await supabase
      .from('portfolio_dashboards')
      .insert({
        created_by: authorId,
        name: DASHBOARD_CONFIG_NAME,
        description: 'Configuration du dashboard principal',
        project_filter: {},
        view_config: payload,
        is_public: false,
      })
      .select('id')
      .maybeSingle()

    if (created?.id) {
      setDashboardConfigId(created.id)
    }
    setSavingWidgets(false)
  }

  const toggleWidget = (key: WidgetKey) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key] }
      void persistWidgetConfig(next)
      return next
    })
  }

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS)
    void persistWidgetConfig(DEFAULT_WIDGETS)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const userId = data.session?.user?.id
      if (!userId) {
        setLoading(false)
        return
      }
      setUserId(userId)
      try {
        const [result, configResult] = await Promise.all([
          loadProjects(),
          supabase
            .from('portfolio_dashboards')
            .select('id, view_config')
            .eq('created_by', userId)
            .eq('name', DASHBOARD_CONFIG_NAME)
            .maybeSingle(),
        ])
        if (!cancelled) setProjects(result)

        if (!cancelled && configResult.data?.id) {
          setDashboardConfigId(configResult.data.id)
          const rawWidgets = (configResult.data.view_config as { widgets?: unknown } | null)?.widgets
          if (rawWidgets) {
            const normalized = normalizeWidgetConfig(rawWidgets)
            setWidgets(normalized)
            localStorage.setItem('bf_dashboard_widgets', JSON.stringify(normalized))
          }
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) return (
    <div className="rounded-3xl bg-white p-5 shadow-lg text-red-600 sm:p-6 lg:p-8">
      Erreur : {loadError}
    </div>
  )

  if (loading) return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-5 shadow-lg animate-pulse sm:p-6 lg:p-8">
          <div className="h-5 w-1/4 rounded-lg bg-slate-200 mb-4" />
          <div className="h-3 w-3/4 rounded-lg bg-slate-100 mb-2" />
          <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  )

  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const totalTasks = projects.reduce((sum, p) => sum + p.tasks.length, 0)
  const completedTasks = projects.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === 'done').length, 0)

  return (
    <div className="space-y-6 sm:space-y-8">
      <section aria-labelledby="dashboard-page-title" className="rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Tableau de bord</p>
            <h1 id="dashboard-page-title" className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">Vue d’ensemble de l’activité</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Suivez l’activité de vos projets, le flux des tâches, l’état financier et la collaboration de votre équipe.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
            <button
              onClick={() => setShowCustomize(v => !v)}
              aria-expanded={showCustomize}
              aria-controls="dashboard-customize-panel"
              className="bf-button-secondary justify-center"
              title="Personnaliser le tableau de bord"
              aria-label="Personnaliser le tableau de bord"
            >
              <Settings2 className="h-4 w-4" />
              Personnaliser
            </button>
            <Link to="/projects" className="bf-button-primary justify-center px-5 py-3">
              Voir tous les projets
            </Link>
          </div>
        </div>

        {/* Panneau de personnalisation */}
        {showCustomize && (
          <div id="dashboard-customize-panel" className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Widgets affichés</p>
              <div className="flex items-center gap-3">
                {savingWidgets && <span className="text-[10px] font-semibold text-indigo-500">Enregistrement...</span>}
                <button type="button" onClick={resetWidgets} className="bf-button-secondary" title="Réinitialiser la disposition du tableau de bord" aria-label="Réinitialiser la disposition du tableau de bord">
                  Réinitialiser
                </button>
                <button type="button" onClick={() => setShowCustomize(false)} className="bf-button-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(WIDGET_LABELS) as WidgetKey[]).map((key) => (
                <label key={key} className="flex min-h-10 items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 cursor-pointer hover:border-indigo-200">
                  <input
                    type="checkbox"
                    checked={widgets[key]}
                    onChange={() => toggleWidget(key)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700">{WIDGET_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {widgets.kpis && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Projets</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{totalProjects}</p>
            <p className="mt-2 text-xs text-slate-400">{activeProjects} actif{activeProjects !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Taux d'achèvement</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{totalTasks === 0 ? '—' : `${Math.round((completedTasks / totalTasks) * 100)}%`}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Tâches</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{totalTasks}</p>
            <p className="mt-2 text-xs text-slate-400">{completedTasks} terminée{completedTasks !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">En attente</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{totalTasks - completedTasks}</p>
            <p className="mt-2 text-xs text-slate-400">tâche{(totalTasks - completedTasks) !== 1 ? 's' : ''} restante{(totalTasks - completedTasks) !== 1 ? 's' : ''}</p>
          </div>
        </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        {widgets.recentProjects && (
        <div className="rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Projets récents</h2>
              <p className="mt-1 text-sm text-slate-500">Accédez rapidement aux projets les plus actifs.</p>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-3xl border border-slate-200 p-5 transition hover:border-slate-300 hover:bg-slate-50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
                    <p className="mt-2 text-sm text-slate-500">{project.tasks.filter(t => t.status !== 'done').length} tâche{project.tasks.filter(t => t.status !== 'done').length !== 1 ? 's' : ''} en attente</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_LABELS[project.status]?.className ?? 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_LABELS[project.status]?.label ?? project.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}

        {(widgets.summary || widgets.nextActions) && (
        <aside className="space-y-6 rounded-3xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
          {widgets.summary && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Résumé</p>
            <p className="mt-4 text-lg font-semibold text-slate-900">{activeProjects} projet{activeProjects !== 1 ? 's' : ''} actif{activeProjects !== 1 ? 's' : ''}</p>
            <p className="mt-2 text-sm text-slate-600">{completedTasks} tâche{completedTasks !== 1 ? 's' : ''} complétée{completedTasks !== 1 ? 's' : ''} sur {totalTasks}.</p>
          </div>
          )}
          {widgets.nextActions && (
          <div className="rounded-3xl border border-slate-200 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Prochaines actions</p>
            <div className="mt-4 space-y-3">
              {projects.slice(0, 3).map((project) => {
                const remaining = project.tasks.filter((t) => t.status !== 'done').length
                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block rounded-2xl bg-slate-100 p-4 hover:bg-slate-200 transition"
                  >
                    <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{remaining} tâche{remaining !== 1 ? 's' : ''} en attente.</p>
                  </Link>
                )
              })}
              {projects.length === 0 && (
                <p className="text-sm text-slate-500">Aucun projet actif.</p>
              )}
            </div>
          </div>
          )}
        </aside>
        )}
      </section>
    </div>
  )
}