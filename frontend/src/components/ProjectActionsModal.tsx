import React, { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { updateProjectDb, archiveProjectDb, deleteProjectDb } from '../lib/db'
import { DateInput } from './DateInput'
import { ModalTabs } from './ModalTabs'

const spinnerStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
    opacity: 1;
    height: 24px;
    background-color: #ffffff;
    border-left: 1px solid #d1d5db;
    color: #374151;
  }
  
  input[type="number"]::-webkit-outer-spin-button:hover,
  input[type="number"]::-webkit-inner-spin-button:hover {
    background-color: #f3f4f6;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
  }
`

interface ProjectActionsModalProps {
  projectId: string
  projectName: string
  projectDescription?: string
  projectBudget?: number
  projectStartDate?: string
  projectEndDate?: string
  onClose: () => void
  onSuccess?: () => void
}

export const ProjectActionsModal: React.FC<ProjectActionsModalProps> = ({
  projectId,
  projectName,
  projectDescription,
  projectBudget,
  projectStartDate,
  projectEndDate,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'archive' | 'delete'>('edit')
  const [formData, setFormData] = useState({
    name: projectName,
    description: projectDescription || '',
    budget: projectBudget ? String(projectBudget) : '',
    startDate: projectStartDate || '',
    endDate: projectEndDate || '',
  })
  const [actionError, setActionError] = useState('')
  const [confirmStep, setConfirmStep] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  React.useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onEscape)
    }
  }, [onClose])

  const switchTab = (tab: 'edit' | 'archive' | 'delete') => {
    setActiveTab(tab)
    setConfirmStep(false)
    setActionError('')
  }

  const getSession = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionError('')
    setUpdateLoading(true)
    const userId = await getSession()
    if (!userId) { setActionError('Non authentifié'); setUpdateLoading(false); return }
    const ok = await updateProjectDb(
      projectId,
      {
        name: formData.name || undefined,
        description: formData.description || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        start_date: formData.startDate || undefined,
        end_date: formData.endDate || undefined,
      },
      userId
    )
    setUpdateLoading(false)
    if (!ok) { setActionError('Erreur lors de la modification'); return }
    onSuccess?.()
    onClose()
  }

  const handleArchive = async () => {
    if (!confirmStep) { setConfirmStep(true); return }
    setActionError('')
    setArchiveLoading(true)
    const userId = await getSession()
    if (!userId) { setActionError('Non authentifié'); setArchiveLoading(false); return }
    const ok = await archiveProjectDb(projectId, userId)
    setArchiveLoading(false)
    if (!ok) { setActionError("Erreur lors de l'archivage"); setConfirmStep(false); return }
    onSuccess?.()
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmStep) { setConfirmStep(true); return }
    setActionError('')
    setDeleteLoading(true)
    const userId = await getSession()
    if (!userId) { setActionError('Non authentifié'); setDeleteLoading(false); return }
    const ok = await deleteProjectDb(projectId, userId)
    setDeleteLoading(false)
    if (!ok) { setActionError('Erreur lors de la suppression'); setConfirmStep(false); return }
    onSuccess?.()
    onClose()
  }

  return (
    <>
      <style>{spinnerStyles}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres du projet"
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] bf-modal-panel overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-900">Paramètres du projet</h2>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <ModalTabs
              tabs={[
                { id: 'edit', label: 'Modifier', accent: 'indigo' },
                { id: 'archive', label: 'Archiver', accent: 'amber' },
                { id: 'delete', label: 'Supprimer', accent: 'rose' },
              ]}
              value={activeTab}
              onChange={(id) => switchTab(id as 'edit' | 'archive' | 'delete')}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'edit' && (
              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Nom du projet
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Date de début
                    </label>
                    <DateInput
                      value={formData.startDate}
                      onChange={(value) => setFormData({ ...formData, startDate: value })}
                      max={formData.endDate || undefined}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Date de fin
                    </label>
                    <DateInput
                      value={formData.endDate}
                      onChange={(value) => setFormData({ ...formData, endDate: value })}
                      min={formData.startDate || undefined}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Budget (€)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
                    }
                    className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>

                {actionError && activeTab === 'edit' && (
                  <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{actionError}</p>
                )}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold text-sm transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updateLoading}
                    className="flex-1 px-4 py-3 bg-slate-950 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm transition"
                  >
                    {updateLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'archive' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-900 mb-2">Archiver le projet</h3>
                  <p className="text-amber-800 text-sm">
                    L'archivage marquera ce projet comme inactif. Vous pourrez toujours
                    y accéder et le désarchiver plus tard, mais il n'apparaîtra pas dans
                    la liste active par défaut.
                  </p>
                </div>
                {confirmStep && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
                    Attention: confirmez-vous l'archivage de ce projet ?
                  </div>
                )}
                {actionError && activeTab === 'archive' && (
                  <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{actionError}</p>
                )}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { onClose(); setConfirmStep(false) }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold text-sm transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiveLoading}
                    className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 disabled:opacity-50 font-semibold text-sm transition"
                  >
                    {archiveLoading ? 'Archivage...' : confirmStep ? 'Confirmer l\'archivage' : 'Archiver le projet'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'delete' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="font-semibold text-red-900 mb-2">Supprimer le projet</h3>
                  <p className="text-red-800 text-sm">
                    La suppression est <strong>permanente et irréversible</strong>. Toutes les
                    données du projet (tâches, documents, membres, etc.) seront supprimées.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    <strong>Seul le créateur du projet</strong> peut le supprimer.
                  </p>
                </div>
                {confirmStep && (
                  <div className="rounded-2xl border border-red-300 bg-red-100 px-4 py-3 text-sm font-medium text-red-900">
                    Attention: cette action est irréversible. Confirmez-vous la suppression ?
                  </div>
                )}
                {actionError && activeTab === 'delete' && (
                  <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{actionError}</p>
                )}
                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { onClose(); setConfirmStep(false) }}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold text-sm transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 disabled:opacity-50 font-semibold text-sm transition"
                  >
                    {deleteLoading ? 'Suppression...' : confirmStep ? 'Confirmer la suppression' : 'Supprimer définitivement'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

