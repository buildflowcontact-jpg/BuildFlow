import { useEffect, useState } from 'react'
import { Building2, Briefcase, Mail, Plus, Star, Trash2, User, X } from 'lucide-react'
import { type VirtualMember, getDisplayName, getInitials, getSubtitle, pickColor } from '../utils/teamStore'
import { createFavoriteMember, deleteVirtualMemberDb, loadFavoriteMembers, upsertUserProfile } from '../lib/db'
import { useAuth } from '../context/AuthContext'

type FavoriteForm = {
  firstName: string
  lastName: string
  company: string
  position: string
  email: string
}

function FavoriteModal({
  onClose,
  onSave,
  existingEmails,
}: {
  onClose: () => void
  onSave: (form: FavoriteForm) => Promise<void>
  existingEmails: string[]
}) {
  const [form, setForm] = useState<FavoriteForm>({ firstName: '', lastName: '', company: '', position: '', email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const nextErrors: Record<string, string> = {}
    const normalizedEmail = form.email.trim().toLowerCase()
    if (!form.firstName.trim()) nextErrors.firstName = 'Requis'
    if (!form.lastName.trim()) nextErrors.lastName = 'Requis'
    if (!form.company.trim()) nextErrors.company = 'Requis'
    if (!form.position.trim()) nextErrors.position = 'Requis'
    if (!normalizedEmail) nextErrors.email = 'Requis'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) nextErrors.email = 'Email invalide'
    else if (existingEmails.includes(normalizedEmail)) nextErrors.email = 'Deja dans les favoris'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    await onSave({ ...form, email: normalizedEmail })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ajouter un favori</h2>
            <p className="mt-1 text-xs text-slate-500">Ce contact pourra etre reinvite tres rapidement sur d'autres projets.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Prenom</label>
            <input autoFocus value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nom</label>
            <input value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Entreprise</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input value={form.company} onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            {errors.company && <p className="mt-1 text-xs text-red-500">{errors.company}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Poste</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input value={form.position} onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{saving ? 'Enregistrement...' : 'Ajouter aux favoris'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Team() {
  const { user, loading: authLoading } = useAuth()
  const [favorites, setFavorites] = useState<VirtualMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    const userName = user.name || user.email || 'Moi'
    upsertUserProfile(user.id, user.email ?? '', userName).then(() =>
      loadFavoriteMembers(user.id)
    ).then((rows) => {
      setFavorites(rows)
      setLoading(false)
    })
  }, [user?.id, authLoading])

  const handleSave = async (form: FavoriteForm) => {
    if (!user) return
    const created = await createFavoriteMember({ ...form, color: pickColor(favorites.length) }, user.id)
    if (!created) return
    const nextFavorites = [...favorites, created]
    setFavorites(nextFavorites)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deleteVirtualMemberDb(id)
    const nextFavorites = favorites.filter((member) => member.id !== id)
    setFavorites(nextFavorites)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Repertoire equipe</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Favoris</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Conservez vos contacts habituels avec leur entreprise, leur poste et leur adresse e-mail pour les inviter instantanement sur un projet.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            <Plus className="h-4 w-4" />
            Nouveau favori
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Contacts enregistres</h2>
            <p className="mt-1 text-sm text-slate-500">{favorites.length} favori{favorites.length > 1 ? 's' : ''} disponible{favorites.length > 1 ? 's' : ''}</p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 p-12 text-center text-slate-500">Chargement des favoris...</div>
          ) : favorites.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center">
              <Star className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-4 text-sm font-medium text-slate-500">Aucun favori enregistre</p>
              <p className="mt-1 text-sm text-slate-400">Ajoutez vos interlocuteurs recurrents pour les reutiliser d'un projet a l'autre.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {favorites.map((member) => (
                <div key={member.id} className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${member.color} text-sm font-bold text-white shadow-sm`}>
                      {getInitials(member)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{getDisplayName(member)}</p>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Favori</span>
                        {member.linkedUserId && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Compte existant</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{getSubtitle(member)}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{member.email || 'Aucun e-mail'}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleDelete(member.id)} className="hidden h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-red-50 hover:text-red-500 group-hover:flex" title="Supprimer le favori">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6 rounded-3xl bg-white p-8 shadow-lg">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Fonctionnement</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Chaque fiche favori contient le nom, l'entreprise, le poste et l'e-mail.</p>
              <p>Depuis un projet, vous pourrez inviter un favori en un clic.</p>
              <p>Si le compte existe deja, l'utilisateur rejoint immediatement le projet.</p>
              <p>Sinon, le contact reste virtuel jusqu'a sa creation de compte.</p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Detection automatique</p>
                <p className="mt-1 text-sm text-slate-500">L'e-mail permet de reconnaitre un compte existant et de basculer un contact virtuel en membre actif du projet.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {showModal && <FavoriteModal onClose={() => setShowModal(false)} onSave={handleSave} existingEmails={favorites.map((member) => (member.email || '').toLowerCase()).filter(Boolean)} />}
    </div>
  )
}

