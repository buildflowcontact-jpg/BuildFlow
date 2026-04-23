import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Building2,
  DollarSign,
  FileText,
  Users,
  BarChart2,
  GanttChartSquare,
  Settings,
  Target,
  X,
} from 'lucide-react'

const workspaceLinks = [
  { name: "Vue d'ensemble", path: '',             icon: LayoutDashboard, end: true },
  { name: 'Tâches',         path: '/tasks',        icon: ClipboardList },
  { name: 'Calendrier',     path: '/calendar',     icon: CalendarDays },
  { name: 'Budget',         path: '/budget',       icon: DollarSign },
  { name: 'Chantier',       path: '/site',         icon: Building2 },
  { name: 'Documents',      path: '/documents',    icon: FileText },
  { name: 'Équipe',         path: '/team',         icon: Users },
  { name: 'Chronologie',    path: '/gantt',        icon: GanttChartSquare },
  { name: 'Objectifs',      path: '/objectives',   icon: Target },
  { name: 'Rapports',       path: '/reports',      icon: BarChart2 },
  { name: 'Paramètres',     path: '/settings',     icon: Settings },
]

interface Props {
  projectId: string
}

export default function ProjectWorkspaceSidebar({ projectId }: Props) {
  const [project, setProject] = useState<{ name: string; status: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('projects')
      .select('name, status')
      .eq('id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProject(data as { name: string; status: string })
      })
  }, [projectId])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-800 border-l border-white/5">
      {/* En-tête projet */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            Projet
          </p>
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {project?.name ?? '…'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {project && (
            <span
              className={`h-2 w-2 rounded-full ${
                project.status === 'active'    ? 'bg-emerald-400' :
                project.status === 'completed' ? 'bg-blue-400'    :
                project.status === 'cancelled' ? 'bg-red-400'     :
                'bg-amber-400'
              }`}
            />
          )}
          <button
            type="button"
            onClick={() => navigate('/projects')}
            title="Fermer"
            aria-label="Fermer l'espace projet"
            className="p-1 rounded-lg text-slate-500 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Liens de l'espace de travail */}
      <nav aria-label="Navigation projet" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Espace de travail
        </p>
        {workspaceLinks.map((link) => (
          <NavLink
            key={link.path}
            to={`/projects/${projectId}${link.path}`}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <link.icon className="h-4 w-4 flex-shrink-0" />
            <span>{link.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
