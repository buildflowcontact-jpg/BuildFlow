import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, CheckSquare, FolderOpen, X } from 'lucide-react'
import { globalSearch } from '../lib/search'

interface Props {
  onClose: () => void
}

type ResultItem = {
  id: string
  label: string
  sublabel?: string
  type: 'task' | 'document' | 'project'
  route: string
}

export function GlobalSearchPalette({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSelected(0); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const data = await globalSearch(query.trim())
      const mapped: ResultItem[] = [
        ...data.projects.map((p: any) => ({
          id: `project-${p.id}`,
          label: p.name,
          sublabel: p.description || undefined,
          type: 'project' as const,
          route: `/projects/${p.id}`,
        })),
        ...data.tasks.map((t: any) => ({
          id: `task-${t.id}`,
          label: t.title,
          sublabel: t.status ?? undefined,
          type: 'task' as const,
          route: `/projects/${t.project_id}/tasks`,
        })),
        ...data.documents.map((d: any) => ({
          id: `doc-${d.id}`,
          label: d.name,
          sublabel: 'Document',
          type: 'document' as const,
          route: `/projects/${d.project_id}/documents`,
        })),
      ]
      setResults(mapped)
      setSelected(0)
      setLoading(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter' && results.length > 0) { go(results[selected]); return }
  }

  const go = (item: ResultItem) => {
    navigate(item.route)
    onClose()
  }

  const Icon = (type: ResultItem['type']) => {
    if (type === 'project') return <FolderOpen className="h-4 w-4 text-indigo-400 flex-shrink-0" />
    if (type === 'task') return <CheckSquare className="h-4 w-4 text-emerald-400 flex-shrink-0" />
    return <FileText className="h-4 w-4 text-sky-400 flex-shrink-0" />
  }

  const typeLabel = { project: 'Projet', task: 'Tâche', document: 'Document' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bf-modal-panel rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher tâches, documents, projets…"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="bf-button-secondary">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Résultats */}
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Recherche en cours…</div>
        )}

        {!loading && results.length === 0 && query.trim().length >= 2 && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun résultat pour « {query} »</div>
        )}

        {!loading && results.length === 0 && query.trim().length < 2 && (
          <div className="px-4 py-6 text-center text-xs text-slate-400">Tapez au moins 2 caractères pour rechercher</div>
        )}

        {!loading && results.length > 0 && (
          <ul role="listbox" aria-label="Résultats de recherche" className="max-h-80 overflow-y-auto py-2">
            {results.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === selected}
                  onClick={() => go(item)}
                  onMouseEnter={() => setSelected(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${idx === selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  {Icon(item.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                    {item.sublabel && <p className="text-xs text-slate-400 truncate">{item.sublabel}</p>}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">
                    {typeLabel[item.type]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && (
          <p className="sr-only" aria-live="polite">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </p>
        )}

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="bg-slate-100 rounded px-1">↑↓</kbd> naviguer</span>
          <span><kbd className="bg-slate-100 rounded px-1">↵</kbd> ouvrir</span>
          <span><kbd className="bg-slate-100 rounded px-1">ESC</kbd> fermer</span>
        </div>
      </div>
    </div>
  )
}

