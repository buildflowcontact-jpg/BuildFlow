import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, X, Check, Search, FileText, Sheet, File } from 'lucide-react'
import { loadDocumentsDb, uploadDocumentDb, deleteDocumentDb, type DbDocument } from '../lib/db'
import { supabase } from '../lib/supabase'

type DocType = 'PDF' | 'Excel' | 'Word' | 'Image' | 'Autre'

const TYPE_ICONS: Record<DocType, React.ReactNode> = {
  'PDF': <FileText className="h-5 w-5 text-red-500" />,
  'Excel': <Sheet className="h-5 w-5 text-emerald-600" />,
  'Word': <FileText className="h-5 w-5 text-blue-500" />,
  'Image': <File className="h-5 w-5 text-amber-500" />,
  'Autre': <File className="h-5 w-5 text-slate-400" />,
}

const TYPE_BADGE: Record<DocType, string> = {
  'PDF': 'bg-red-100 text-red-700',
  'Excel': 'bg-emerald-100 text-emerald-700',
  'Word': 'bg-blue-100 text-blue-700',
  'Image': 'bg-amber-100 text-amber-700',
  'Autre': 'bg-slate-100 text-slate-600',
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
])



function UploadDocModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: (doc: DbDocument) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [projectName, setProjectName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Veuillez sélectionner un fichier'); return }
    if (!projectName.trim()) { setError('Le nom du projet est requis'); return }
    setUploading(true)
    setError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) { setError('Non authentifié'); setUploading(false); return }
    const userName = (user.user_metadata as any)?.name || user.email || 'Utilisateur'
    const doc = await uploadDocumentDb(file, projectName.trim(), user.id, userName)
    setUploading(false)
    if (!doc) {
      setError('Erreur lors de l\'upload. Vérifiez que le bucket \'documents\' existe dans Supabase Storage.')
      return
    }
    onUploaded(doc)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Importer un fichier</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Fichier *</label>
            <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition ${
              file ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300'
            }`}>
              <File className={`h-8 w-8 ${file ? 'text-indigo-500' : 'text-slate-300'}`} />
              <p className="text-sm font-medium text-slate-700">
                {file ? file.name : 'Cliquer pour sélectionner un fichier'}
              </p>
              {file && (
                <p className="text-xs text-slate-500">
                  {file.size < 1024 * 1024
                    ? `${(file.size / 1024).toFixed(0)} Ko`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`}
                </p>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                className="sr-only"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null
                  if (selected && !ALLOWED_MIME_TYPES.has(selected.type)) {
                    setFileError(`Type de fichier non autorisé : ${selected.type || 'inconnu'}. Formats acceptés : PDF, Word, Excel, Image, CSV, TXT.`)
                    setFile(null)
                    e.target.value = ''
                    return
                  }
                  setFileError('')
                  setFile(selected)
                }}
              />
            </label>
            {fileError && (
              <p className="mt-2 text-xs text-red-600">{fileError}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Projet associé *</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="ex: BuildFlow mobile"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button
              type="submit"
              disabled={!file || !!fileError || !projectName.trim() || uploading}
              className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {uploading ? 'Upload en cours...' : 'Importer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Documents() {
  const [docs, setDocs] = useState<DbDocument[]>([])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('Tous')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) {
        if (!cancelled) setLoading(false)
        return
      }
      const dbDocs = await loadDocumentsDb(uid)
      if (!cancelled) {
        setDocs(dbDocs)
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  function handleUploaded(doc: DbDocument) {
    setDocs((prev) => [doc, ...prev])
  }

  function handleDelete(id: string, url: string, storagePath?: string | null) {
    if (deleteConfirm === id) {
      setDocs((prev) => prev.filter((d) => d.id !== id))
      setDeleteConfirm(null)
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      deleteDocumentDb(id, url, storagePath)
    } else {
      setDeleteConfirm(id)
      deleteTimer.current = setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const filtered = docs
    .filter((d) => filterType === 'Tous' || d.type === filterType)
    .filter((d) => {
      const q = search.toLowerCase()
      return (
        d.name.toLowerCase().includes(q) ||
        d.project_name.toLowerCase().includes(q) ||
        d.uploaded_by_name.toLowerCase().includes(q)
      )
    })

  const types = ['Tous', 'PDF', 'Excel', 'Word', 'Image', 'Autre']
  const projectsCount = new Set(docs.map((d) => d.project_name).filter(Boolean)).size
  const contributorsCount = new Set(docs.map((d) => d.uploaded_by_name).filter(Boolean)).size

  if (loading) return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-8 shadow-lg animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="flex gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-slate-200" />
            <div className="flex-1">
              <div className="h-3 w-2/3 rounded-lg bg-slate-100 mb-1.5" />
              <div className="h-3 w-1/3 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      {showModal && <UploadDocModal onClose={() => setShowModal(false)} onUploaded={handleUploaded} />}

      <div className="space-y-8">
        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gestion documentaire</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Documents partagés</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">Centralise les fichiers importants de tes projets et partage-les avec ton équipe.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Plus className="h-4 w-4" /> Importer un fichier
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{docs.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Projets couverts</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{projectsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Contributeurs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{contributorsCount}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Documents ({filtered.length})</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {types.map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filterType === t ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 mb-4"><File className="h-6 w-6 text-slate-400" /></div>
              <p className="font-semibold text-slate-700">{search || filterType !== 'Tous' ? 'Aucun résultat' : 'Aucun document'}</p>
              <p className="mt-1 text-sm text-slate-500">{search || filterType !== 'Tous' ? 'Essaie d\'autres critères.' : 'Importe ton premier fichier.'}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fichier</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Projet</th>
                    <th className="hidden sm:table-cell px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                    <th className="hidden md:table-cell px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Par</th>
                    <th className="hidden lg:table-cell px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                    <th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filtered.map(doc => (
                    <tr key={doc.id} className="group hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {TYPE_ICONS[doc.type as DocType] ?? <File className="h-5 w-5 text-slate-400" />}
                          <div>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 hover:text-indigo-600 hover:underline">{doc.name}</a>
                            {doc.size && <p className="text-xs text-slate-400">{doc.size}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{doc.project_name}</td>
                      <td className="hidden sm:table-cell px-5 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[doc.type as DocType] ?? 'bg-slate-100 text-slate-600'}`}>{doc.type}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-500">{doc.uploaded_by_name}</td>
                      <td className="hidden lg:table-cell px-5 py-4 text-sm text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(doc.id, doc.url, doc.storage_path)}
                          title={deleteConfirm === doc.id ? 'Confirmer la suppression' : 'Supprimer'}
                          className={`hidden group-hover:inline-flex items-center justify-center h-8 w-8 rounded-lg transition ${deleteConfirm === doc.id ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
                        >
                          {deleteConfirm === doc.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
