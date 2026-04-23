import React, { useEffect, useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface TaskTemplate {
  id: string
  name: string
  description: string
  priority: string
  estimated_hours?: number
  template_data: Record<string, any>
}

interface TaskTemplateSelectorProps {
  projectId?: string
  onSelect?: (template: TaskTemplate) => void
  showCreate?: boolean
  onClose?: () => void
}

export function TaskTemplateSelector({ projectId, onSelect, showCreate = true, onClose }: TaskTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    priority: 'medium',
    estimated_hours: 0,
  })

  useEffect(() => {
    loadTemplates()
  }, [projectId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const query = supabase.from('task_templates').select('*')

      if (projectId) {
        query.or(`project_id.eq.${projectId},project_id.is.null`)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplate.name.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('task_templates')
        .insert([
          {
            project_id: projectId || null,
            created_by: user.id,
            name: newTemplate.name,
            description: newTemplate.description,
            priority: newTemplate.priority,
            estimated_hours: newTemplate.estimated_hours || null,
            template_data: {},
          },
        ])
        .select()
        .single()

      if (error) throw error

      setTemplates((prev) => [...prev, data])
      setNewTemplate({ name: '', description: '', priority: 'medium', estimated_hours: 0 })
      setCreatingNew(false)
      onSelect?.(data)
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Chargement des modèles...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Copy className="w-5 h-5" /> Modèles de tâches
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Templates list */}
      {templates.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect?.(template)}
              className="w-full text-left p-3 border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition space-y-1"
            >
              <p className="font-medium text-gray-900">{template.name}</p>
              {template.description && <p className="text-sm text-gray-600">{template.description}</p>}
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="capitalize">Priorité: {template.priority}</span>
                {template.estimated_hours && <span>Estimation: {template.estimated_hours}h</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {templates.length === 0 && !creatingNew && (
        <p className="text-sm text-gray-500 text-center py-4">Aucun modèle disponible</p>
      )}

      {/* Create new template */}
      {showCreate && (
        <div className="border-t pt-4">
          {!creatingNew ? (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 transition"
            >
              <Plus className="w-4 h-4" />
              Créer un modèle
            </button>
          ) : (
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.currentTarget.value }))}
                  placeholder="Nom du modèle"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate((prev) => ({ ...prev, description: e.currentTarget.value }))}
                placeholder="Description (optionnel)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTemplate.priority}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, priority: e.currentTarget.value }))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>

                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newTemplate.estimated_hours}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, estimated_hours: parseFloat(e.currentTarget.value) }))}
                  placeholder="Heures estimées"
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreatingNew(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition"
                >
                  Créer
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
