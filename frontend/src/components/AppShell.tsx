import { useEffect, useRef, useState } from 'react'
import { ToastProvider } from './ToastContext'
import { ToastContainer } from './ToastContainer'
import { Outlet, useNavigate, useMatch, useLocation } from 'react-router-dom'
import { Bell, Menu, MessageSquare, X, CheckCheck, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getSiteSectionFromNotificationType } from '../lib/siteNotifications'
import ProjectsSidebar from './ProjectsSidebar'
import ProjectWorkspaceSidebar from './ProjectWorkspaceSidebar'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'
import { GlobalSearchPalette } from './GlobalSearchPalette'

type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
  project_id: string | null
}

// Labels des onglets workspace projet (segment final de la route)
const WORKSPACE_TAB_LABELS: Record<string, string> = {
  '':          'Vue d\'ensemble',
  'tasks':     'Tâches',
  'calendar':  'Calendrier',
  'budget':    'Budget',
  'site':      'Chantier',
  'documents': 'Documents',
  'team':      'Équipe',
  'gantt':     'Chronologie',
  'reports':   'Rapports',
  'settings':  'Paramètres',  'objectives':'Objectifs & KR',}

// Labels des pages globales (sans projet)
const GLOBAL_PAGE_LABELS: Record<string, string> = {
  '/dashboard':  'Tableau de bord',
  '/projects':   'Projets',
  '/tasks':      'Tâches',
  '/calendar':   'Calendrier',
  '/budget':     'Budget',
  '/documents':  'Documents',
  '/team':       'Équipe',
  '/reports':    'Rapports',
  '/features':   'Fonctionnalités avancées',
  '/profile':    'Mon profil',
  '/activity':   'Historique d\'activité',
}

