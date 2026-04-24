import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, Trash2, Archive, AlertTriangle, Users2, Link2, Copy, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { updateProjectDb, archiveProjectDb, deleteProjectDb, type DbProject } from '../../lib/db'
import { DateInput } from '../../components/DateInput'

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Actif' },
  { value: 'on-hold',   label: 'En pause' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
]

export default function ProjectSettings() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<DbProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Formulaire
  const [form, setForm] = useState({
    name: '',
    description: '',
    budget: '',
    start_date: '',
    end_date: '',
    status: 'active',
  })

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // Membres / RBAC
  type Member = { user_id: string; role: string; email: string; name: string }
  const [members, setMembers] = useState<Member[]>([])
  const [savingRole, setSavingRole] = useState<string | null>(null)

  // Invitation par lien
  const [inviteLink, setInviteLink] = useState('')
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteHint, setInviteHint] = useState('')
  const [copied, setCopied] = useState(false)

  const generateInvite = async (): Promise<string | null> => {
    if (!projectId) return null
    setGeneratingInvite(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const createdBy = sessionData.session?.user?.id
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('project_invitations')
      .insert({ project_id: projectId, role: inviteRole, created_by: createdBy, expires_at: expiresAt })
      .select('id')
      .single()
    setGeneratingInvite(false)
    if (!error && data) {
      const generatedLink = `${window.location.origin}/invite/${data.id}`
      setInviteLink(generatedLink)
      return generatedLink
    }
    return null
  }

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendInvitationEmail = async () => {
    const to = inviteEmail.trim()
    if (!to) {
      setInviteHint('Veuillez renseigner une adresse e-mail.')
      return
    }

    let link = inviteLink
    if (!link) {
      setInviteHint('Génération du lien en cours...')
      const generated = await generateInvite()
      link = generated ?? ''
    }

    if (!link) {
      setInviteHint('Générez d\'abord un lien d\'invitation.')
      return
    }

    const roleLabel = inviteRole === 'admin'
      ? 'Admin'
      : inviteRole === 'manager'
        ? 'Chef de projet'
        : 'Membre'

    const subject = encodeURIComponent(`Invitation BuildFlow - ${project?.name ?? 'Projet'}`)
    const body = encodeURIComponent(
      `Bonjour,\n\n` +
      `Vous êtes invité(e) à rejoindre le projet "${project?.name ?? 'BuildFlow'}" avec le rôle ${roleLabel}.\n\n` +
      `Lien d'invitation : ${link}\n\n` +
      `Ce lien expire dans 7 jours.\n\n` +
      `À bientôt sur BuildFlow.`
    )

    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
    setInviteHint('Client e-mail ouvert avec le message prérempli.')
  }

  useEffect(() => {
    if (!projectId) return
    supabase
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', projectId)
      .then(async ({ data: rows }) => {
        if (!rows || rows.length === 0) return
        const ids = rows.map(r => r.user_id)
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, name')
          .in('id', ids)
        const profileMap: Record<string, { email: string; name: string }> = {}
        for (const p of profiles ?? []) profileMap[p.id] = { email: p.email ?? '', name: p.name ?? '' }
        setMembers(rows.map(r => ({
          user_id: r.user_id,
          role: r.role,
          email: profileMap[r.user_id]?.email ?? r.user_id,
          name: profileMap[r.user_id]?.name ?? '',
        })))
      })
  }, [projectId])

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!projectId) return
    setSavingRole(memberId)
    await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', memberId)
    setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m))
    setSavingRole(null)
  }

  useEffect(() => {
    if (!projectId) return
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('created_by', uid)
        .maybeSingle()
      if (proj) {
        setProject(proj as DbProject)
        setForm({
          name: proj.name ?? '',
          description: proj.description ?? '',
          budget: proj.budget?.toString() ?? '',
          start_date: proj.start_date ?? '',
          end_date: proj.end_date ?? '',
          status: proj.status ?? 'active',
        })
      }
      setLoading(false)
    })
  }, [projectId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !userId) return
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setSaving(true)
    setError('')
    const budgetVal = form.budget ? parseFloat(form.budget) : undefined
    const ok = await updateProjectDb(
      projectId,
      {
        name: form.name.trim(),
        description: form.description.trim(),
        budget: budgetVal,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      },
      userId
    )
    // Mise à jour du statut séparément si nécessaire
    if (ok && form.status !== project?.status) {
      await supabase.from('projects').update({ status: form.status }).eq('id', projectId).eq('created_by', userId)
    }
    setSaving(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      setError("Erreur lors de la sauvegarde.")
    }
  }

  const handleArchive = async () => {
    if (!projectId || !userId) return
    setArchiving(true)
    await archiveProjectDb(projectId, userId)
    setArchiving(false)
    navigate('/projects')
  }

  const handleDelete = async () => {
    if (!projectId || !userId) return
    setDeleting(true)
    await deleteProjectDb(projectId, userId)
    setDeleting(false)
    navigate('/projects')
  }

  if (loading) return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bf-surface p-8 animate-pulse">
          <div className="h-5 w-1/4 rounded-lg bg-slate-200 mb-4" />
          <div className="h-10 rounded-xl bg-slate-100 mb-3" />
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  )
  if (!project) return (
    <div className="bf-surface p-8 text-center">
      <p className="text-slate-500">Projet introuvable ou accès refusé.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Paramètres du projet</h1>
      </div>

      {/* Formulaire principal */}
      <div className="bf-panel overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5">
          <h2 className="text-base font-semibold text-slate-900">Informations générales</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-5 p-8">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Nom du projet *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Budget (€)</label>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de début</label>
              <DateInput
                value={form.start_date}
                onChange={value => setForm(f => ({ ...f, start_date: value }))}
                max={form.end_date || undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date de fin</label>
              <DateInput
                value={form.end_date}
                onChange={value => setForm(f => ({ ...f, end_date: value }))}
                min={form.start_date || undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {saving ? 'Enregistrement...' : saved ? <><Check className="h-4 w-4" /> Enregistré</> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Équipe / RBAC */}
      {members.length > 0 && (
        <div className="bf-panel overflow-hidden">
          <div className="border-b border-slate-100 px-8 py-5 flex items-center gap-2">
            <Users2 className="h-5 w-5 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Gestion de l'équipe</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center justify-between px-8 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{member.name || member.email}</p>
                  {member.name && <p className="text-xs text-slate-400">{member.email}</p>}
                </div>
                <select
                  value={member.role}
                  disabled={savingRole === member.user_id || member.user_id === userId}
                  onChange={e => handleRoleChange(member.user_id, e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="owner">Propriétaire</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Chef de projet</option>
                  <option value="member">Membre</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invitation par lien */}
      <div className="bf-panel overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Inviter par lien</h2>
        </div>
        <div className="p-8 space-y-4">
          <p className="text-sm text-slate-500">Générez un lien d'invitation valable 7 jours. Toute personne connectée qui suit ce lien sera ajoutée au projet.</p>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex-shrink-0">Rôle</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="member">Membre</option>
              <option value="manager">Chef de projet</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={generateInvite}
              disabled={generatingInvite}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {generatingInvite ? 'Génération...' : 'Générer un lien'}
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="destinataire@entreprise.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={sendInvitationEmail}
              disabled={generatingInvite}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Envoyer par e-mail
            </button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="flex-1 text-xs text-slate-700 font-mono truncate">{inviteLink}</p>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition flex-shrink-0"
              >
                {copied ? <><CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
              </button>
            </div>
          )}
          {inviteHint && (
            <p className="text-xs text-slate-500">{inviteHint}</p>
          )}
        </div>
      </div>

      {/* Zone danger */}
      <div className="bf-panel overflow-hidden border border-red-200">
        <div className="border-b border-red-100 bg-red-50 px-8 py-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Zone de danger
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {/* Archiver */}
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Mettre en pause le projet</p>
              <p className="text-xs text-slate-400 mt-0.5">Le projet passera en statut "En pause". Vous pourrez le réactiver.</p>
            </div>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              {archiving ? 'En cours...' : 'Mettre en pause'}
            </button>
          </div>
          {/* Supprimer */}
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Supprimer le projet</p>
              <p className="text-xs text-slate-400 mt-0.5">Action irréversible. Toutes les données du projet seront supprimées.</p>
            </div>
            {confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="bf-button-secondary">Annuler</button>
                <button onClick={handleDelete} disabled={deleting} className="bf-button">
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Suppression...' : 'Confirmer'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100">
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
