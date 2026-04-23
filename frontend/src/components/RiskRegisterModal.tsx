import { useState, useEffect } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { getProjectRisks, createRisk, deleteRisk, getRisksByPriority } from '../lib/riskRegister';

interface Risk {
  id: string;
  title: string;
  probability: string;
  impact: string;
  status: string;
}

export default function RiskRegisterModal({ projectId }: { projectId: string }) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    probability: 'medium',
    impact: 'medium',
  });
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');

  useEffect(() => {
    loadRisks();
  }, [projectId, sortBy]);

 async function loadRisks() {
    let data: Risk[];
    if (sortBy === 'priority') {
      const result = await getRisksByPriority(projectId);
      data = result.map(r => ({
        id: r.id,
        title: r.title,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
      }));
    } else {
      data = (await getProjectRisks(projectId)).map(r => ({
        id: r.id,
        title: r.title,
        probability: r.probability,
        impact: r.impact,
        status: r.status,
      }));
    }
    setRisks(data);
  }

  async function handleAddRisk() {
    if (!formData.title) return;

    const success = await createRisk(
      projectId,
      formData.title,
      formData.description,
      formData.probability as any,
      formData.impact as any
    );

    if (success) {
      setShowForm(false);
      setFormData({ title: '', description: '', probability: 'medium', impact: 'medium' });
      loadRisks();
    }
  }

  async function handleDeleteRisk(riskId: string) {
    const success = await deleteRisk(riskId);
    if (success) {
      loadRisks();
    }
  }

  const getPriorityColor = (probability: string, impact: string) => {
    const scoreMap: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
    const score = (scoreMap[probability] || 3) * (scoreMap[impact] || 3);

    if (score >= 16) return 'bg-red-100 border-red-300';
    if (score >= 12) return 'bg-orange-100 border-orange-300';
    if (score >= 6) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  return (
    <div className="bg-white rounded-lg border p-4      max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-red-600" />
          <h3 className="font-semibold">Registre des risques</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded border">
          <input
            type="text"
            placeholder="Titre du risque"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border rounded mb-2 text-sm"
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded mb-2 text-sm h-20"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={formData.probability}
              onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="very_low">Très faible</option>
              <option value="low">Faible</option>
              <option value="medium">Moyen</option>
              <option value="high">Élevé</option>
              <option value="very_high">Très élevé</option>
            </select>
            <select
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="very_low">Impact très faible</option>
              <option value="low">Impact faible</option>
              <option value="medium">Impact moyen</option>
              <option value="high">Impact élevé</option>
              <option value="very_high">Impact très élevé</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddRisk}
              className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
            >
              Ajouter le risque
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

      {/* Tri */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSortBy('priority')}
          className={`px-3 py-1 text-xs rounded font-medium ${sortBy === 'priority' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
        >
          Par priorité
        </button>
        <button
          onClick={() => setSortBy('date')}
          className={`px-3 py-1 text-xs rounded font-medium ${sortBy === 'date' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
        >
          Par date
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {risks.map(risk => (
          <div
            key={risk.id}
            className={`p-3 rounded border ${getPriorityColor(risk.probability, risk.impact)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">{risk.title}</p>
                <p className="text-xs text-gray-600">
                  {risk.probability} · {risk.impact}
                </p>
              </div>
              <button
                onClick={() => handleDeleteRisk(risk.id)}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {risks.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 text-center py-4">Aucun risque identifié</p>
      )}
    </div>
  );
}