export default function AppShell() {
  const { user, loading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const projectMatchDeep    = useMatch('/projects/:id/*')
  const projectMatchShallow  = useMatch('/projects/:id')
  const currentProjectId = (projectMatchDeep ?? projectMatchShallow)?.params?.id

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setNotifications([])
      return () => { cancelled = true }
    }

    supabase
      .from('notifications')
      .select('id, type, title, body, read, created_at, project_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled) setNotifications((data ?? []) as AppNotification[])
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Abonnement realtime aux nouvelles notifications
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifications(prev => [payload.new as AppNotification, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Fermer le panneau notif au clic dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Raccourcis globaux principaux (Cmd/Ctrl+K, Cmd/Ctrl+/, ?)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (isMeta && e.key === '/') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, currentProjectId])

  useEffect(() => {
    if (!mobileOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const previous = document.body.style.overflow
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previous || ''
    }
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  const markAllRead = async () => {
    if (!user?.id) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }

  const markOneRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const handleNotificationClick = async (notification: AppNotification) => {
    await markOneRead(notification.id)
    setShowNotif(false)

    if (!notification.project_id) return

    const siteSection = getSiteSectionFromNotificationType(notification.type)
    if (siteSection) {
      navigate(`/projects/${notification.project_id}/site?section=${siteSection}`)
      return
    }

    if (notification.type === 'task_assigned' && notification.project_id) {
      navigate(`/projects/${notification.project_id}/tasks`)
    }
  }

  // Charger le nom du projet sélectionné
  useEffect(() => {
    let cancelled = false
    if (!currentProjectId) { setProjectName(null); return }
    supabase
      .from('projects')
      .select('name')
      .eq('id', currentProjectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProjectName(data?.name ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [currentProjectId])

  // Calculer le titre et sous-titre du header
  const headerSubtitle = currentProjectId
    ? (projectName ?? '…')
    : 'BuildFlow'

  const headerTitle = (() => {
    if (currentProjectId) {
      // Extraire le segment après /projects/:id/
      const segments = location.pathname.split('/')
      const tabSegment = segments[3] ?? ''
      return WORKSPACE_TAB_LABELS[tabSegment] ?? tabSegment
    }
    return GLOBAL_PAGE_LABELS[location.pathname] ?? 'Tableau de bord'
  })()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="bf-app-bg flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="bf-app-bg min-h-screen text-slate-900">
        <a href="#main-content" className="bf-skip-link">Aller au contenu principal</a>
        <div className="md:flex md:min-h-screen">
          <aside
            aria-label="Navigation latérale"
            className={`fixed inset-0 z-40 flex md:static md:z-auto transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          >
            <button
              type="button"
              aria-label="Fermer le menu latéral"
              className="absolute inset-0 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            {/* Sidebar principale : liste des projets */}
            <div className="relative z-10 w-56 flex-shrink-0 bg-slate-900 shadow-xl">
              <ProjectsSidebar user={user} onSignOut={handleSignOut} />
            </div>
            {/* Sidebar espace de travail : apparaît quand un projet est sélectionné */}
            {currentProjectId && (
              <div className="relative z-10 w-52 flex-shrink-0 shadow-xl">
                <ProjectWorkspaceSidebar projectId={currentProjectId} />
              </div>
            )}
          </aside>
          <main id="main-content" className="flex-1 min-w-0">
            <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-sm">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Ouvrir le menu latéral"
                    title="Ouvrir le menu latéral"
                    className="md:hidden h-10 w-10 flex items-center justify-center rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150"
                    onClick={() => setMobileOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{headerSubtitle}</p>
                    <h1 className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">{headerTitle}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Recherche globale */}
                  <button
                    type="button"
                    onClick={() => setShowSearch(true)}
                    title="Recherche globale (Ctrl+K)"
                    aria-label="Ouvrir la recherche globale (Ctrl+K)"
                    className="h-10 px-6 flex items-center gap-2 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden lg:inline">Rechercher…</span>
                    <kbd className="hidden lg:inline text-[10px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">Ctrl K</kbd>
                  </button>
                  {/* Cloche de notifications */}
                  <div className="relative" ref={notifRef}>
                    <button
                      type="button"
                      onClick={() => setShowNotif(v => !v)}
                      aria-label="Afficher les notifications"
                      title="Afficher les notifications"
                      aria-expanded={showNotif}
                      className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {showNotif && (
                      <div
                        role="dialog"
                        aria-label="Panneau des notifications"
                        className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
                      >
                        {/* Header panneau */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            Notifications
                            {unreadCount > 0 && (
                              <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">{unreadCount}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={markAllRead}
                                title="Tout marquer comme lu"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                              >
                                <CheckCheck className="h-4 w-4" />
                              </button>
                            )}
                            <button type="button" onClick={() => setShowNotif(false)} className="bf-button-secondary">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Liste */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                              <Bell className="h-8 w-8 text-slate-200" />
                              <p className="text-sm text-slate-400">Aucune notification</p>
                            </div>
                          ) : (
                            notifications.map(n => (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => handleNotificationClick(n)}
                                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition ${!n.read ? 'bg-indigo-50/50' : ''}`}
                              >
                                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${!n.read ? 'bg-indigo-500' : 'bg-transparent'}`} />
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs font-semibold ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>
                                  <p className="mt-1 text-[10px] text-slate-400">
                                    {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled
                    aria-label="Messagerie (bientôt disponible)"
                    title="Messagerie (bientôt disponible)"
                    className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm cursor-not-allowed"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </button>
                  <div className="hidden md:flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white text-sm font-semibold">{user?.name?.charAt(0) ?? 'U'}</div>
                    <div className="hidden lg:block">
                      <p className="text-sm font-semibold text-slate-900">{user?.name || 'Utilisateur'}</p>
                      <p className="text-xs text-slate-500">{user?.role || 'Chef de projet'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>
            <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
        <KeyboardShortcutsHelp onClose={() => undefined} />
        {showSearch && <GlobalSearchPalette onClose={() => setShowSearch(false)} />}
        <ToastContainer />
      </div>
    </ToastProvider>
  )
}