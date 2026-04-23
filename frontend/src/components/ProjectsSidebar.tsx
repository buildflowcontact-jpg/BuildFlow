import { useState, useEffect } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadProjectsSimple, type DbProject } from '../lib/db'
import {
  Plus,
  LogOut,
  FolderOpen,
  Bell,
  Activity,
  Sparkles,
  User,
} from 'lucide-react'
import { CreateProjectModal } from './CreateProjectModal'
import { NotificationPreferencesModal } from './NotificationPreferencesModal'

interface Props {
  user?: { id?: string; email?: string; name?: string; role?: string } | null
  onSignOut?: () => void
}

export default function ProjectsSidebar({ user, onSignOut = () => {} }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [showNotifPrefs, setShowNotifPrefs] = useState(false)
  const [projects, setProjects] = useState<DbProject[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id
      if (!userId) return
      const result = await loadProjectsSimple()
      setProjects(result)
    })
  }, [refreshKey])

  const matchDeep    = useMatch('/projects/:id/*')
  const matchShallow  = useMatch('/projects/:id')
  const currentProjectId = (matchDeep ?? matchShallow)?.params?.id

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10 flex-shrink-0">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          B
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">BuildFlow</span>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* ─── Projets ─── */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Projets
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              title="Nouveau projet"
              aria-label="Créer un nouveau projet"
              className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-500 transition flex-shrink-0"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Tous les projets */}
          <NavLink
            to="/projects"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                isActive && !currentProjectId
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span>Tous les projets</span>
          </NavLink>

          {/* Liste des projets - clic pour ouvrir la sidebar workspace */}
          {projects.map((project) => {
            const isActive = currentProjectId === project.id
            return (
              <button
                type="button"
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition mt-0.5 text-left focus-visible:outline-none ${
                  isActive
                    ? 'bg-indigo-600/20 text-white font-medium'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    project.status === 'active'    ? 'bg-emerald-400' :
                    project.status === 'completed' ? 'bg-blue-400'    :
                    project.status === 'cancelled' ? 'bg-red-400'     :
                    'bg-amber-400'
                  }`}
                />
                <span className="flex-1 truncate leading-4">{project.name}</span>
              </button>
            )
          })}

          {projects.length === 0 && (
            <div className="px-3 py-5 text-center">
              <p className="text-xs text-slate-300">Aucun projet</p>
              <p className="mt-1 text-[10px] text-slate-400">Créez votre premier projet</p>
            </div>
          )}
        </div>

        {/* ─── Compte ─── */}
        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-3 mb-2">Compte</p>
          <NavLink
            to="/features"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <span>Fonctionnalités</span>
          </NavLink>
          <NavLink
            to="/activity"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Activity className="h-4 w-4 flex-shrink-0" />
            <span>Activité</span>
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <User className="h-4 w-4 flex-shrink-0" />
            <span>Mon profil</span>
          </NavLink>
        </div>
      </nav>

      {/* Profil utilisateur */}
      <div className="border-t border-white/10 p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            title="Mon profil"
            className="h-7 w-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 hover:bg-indigo-400 transition"
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Utilisateur'}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.role || 'Chef de projet'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotifPrefs(true)}
            title="Préférences de notifications"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition flex-shrink-0"
          >
            <Bell className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSignOut}
            title="Déconnexion"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition flex-shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showNotifPrefs && user?.id && (
        <NotificationPreferencesModal
          userId={user.id}
          onClose={() => setShowNotifPrefs(false)}
        />
      )}

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setRefreshKey((k) => k + 1)
          setShowCreate(false)
        }}
      />
    </div>
  )
}
