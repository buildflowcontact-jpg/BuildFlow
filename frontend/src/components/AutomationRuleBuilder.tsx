import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, Check } from 'lucide-react';
import { createAutomationRule, getProjectAutomationRules, deleteAutomationRule, getCommonRuleTemplates, type AutomationRule } from '../lib/automationRules';

export default function AutomationRuleBuilder({ projectId }: { projectId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    trigger: 'task_status_change',
    action: 'notify',
  });

  const templates = getCommonRuleTemplates();

  const loadRules = useCallback(async () => {
    const data = await getProjectAutomationRules(projectId);
    setRules(data);
  }, [projectId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  async function handleAddRule() {
    if (!formData.name) return;

    const success = await createAutomationRule(
      projectId,
      formData.name,
      formData.trigger as any,
      {},
      formData.action as any,
      {}
    );

    if (success) {
      setShowForm(false);
      setFormData({ name: '', trigger: 'task_status_change', action: 'notify' });
      loadRules();
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (deleteConfirmRuleId !== ruleId) {
      setDeleteConfirmRuleId(ruleId);
      return;
    }
    const ok = await deleteAutomationRule(ruleId);
    if (ok) {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      setDeleteConfirmRuleId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-yellow-600" />
          <h3 className="font-semibold">Automations</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200"
          title={showForm ? "Fermer le formulaire d'ajout de règle" : "Ajouter une nouvelle règle d'automatisation"}
          aria-label={showForm ? "Fermer le formulaire d'ajout de règle" : "Ajouter une nouvelle règle d'automatisation"}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded border">
          <input
            type="text"
            placeholder="Nom de la règle"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded mb-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={formData.trigger}
              onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="task_status_change">Changement de statut</option>
              <option value="task_assigned">Tâche assignée</option>
              <option value="comment_added">Commentaire ajouté</option>
              <option value="time_logged">Temps enregistré</option>
              <option value="due_date_reached">Date d'échéance</option>
            </select>
            <select
              value={formData.action}
              onChange={(e) => setFormData({ ...formData, action: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="notify">Notifier</option>
              <option value="update_status">Mettre à jour statut</option>
              <option value="assign">Assigner</option>
              <option value="create_task">Créer tâche</option>
              <option value="add_tag">Ajouter tag</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddRule}
              className="flex-1 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium"
            >
              Créer règle
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="py-2 px-4 border rounded hover:bg-gray-100 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Règles existantes */}
      {rules.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-600">Règles actives ({rules.length}) :</p>
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
              <div>
                <p className="text-sm font-medium text-green-900">{rule.name}</p>
                <p className="text-xs text-green-700">{rule.trigger_event} → {rule.action_type}{rule.last_executed_at ? ` · Dernière exécution: ${new Date(rule.last_executed_at).toLocaleDateString('fr-FR')}` : ''}</p>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className={`p-1 rounded ${
                  deleteConfirmRuleId === rule.id
                    ? 'text-red-700 bg-red-100 hover:bg-red-200'
                    : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                }`}
                title={deleteConfirmRuleId === rule.id ? 'Confirmer la suppression' : 'Supprimer'}
                aria-label={deleteConfirmRuleId === rule.id ? 'Confirmer la suppression' : 'Supprimer'}
              >
                {deleteConfirmRuleId === rule.id ? <Check size={14} /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Templates */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Modèles populaires:</p>
        {templates.map((template, idx) => (
          <div key={idx} className="p-2 bg-yellow-50 rounded text-sm border border-yellow-200">
            <p className="font-medium text-yellow-900">{template.name}</p>
            <p className="text-xs text-yellow-800">{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
