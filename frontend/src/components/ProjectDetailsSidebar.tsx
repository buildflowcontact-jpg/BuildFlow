import { useState, useEffect } from 'react'
import { NavLink, useMatch } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  DollarSign,
  FileText,
  Users,
  BarChart2,
} from 'lucide-react'

const subLinks = [
  { name: "Vue d'ensemble", path: '', icon: LayoutDashboard, end: true },
  { name: 'Tâches', path: '/tasks', icon: ClipboardList },
  { name: 'Calendrier', path: '/calendar', icon: CalendarDays },
  { name: 'Budget', path: '/budget', icon: DollarSign },
  { name: 'Documents', path: '/documents', icon: FileText },
  { name: 'Équipe', path: '/team', icon: Users },
  { name: 'Rapports', path: '/reports', icon: BarChart2 },
]

export default function ProjectDetailsSidebar() {
  const deepMatch = useMatch('/projects/:id/*')
  const shallowMatch = useMatch('/projects/:id')
  const match = deepMatch ?? shallowMatch
  const id = match?.params?.id
  const [project, setProject] = useState<{ id: string; name: string; status: string } | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('projects')
      .select('id, name, status')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProject(data as { id: string; name: string; status: string })
      })
  }, [id])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 border-b border-white/5">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          Projet actuel
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 mt-0.5 ${
              project?.status === 'active' ? 'bg-emerald-400' :
              project?.status === 'completed' ? 'bg-blue-400' :
              project?.status === 'cancelled' ? 'bg-red-400' :
              'bg-amber-400'
            }`}
          />
          <p className="text-xs font-semibold text-slate-200 leading-snug line-clamp-2">
            {project?.name ?? '…'}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {subLinks.map((link) => (
          <NavLink
            key={link.name}
            to={`/projects/${id}${link.path}`}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            <link.icon className="h-3.5 w-3.5 flex-shrink-0" />
            {link.name}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
