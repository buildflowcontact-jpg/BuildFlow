import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Users, User, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  VirtualMember,
  AppMember,
  TeamMember,
  getDisplayName,
  getInitials,
  getSubtitle,
  pickColor,
} from '../../utils/teamStore'
import { loadVirtualMembers, addVirtualMember, deleteVirtualMemberDb } from '../../lib/db'

function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: (m: VirtualMember) => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', position: '', company: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() && !form.lastName.trim()) { setError('Prénom ou nom requis'); return }
    setSaving(true)
    const { data: sd } = await supabase.auth.getSession()
    const uid = sd.session?.user?.id
    if (!uid) { setError('Non authentifié'); setSaving(false); return }
    const memberData: Omit<VirtualMember, 'id' | 'type'> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      position: form.position.trim(),
      company: form.company.trim(),
      color: pickColor(Math.floor(Math.random() * 10)),
    }
    const savedId = await addVirtualMember(memberData, uid)
    setSaving(false)
    if (!savedId) { setError("Erreur lors de l'ajout"); return }
    onAdded({ ...memberData, id: savedId, type: 'virtual' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Ajouter un membre</h2>
          <button onClick={onClose} className="bf-button-secondary"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Prénom</label>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Nom</label>
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Rôle</label>
            <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              placeholder="ex: Développeur, Designer..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Entreprise</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="bf-button-secondary">Annuler</button>
            <button type="submit" disabled={saving} className="bf-button">
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectTeam() {
  const { id: projectId } = useParams<{ id: string }>()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!projectId) return
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      const sessionUser = data.session?.user
      if (!uid || !sessionUser) { setLoading(false); return }

      const { data: memberRows } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)

      const memberIds = Array.from(new Set((memberRows ?? []).map((row: { user_id: string }) => row.user_id)))
      const profileIds = memberIds.length > 0 ? memberIds : [uid]

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, email, color')
        .in('id', profileIds)

      const realMembers: AppMember[] = (profiles ?? []).map((profile: { id: string; name: string | null; email: string | null; color: string | null }) => ({
        id: profile.id,
        type: 'app',
        name: profile.name || profile.email || 'Utilisateur',
        email: profile.email || '',
        color: profile.color || pickColor(0),
      }))

      if (!realMembers.some((member) => member.id === uid)) {
        realMembers.unshift({
          id: uid,
          type: 'app',
          name: (sessionUser.user_metadata as any)?.name || sessionUser.email || 'Moi',
          email: sessionUser.email || '',
          color: pickColor(0),
        })
      }

      // Membres virtuels
      const virtuals = await loadVirtualMembers(uid)

      setMembers([...realMembers, ...virtuals])
      setLoading(false)
    }).catch((err: any) => {
      setLoadError(err?.message ?? 'Erreur de chargement')
      setLoading(false)
    })
  }, [projectId])

  const handleDelete = async (member: TeamMember) => {
    if (member.type === 'virtual') {
      await deleteVirtualMemberDb(member.id)
      setMembers(prev => prev.filter(m => m.id !== member.id))
    }
  }

  if (loading) return <div className="bf-surface p-8">Chargement de l'équipe...</div>
  if (loadError) return <div className="bf-surface p-8 text-red-600">Erreur : {loadError}</div>
  if (!projectId) return null

  return (
    <div className="space-y-6">
      <div className="bf-page-header flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Équipe du projet</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bf-button-primary">
          <Plus className="h-4 w-4" />Ajouter
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bf-surface p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-400">Aucun membre dans ce projet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(m => (
            <div key={m.id} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition">
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${m.color} text-sm font-bold text-white shadow-sm`}>
                {getInitials(m)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{getDisplayName(m)}</p>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{getSubtitle(m)}</p>
                <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.type === 'app' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                  {m.type === 'app' ? <><User className="h-2.5 w-2.5" /> Utilisateur</> : <><Users className="h-2.5 w-2.5" /> Externe</>}
                </span>
              </div>
              {m.type === 'virtual' && (
                <button onClick={() => handleDelete(m)}
                  className="hidden group-hover:flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onAdded={m => setMembers(prev => [...prev, m])}
        />
      )}
    </div>
  )
}

