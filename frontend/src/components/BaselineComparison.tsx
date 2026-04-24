import { useState, useEffect } from 'react';
import { TrendingDown, Download } from 'lucide-react';
import { getProjectBaselines, getBaselineDriftMetrics } from '../lib/baselinePlanning';

interface Baseline {
  id: string;
  name: string;
  baseline_date: string;
  is_active: boolean;
}

interface ComparisonMetrics {
  totalTasks: number;
  driftedTasks: number;
  averageDrift: number;
  maxDrift: number;
  tasksBehindSchedule: number;
  tasksAheadOfSchedule: number;
}

export default function BaselineComparison({ projectId }: { projectId: string }) {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [selectedBaseline, setSelectedBaseline] = useState<string>('');
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBaselines();
  }, [projectId]);

  async function loadBaselines() {
    const data = await getProjectBaselines(projectId);
    setBaselines(data);
    if (data.length > 0) {
      setSelectedBaseline(data[0].id);
    }
  }

  async function handleCompare() {
    if (!selectedBaseline) return;

    setLoading(true);
    const result = await getBaselineDriftMetrics(projectId, selectedBaseline);
    setMetrics(result);
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown size={18} className="text-amber-600" />
        <h3 className="font-semibold">Baseline de plan</h3>
      </div>

      <div className="space-y-3">
        {/* Sélection baseline */}
        <div>
          <label className="block text-sm font-medium mb-1">Sélectionner une baseline</label>
          <select
            value={selectedBaseline}
            onChange={(e) => setSelectedBaseline(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            {baselines.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} - {new Date(b.baseline_date).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>

        {/* Bouton de comparaison */}
        <button
          onClick={handleCompare}
          disabled={loading || !selectedBaseline}
          className="w-full py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-400 text-sm font-medium"
          title="Comparer la baseline sélectionnée avec l'actuelle"
          aria-label="Comparer la baseline sélectionnée avec l'actuelle"
        >
          {loading ? 'Chargement...' : 'Comparer'}
        </button>

        {/* Résultats */}
        {metrics && (
          <div className="bg-amber-50 p-3 rounded space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tâches décalées:</span>
              <span className="font-semibold">{metrics.driftedTasks} / {metrics.totalTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Décalage moyen:</span>
              <span className="font-semibold text-red-600">{metrics.averageDrift.toFixed(1)} jours</span>
            </div>
            <div className="flex justify-between">
              <span>Décalage max:</span>
              <span className="font-semibold text-red-600">{metrics.maxDrift} jours</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span>En retard:</span>
              <span className="font-semibold text-orange-600">{metrics.tasksBehindSchedule}</span>
            </div>
            <div className="flex justify-between">
              <span>En avance:</span>
              <span className="font-semibold text-green-600">{metrics.tasksAheadOfSchedule}</span>
            </div>
          </div>
        )}

        {baselines.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-3">Aucune baseline créée</p>
        )}
      </div>

      <button
        onClick={() => handleCompare()}
        className="w-full mt-3 py-2 border border-blue-300 text-blue-600 rounded hover:bg-blue-50 text-sm font-medium flex items-center justify-center gap-2"
        title="Créer une nouvelle baseline à partir de l'état actuel"
        aria-label="Créer une nouvelle baseline à partir de l'état actuel"
      >
        <Download size={16} /> Créer nouvelle baseline
      </button>
    </div>
  );
}
