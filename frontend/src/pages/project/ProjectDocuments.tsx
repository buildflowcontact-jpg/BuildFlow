import { useState, useEffect } from 'react'
import { Plus, Trash2, X, Search, FileText, Sheet, File, History, Check } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loadProjectDocumentsDb, uploadDocumentDb, deleteDocumentDb, type DbDocument } from '../../lib/db'

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

type DocVersion = {
  id: string
  document_id: string
  version_number: number
  content_url: string
  comments: string | null
  created_at: string
  created_by: string | null
}

function VersionsModal({ docId, docName, onClose }: { docId: string; docName: string; onClose: () => void }) {
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('document_versions')
      .select('id,document_id,version_number,content_url,comments,created_at,created_by')
      .eq('document_id', docId)
      .order('version_number', { ascending: false })
      .then(({ data }) => { setVersions((data ?? []) as DocVersion[]); setLoading(false) })
  }, [docId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Historique des versions</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{docName}</p>
          </div>
          <button onClick={onClose} className="bf-button-secondary"><X className="h-4 w-4" /></button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun historique de version disponible.</p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Version {v.version_number}</p>
                  <p className="text-xs text-slate-400">{new Date(v.created_at).toLocaleDateString('fr-FR')}{v.comments ? ` · ${v.comments}` : ''}</p>
                </div>
                <a href={v.content_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-indigo-600 hover:underline">Télécharger</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UploadModal({
  projectId,
  projectName,
  onClose,
  onUploaded,
}: {
  projectId: string
  projectName: string
  onClose: () => void
  onUploaded: (doc: DbDocument) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); return }
    if (!ALLOWED_MIME_TYPES.has(f.type)) { setFileError('Type de fichier non autorisé'); return }
    if (f.size > 20 * 1024 * 1024) { setFileError('Fichier trop volumineux (max 20 Mo)'); return }
    setFileError('')
    setFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Sélectionner un fichier'); return }
    setUploading(true)
    const { data: sd } = await supabase.auth.getSession()
    const user = sd.session?.user
    if (!user) { setError('Non authentifié'); setUploading(false); return }
    const userName = (user.user_metadata as any)?.name || user.email || 'Utilisateur'
    const doc = await uploadDocumentDb(file, projectName, user.id, userName, projectId)
    setUploading(false)
    if (!doc) { setError("Erreur lors de l'upload."); return }
    onUploaded(doc)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Importer un fichier</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
            <input type="file" id="doc-file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
              onChange={e => handleFile(e.target.files?.[0] ?? null)} />
            <label htmlFor="doc-file" className="cursor-pointer">
              {file ? (
                <p className="text-sm font-medium text-slate-900">{file.name}</p>
              ) : (
                <p className="text-sm text-slate-500">Cliquer pour sélectionner un fichier</p>
              )}
            </label>
            {fileError && <p className="mt-1 text-xs text-red-500">{fileError}</p>}
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="bf-button-secondary">Annuler</button>
            <button type="submit" disabled={uploading || !file} className="bf-button">
              {uploading ? 'Upload...' : 'Importer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectDocuments() {
  const { id: projectId } = useParams<{ id: string }>()
  const [docs, setDocs] = useState<DbDocument[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [viewVersionsDoc, setViewVersionsDoc] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) { setLoading(false); return }
      const [docsData, { data: projData }] = await Promise.all([
        loadProjectDocumentsDb(projectId),
        supabase.from('projects').select('name').eq('id', projectId).maybeSingle(),
      ])
      setDocs(docsData)
      setProjectName(projData?.name ?? '')
      setLoading(false)
    })
  }, [projectId])

  const filtered = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const handleDelete = async (doc: DbDocument) => {
    if (deleteConfirmId !== doc.id) {
      setDeleteConfirmId(doc.id)
      return
    }
    await deleteDocumentDb(doc.id, doc.url, doc.storage_path)
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    setDeleteConfirmId(null)
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bf-surface p-6 animate-pulse flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-200 flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded-lg bg-slate-200 mb-2" />
            <div className="h-3 w-1/4 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
  if (!projectId) return null

  return (
    <div className="space-y-6">
      <div className="bf-page-header flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Documents</h1>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bf-button-primary">
          <Plus className="h-4 w-4" />Importer
        </button>
      </div>

      {/* Recherche */}
      <div className="bf-surface relative p-3">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un document..."
          className="bf-input pl-11"
        />
      </div>

      {/* Liste */}
      <div className="bf-panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">{search ? 'Aucun résultat.' : 'Aucun document pour ce projet.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(doc => (
              <div key={doc.id} className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  {TYPE_ICONS[doc.type as DocType] ?? TYPE_ICONS['Autre']}
                </div>
                <div className="flex-1 min-w-0">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-900 hover:text-indigo-600 truncate block">{doc.name}</a>
                  <p className="text-xs text-slate-400">{doc.size} · {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[doc.type as DocType] ?? TYPE_BADGE['Autre']}`}>{doc.type}</span>
                <button onClick={() => setViewVersionsDoc({ id: doc.id, name: doc.name })}
                  className="hidden group-hover:flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-500">
                  <History className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(doc)}
                  title={deleteConfirmId === doc.id ? 'Confirmer la suppression' : 'Supprimer'}
                  className={`hidden group-hover:flex h-8 w-8 items-center justify-center rounded-xl ${
                    deleteConfirmId === doc.id
                      ? 'text-red-600 bg-red-100 hover:bg-red-200'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                  }`}>
                  {deleteConfirmId === doc.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <UploadModal
          projectId={projectId}
          projectName={projectName}
          onClose={() => setShowModal(false)}
          onUploaded={doc => setDocs(prev => [doc, ...prev])}
        />
      )}
      {viewVersionsDoc && (
        <VersionsModal
          docId={viewVersionsDoc.id}
          docName={viewVersionsDoc.name}
          onClose={() => setViewVersionsDoc(null)}
        />
      )}
    </div>
  )
}

