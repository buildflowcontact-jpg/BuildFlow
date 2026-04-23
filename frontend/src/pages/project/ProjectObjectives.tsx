import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Target, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
// ─── Types ────────────────────────────────────────────────────────────────────

type ObjStatus = 'on-track' | 'at-risk' | 'off-track' | 'completed'

type KeyResult = {
  id: string
  objective_id: string
  title: string
  target: number
  current: number
  unit: string
}

type Objective = {
  id: string
  project_id: string
  title: string
  description: string | null
  due_date: string | null
  status: ObjStatus
  key_results: KeyResult[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ObjStatus, { label: string; color: string; dot: string }> = {
  'on-track':  { label: 'En bonne voie', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  'at-risk':   { label: 'À risque',      color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  'off-track': { label: 'Hors piste',    color: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
  'completed': { label: 'Terminé',       color: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
}

function progressPct(kr: KeyResult): number {
  if (!kr.target || kr.target === 0) return 0
  return Math.min(100, Math.round((kr.current / kr.target) * 100))
}

function objProgress(obj: Objective): number {
  if (!obj.key_results.length) return 0
  return Math.round(obj.key_results.reduce((sum, kr) => sum + progressPct(kr), 0) / obj.key_results.length)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectObjectives() {
  const { id: projectId } = useParams<{ id: string }>()
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Formulaire ajout objectif
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newStatus, setNewStatus] = useState<ObjStatus>('on-track')
  const [saving, setSaving] = useState(false)
  const [deleteObjectiveConfirmId, setDeleteObjectiveConfirmId] = useState<string | null>(null)
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null)
  const [objectiveDraft, setObjectiveDraft] = useState({
    title: '',
    description: '',
    due_date: '',
    status: 'on-track' as ObjStatus,
  })

  // Inline edit KR
  const [editingKR, setEditingKR] = useState<null | { objId: string; kr: Partial<KeyResult> & { isNew?: boolean } }>(null)

  useEffect(() => {
    if (!projectId) return
    loadObjectives()
  }, [projectId])

  async function loadObjectives() {
    setLoading(true)
    const { data: objs, error } = await supabase
      .from('objectives')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) { setLoadError(error.message); setLoading(false); return }

    const objIds = (objs ?? []).map(o => o.id)
    let krs: KeyResult[] = []
    if (objIds.length > 0) {
      const { data } = await supabase.from('key_results').select('*').in('objective_id', objIds)
      krs = data ?? []
    }

    const full: Objective[] = (objs ?? []).map(o => ({
      ...o,
      key_results: krs.filter(k => k.objective_id === o.id),
    }))

    setObjectives(full)
    setLoading(false)
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const s = new Set(prev)
    if (s.has(id)) {
      s.delete(id)
    } else {
      s.add(id)
    }
    return s
  })

  const handleAddObjective = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !projectId) return
    setSaving(true)
    const { data, error } = await supabase
      .from('objectives')
      .insert({ project_id: projectId, title: newTitle.trim(), description: newDesc.trim() || null, due_date: newDue || null, status: newStatus })
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setObjectives(prev => [...prev, { ...data, key_results: [] }])
      setNewTitle(''); setNewDesc(''); setNewDue(''); setNewStatus('on-track')
      setShowAdd(false)
    }
  }

  const handleDeleteObjective = async (id: string) => {
    if (deleteObjectiveConfirmId !== id) {
      setDeleteObjectiveConfirmId(id)
      return
    }
    await supabase.from('objectives').delete().eq('id', id)
    setObjectives(prev => prev.filter(o => o.id !== id))
    setDeleteObjectiveConfirmId(null)
  }

  const handleStatusChange = async (id: string, status: ObjStatus) => {
    await supabase.from('objectives').update({ status }).eq('id', id)
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const beginEditObjective = (obj: Objective) => {
    setEditingObjectiveId(obj.id)
    setObjectiveDraft({
      title: obj.title,
      description: obj.description ?? '',
      due_date: obj.due_date ?? '',
      status: obj.status,
    })
  }

  const saveObjectiveEdit = async () => {
    if (!editingObjectiveId || !objectiveDraft.title.trim()) return
    const payload = {
      title: objectiveDraft.title.trim(),
      description: objectiveDraft.description.trim() || null,
      due_date: objectiveDraft.due_date || null,
      status: objectiveDraft.status,
    }
    const { error } = await supabase.from('objectives').update(payload).eq('id', editingObjectiveId)
    if (error) {
      setLoadError(error.message)
      return
    }
    setObjectives(prev => prev.map(o => o.id === editingObjectiveId ? { ...o, ...payload } : o))
    setEditingObjectiveId(null)
  }

  const saveKR = async () => {
    if (!editingKR) return
    const { objId, kr } = editingKR
    if (kr.isNew) {
      const { data } = await supabase.from('key_results').insert({
        objective_id: objId,
        title: kr.title ?? '',
        target: Number(kr.target ?? 100),
        current: Number(kr.current ?? 0),
        unit: kr.unit ?? '%'
      }).select().single()
      if (data) {
        setObjectives(prev => prev.map(o => o.id === objId ? { ...o, key_results: [...o.key_results, data] } : o))
      }
    } else {
      await supabase.from('key_results').update({
        title: kr.title, target: Number(kr.target), current: Number(kr.current), unit: kr.unit
      }).eq('id', kr.id)
      setObjectives(prev => prev.map(o => o.id === objId
        ? { ...o, key_results: o.key_results.map(k => k.id === kr.id ? { ...k, ...kr } as KeyResult : k) }
        : o))
    }
    setEditingKR(null)
  }

  const deleteKR = async (objId: string, krId: string) => {
    await supabase.from('key_results').delete().eq('id', krId)
    setObjectives(prev => prev.map(o => o.id === objId
      ? { ...o, key_results: o.key_results.filter(k => k.id !== krId) }
      : o))
  }

  if (loadError) return <div className="bf-panel p-8 text-red-600">Erreur : {loadError}</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bf-page-header flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Objectifs & KR</h1>
          <p className="mt-0.5 text-xs text-slate-400">{objectives.length} objectif{objectives.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          <Plus className="h-4 w-4" /> Nouvel objectif
        </button>
      </div>

      {/* Formulaire ajout */}
      {showAdd && (
        <div className="bf-panel overflow-hidden">
          <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Nouvel objectif</h2>
            <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-slate-400 hover:text-slate-700" /></button>
          </div>
          <form onSubmit={handleAddObjective} className="p-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Titre *</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Livrer la phase 1 à temps" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
                placeholder="Contexte et périmètre de l'objectif..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Échéance</label>
                <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as ObjStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Squelette */}
      {loading && (
        <div className="bf-panel p-8 space-y-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {/* Vide */}
      {!loading && objectives.length === 0 && (
        <div className="bf-panel p-16 text-center">
          <Target className="mx-auto h-12 w-12 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Aucun objectif défini. Créez votre premier OKR.</p>
        </div>
      )}

      {/* Liste */}
      {objectives.map(obj => {
        const pct = objProgress(obj)
        const st = STATUS_CONFIG[obj.status]
        const isExpanded = expanded.has(obj.id)
        return (
          <div key={obj.id} className="bf-panel overflow-hidden">
            {/* Header objectif */}
            <div className="px-6 py-4 flex items-center gap-3">
              <button onClick={() => toggleExpand(obj.id)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{obj.title}</p>
                {obj.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{obj.description}</p>}
                {obj.due_date && <p className="text-xs text-slate-400 mt-0.5">Échéance : {obj.due_date}</p>}
              </div>
              {/* Progress bar globale */}
              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
              </div>
              <select
                value={obj.status}
                onChange={e => handleStatusChange(obj.id, e.target.value as ObjStatus)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer ${st.color}`}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => beginEditObjective(obj)} className="text-slate-300 hover:text-indigo-500 transition flex-shrink-0">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteObjective(obj.id)}
                title={deleteObjectiveConfirmId === obj.id ? 'Confirmer la suppression' : 'Supprimer'}
                className={`transition flex-shrink-0 ${
                  deleteObjectiveConfirmId === obj.id
                    ? 'text-red-600'
                    : 'text-slate-300 hover:text-red-500'
                }`}
              >
                {deleteObjectiveConfirmId === obj.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>

            {editingObjectiveId === obj.id && (
              <div className="border-t border-slate-100 px-6 py-4 space-y-3 bg-slate-50/60">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Titre</label>
                  <input
                    value={objectiveDraft.title}
                    onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</label>
                  <textarea
                    value={objectiveDraft.description}
                    onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Échéance</label>
                    <input
                      type="date"
                      value={objectiveDraft.due_date}
                      onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, due_date: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Statut</label>
                    <select
                      value={objectiveDraft.status}
                      onChange={(e) => setObjectiveDraft((prev) => ({ ...prev, status: e.target.value as ObjStatus }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingObjectiveId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={saveObjectiveEdit}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Key Results */}
            {isExpanded && (
              <div className="border-t border-slate-50 px-6 pb-4 space-y-2 pt-4">
                {obj.key_results.map(kr => {
                  const pctKr = progressPct(kr)
                  const isEditing = editingKR?.kr.id === kr.id
                  if (isEditing) {
                    const ekr = editingKR!.kr
                    return (
                      <div key={kr.id} className="flex items-center gap-2 bg-indigo-50 rounded-xl p-3">
                        <input value={ekr.title ?? ''} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, title: e.target.value } })}
                          className="flex-1 rounded-lg border border-indigo-200 px-2 py-1 text-xs focus:outline-none" placeholder="Titre" />
                        <input type="number" value={ekr.current ?? 0} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, current: Number(e.target.value) } })}
                          className="w-16 rounded-lg border border-indigo-200 px-2 py-1 text-xs text-center focus:outline-none" />
                        <span className="text-xs text-slate-400">/</span>
                        <input type="number" value={ekr.target ?? 100} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, target: Number(e.target.value) } })}
                          className="w-16 rounded-lg border border-indigo-200 px-2 py-1 text-xs text-center focus:outline-none" />
                        <input value={ekr.unit ?? '%'} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, unit: e.target.value } })}
                          className="w-12 rounded-lg border border-indigo-200 px-2 py-1 text-xs text-center focus:outline-none" placeholder="%" />
                        <button onClick={saveKR} className="text-emerald-600 hover:text-emerald-700"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditingKR(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                      </div>
                    )
                  }
                  return (
                    <div key={kr.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 group">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      <p className="flex-1 text-xs text-slate-700">{kr.title}</p>
                      <div className="flex items-center gap-2 w-28">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pctKr}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 w-14 text-right">{kr.current}/{kr.target} {kr.unit}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingKR({ objId: obj.id, kr: { ...kr } })} className="text-slate-400 hover:text-indigo-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteKR(obj.id, kr.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
                {/* Ajouter KR */}
                {editingKR?.objId === obj.id && editingKR.kr.isNew ? (
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3">
                    <input value={editingKR.kr.title ?? ''} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, title: e.target.value } })} autoFocus
                      className="flex-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs focus:outline-none" placeholder="Titre du KR" />
                    <input type="number" value={editingKR.kr.current ?? 0} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, current: Number(e.target.value) } })}
                      className="w-16 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-center focus:outline-none" placeholder="0" />
                    <span className="text-xs text-slate-400">/</span>
                    <input type="number" value={editingKR.kr.target ?? 100} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, target: Number(e.target.value) } })}
                      className="w-16 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-center focus:outline-none" placeholder="100" />
                    <input value={editingKR.kr.unit ?? '%'} onChange={e => setEditingKR(p => p && { ...p, kr: { ...p.kr, unit: e.target.value } })}
                      className="w-12 rounded-lg border border-emerald-200 px-2 py-1 text-xs text-center focus:outline-none" placeholder="%" />
                    <button onClick={saveKR} className="text-emerald-600 hover:text-emerald-700"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingKR(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingKR({ objId: obj.id, kr: { isNew: true, objective_id: obj.id, title: '', target: 100, current: 0, unit: '%' } })}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1"
                  >
                    <Plus className="h-3 w-3" /> Ajouter un résultat clé
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
