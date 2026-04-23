import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, LayoutTemplate, Plus, Trash2, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createProjectDb } from '../lib/db'
import { DateInput } from './DateInput'
import { ModalTabs } from './ModalTabs'

type PatternTask = {
  id: string
  title: string
  subtasks: { id: string; title: string }[]
}

type ProjectPattern = {
  id: string
  name: string
  description: string
  tasks: PatternTask[]
}

type TaskTemplateRow = {
  id: string
  name: string
  description: string | null
  template_data: {
    tasks?: Array<{
      title?: string
      subtasks?: Array<{ title?: string }>
    }>
  } | null
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parsePatternTasks(data: TaskTemplateRow['template_data']): PatternTask[] {
  const rawTasks = data?.tasks ?? []
  return rawTasks
    .map((t) => ({
      id: genId(),
      title: (t.title ?? '').trim(),
      subtasks: (t.subtasks ?? [])
        .map((s) => ({ id: genId(), title: (s.title ?? '').trim() }))
        .filter((s) => s.title.length > 0),
    }))
    .filter((t) => t.title.length > 0)
}

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'template' | 'form'>('template')
  const [selectedPattern, setSelectedPattern] = useState<ProjectPattern | null>(null)
  const [patterns, setPatterns] = useState<ProjectPattern[]>([])
  const [loadingPatterns, setLoadingPatterns] = useState(false)

  const [showPatternCreator, setShowPatternCreator] = useState(false)
  const [templateTab, setTemplateTab] = useState<'browse' | 'create'>('browse')
  const [deletingPatternId, setDeletingPatternId] = useState<string | null>(null)
  const [confirmDeletePatternId, setConfirmDeletePatternId] = useState<string | null>(null)
  const [newPatternName, setNewPatternName] = useState('')
  const [newPatternDescription, setNewPatternDescription] = useState('')
  const [newPatternTasks, setNewPatternTasks] = useState<PatternTask[]>([
    { id: genId(), title: '', subtasks: [] },
  ])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget: '',
    start_date: '',
    end_date: '',
  })
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    loadPatterns()
  }, [isOpen])

  const loadPatterns = async () => {
    setLoadingPatterns(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) {
      setPatterns([])
      setLoadingPatterns(false)
      return
    }

    const { data, error } = await supabase
      .from('task_templates')
      .select('id, name, description, template_data')
      .is('project_id', null)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('loadPatterns:', error)
      setPatterns([])
      setLoadingPatterns(false)
      return
    }

    const mapped = ((data ?? []) as TaskTemplateRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      tasks: parsePatternTasks(row.template_data),
    }))
    setPatterns(mapped)
    setLoadingPatterns(false)
  }

  const choosePattern = (pattern: ProjectPattern | null) => {
    setSelectedPattern(pattern)
    if (pattern) {
      setFormData(fd => ({
        ...fd,
        name: fd.name || pattern.name,
        description: fd.description || pattern.description,
      }))
    }
    setStep('form')
  }

  const handleClose = () => {
    setStep('template')
    setSelectedPattern(null)
    setShowPatternCreator(false)
    setTemplateTab('browse')
    setNewPatternName('')
    setNewPatternDescription('')
    setNewPatternTasks([{ id: genId(), title: '', subtasks: [] }])
    setFormData({ name: '', description: '', budget: '', start_date: '', end_date: '' })
    setFormError('')
    onClose()
  }

  const addPatternTask = () => {
    setNewPatternTasks((prev) => [...prev, { id: genId(), title: '', subtasks: [] }])
  }

  const removePatternTask = (taskId: string) => {
    setNewPatternTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const updatePatternTaskTitle = (taskId: string, title: string) => {
    setNewPatternTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title } : t)))
  }

  const addPatternSubtask = (taskId: string) => {
    setNewPatternTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: [...t.subtasks, { id: genId(), title: '' }] }
    }))
  }

  const removePatternSubtask = (taskId: string, subtaskId: string) => {
    setNewPatternTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
    }))
  }

  const updatePatternSubtaskTitle = (taskId: string, subtaskId: string, title: string) => {
    setNewPatternTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t
      return {
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, title } : s)),
      }
    }))
  }

  const saveNewPattern = async () => {
    const cleanName = newPatternName.trim()
    if (!cleanName) {
      setFormError('Nom du pattern requis')
      return
    }

    const cleanTasks = newPatternTasks
      .map((t) => ({
        title: t.title.trim(),
        subtasks: t.subtasks
          .map((s) => ({ title: s.title.trim() }))
          .filter((s) => s.title.length > 0),
      }))
      .filter((t) => t.title.length > 0)

    if (cleanTasks.length === 0) {
      setFormError('Ajoute au moins une tâche dans le pattern')
      return
    }

    setLoading(true)
    setFormError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) {
      setFormError('Non authentifié')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        project_id: null,
        created_by: userId,
        name: cleanName,
        description: newPatternDescription.trim() || null,
        priority: 'medium',
        template_data: { tasks: cleanTasks },
      })
      .select('id, name, description, template_data')
      .single()

    setLoading(false)
    if (error || !data) {
      setFormError(error?.message ?? 'Impossible de créer le pattern')
      return
    }

    const createdPattern: ProjectPattern = {
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      tasks: parsePatternTasks(data.template_data as TaskTemplateRow['template_data']),
    }

    setPatterns((prev) => [createdPattern, ...prev])
    setSelectedPattern(createdPattern)
    setShowPatternCreator(false)
    setTemplateTab('browse')
    setNewPatternName('')
    setNewPatternDescription('')
    setNewPatternTasks([{ id: genId(), title: '', subtasks: [] }])
  }

  const deletePattern = async (patternId: string) => {
    if (confirmDeletePatternId !== patternId) {
      setConfirmDeletePatternId(patternId)
      return
    }
    setFormError('')
    setDeletingPatternId(patternId)

    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', patternId)
      .is('project_id', null)

    setDeletingPatternId(null)
    if (error) {
      setFormError(error.message)
      return
    }

    setPatterns((prev) => prev.filter((pattern) => pattern.id !== patternId))
    setConfirmDeletePatternId(null)
    if (selectedPattern?.id === patternId) {
      setSelectedPattern(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formData.name.trim()) {
      setFormError('Veuillez entrer un nom de projet')
      return
    }
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) { setFormError('Non authentifié'); setLoading(false); return }
    const project = await createProjectDb(
      {
        name: formData.name,
        description: formData.description || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
      },
      userId
    )
    setLoading(false)
    if (!project.project) {
      setFormError(project.error ? `Erreur Supabase : ${project.error}` : 'Erreur lors de la création du projet')
      return
    }

    // Appliquer le pattern (tâches + sous-tâches) au nouveau projet
    if (selectedPattern && project.project) {
      const projectId = project.project.id
      for (const pTask of selectedPattern.tasks) {
        const title = pTask.title.trim()
        if (!title) continue

        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            project_id: projectId,
            title,
            description: null,
            status: 'todo',
            priority: 'medium',
            created_by: userId,
          })
          .select('id')
          .single()

        if (taskError || !createdTask) {
          console.error('applyPattern task:', taskError)
          continue
        }

        const subtasksToInsert = pTask.subtasks
          .map((s) => ({
            task_id: createdTask.id,
            title: s.title.trim(),
            status: 'todo',
          }))
          .filter((s) => s.title.length > 0)

        if (subtasksToInsert.length > 0) {
          const { error: subtaskError } = await supabase.from('subtasks').insert(subtasksToInsert)
          if (subtaskError) {
            console.error('applyPattern subtasks:', subtaskError)
          }
        }
      }
    }

    setStep('template')
    setSelectedPattern(null)
    setFormData({ name: '', description: '', budget: '', start_date: '', end_date: '' })
    onSuccess?.()
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto my-8">
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">
                Nouveau projet
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 pt-4">
            <ModalTabs
              tabs={[
                { id: 'template', label: 'Pattern' },
                { id: 'form', label: 'Projet' },
              ]}
              value={step}
              onChange={(id) => setStep(id as 'template' | 'form')}
            />
          </div>

          {/* Étape 1 : sélection du modèle */}
          {step === 'template' && (
            <div className="p-6 pt-4 space-y-3">
              <p className="text-sm text-slate-500 mb-4">Choisissez un pattern personnel (tâches + sous-tâches) ou démarrez de zéro.</p>

              <ModalTabs
                tabs={[
                  { id: 'browse', label: 'Mes patterns' },
                  { id: 'create', label: 'Créer un pattern' },
                ]}
                value={templateTab}
                onChange={(id) => {
                  const next = id as 'browse' | 'create'
                  setTemplateTab(next)
                  setShowPatternCreator(next === 'create')
                }}
              />

              {templateTab === 'browse' && (
                <>
              <button
                onClick={() => choosePattern(null)}
                className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition"
              >
                <LayoutTemplate className="h-5 w-5 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Projet vierge</p>
                  <p className="text-xs text-slate-500">Partir de zéro</p>
                </div>
              </button>

              {loadingPatterns && (
                <p className="text-xs text-slate-500">Chargement des patterns...</p>
              )}

              {!loadingPatterns && patterns.length === 0 && (
                <p className="text-xs text-slate-500">Aucun pattern personnel pour l'instant.</p>
              )}

              {!loadingPatterns && patterns.map((pattern) => {
                const subtaskCount = pattern.tasks.reduce((acc, t) => acc + t.subtasks.length, 0)
                return (
                  <div
                    key={pattern.id}
                    className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition"
                  >
                    <button
                      type="button"
                      onClick={() => choosePattern(pattern)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <LayoutTemplate className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{pattern.name}</p>
                        <p className="text-xs text-slate-500 truncate">{pattern.description || 'Pattern personnalisé'}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{pattern.tasks.length} tâches · {subtaskCount} sous-tâches</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      title={confirmDeletePatternId === pattern.id ? 'Confirmer la suppression' : 'Supprimer ce pattern'}
                      disabled={deletingPatternId === pattern.id}
                      onClick={() => deletePattern(pattern.id)}
                      className={`rounded-lg p-2 disabled:opacity-50 transition ${
                        confirmDeletePatternId === pattern.id
                          ? 'text-red-700 bg-red-100 hover:bg-red-200'
                          : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      {confirmDeletePatternId === pattern.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                )
              })}
                </>
              )}

              {templateTab === 'create' && showPatternCreator && (
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nouveau pattern</p>

                  <input
                    type="text"
                    value={newPatternName}
                    onChange={(e) => setNewPatternName(e.target.value)}
                    placeholder="Nom du pattern"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />

                  <textarea
                    value={newPatternDescription}
                    onChange={(e) => setNewPatternDescription(e.target.value)}
                    rows={2}
                    placeholder="Description (optionnel)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />

                  <div className="space-y-2">
                    {newPatternTasks.map((task, taskIdx) => (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updatePatternTaskTitle(task.id, e.target.value)}
                            placeholder={`Tâche ${taskIdx + 1}`}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => removePatternTask(task.id)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                            title="Supprimer la tâche"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="pl-2 space-y-2">
                          {task.subtasks.map((subtask, subIdx) => (
                            <div key={subtask.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={subtask.title}
                                onChange={(e) => updatePatternSubtaskTitle(task.id, subtask.id, e.target.value)}
                                placeholder={`Sous-tâche ${subIdx + 1}`}
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => removePatternSubtask(task.id, subtask.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                                title="Supprimer la sous-tâche"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addPatternSubtask(task.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition"
                          >
                            <Plus className="h-3 w-3" /> Sous-tâche
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addPatternTask}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ajouter une tâche
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={saveNewPattern}
                      disabled={loading}
                      className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      {loading ? 'Enregistrement...' : 'Enregistrer le pattern'}
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <p className="w-full rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{formError}</p>
              )}
            </div>
          )}

          {/* Étape 2 : formulaire */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
              {selectedPattern && (
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2">
                  <LayoutTemplate className="h-4 w-4 text-indigo-600" />
                  <p className="text-xs font-medium text-indigo-700">Pattern : {selectedPattern.name} · tâches et sous-tâches seront créées automatiquement</p>
                </div>
              )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Nom du projet *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Application mobile BuildFlow"
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
                placeholder="Décris les objectifs du projet..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
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
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Date de début
                </label>
                <DateInput
                  value={formData.start_date}
                  onChange={(v) => setFormData({ ...formData, start_date: v })}
                  max={formData.end_date || undefined}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Date de fin
                </label>
                <DateInput
                  value={formData.end_date}
                  onChange={(v) => setFormData({ ...formData, end_date: v })}
                  min={formData.start_date || undefined}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              {formError && (
                <p className="w-full rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{formError}</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold text-sm transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-950 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm transition"
              >
                {loading ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </form>
          )}
      </div>
    </div>,
    document.body
  )
}

