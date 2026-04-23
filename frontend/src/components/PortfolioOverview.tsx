import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { getPortfolioMetrics } from '../lib/portfolio';

interface Metrics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  at_risk_projects: number;
  total_tasks: number;
  completed_tasks: number;
  average_completion: number;
}

export default function PortfolioOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    const data = await getPortfolioMetrics();
    setMetrics(data);
    setLoading(false);
  }

  if (loading) return <div className="text-center py-4">Chargement...</div>;
  if (!metrics) return null;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-indigo-600" />
        <h3 className="font-semibold">Portfolio</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-xs text-gray-600">Projets</p>
          <p className="text-xl font-semibold text-blue-600">{metrics.total_projects}</p>
          <p className="text-xs text-gray-500">{metrics.active_projects} actifs</p>
        </div>

        <div className="p-3 bg-green-50 rounded">
          <p className="text-xs text-gray-600">Complétés</p>
          <p className="text-xl font-semibold text-green-600">{metrics.completed_projects}</p>
          <p className="text-xs text-gray-500">{Math.round((metrics.completed_projects / metrics.total_projects) * 100)}%</p>
        </div>

        <div className="p-3 bg-orange-50 rounded">
          <p className="text-xs text-gray-600">À risque</p>
          <p className="text-xl font-semibold text-orange-600">{metrics.at_risk_projects}</p>
          <p className="text-xs text-gray-500">{metrics.total_tasks} tâches</p>
        </div>

        <div className="p-3 bg-purple-50 rounded">
          <p className="text-xs text-gray-600">Progression</p>
          <p className="text-xl font-semibold text-purple-600">{metrics.average_completion}%</p>
          <p className="text-xs text-gray-500">{metrics.completed_tasks} complétées</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">Progression globale</span>
          <span className="font-semibold">{metrics.average_completion}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${metrics.average_completion}%` }}
          />
        </div>
      </div>
    </div>
  );
}
