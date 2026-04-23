import { useState, useEffect } from 'react';
import { Grid3X3 } from 'lucide-react';
import { getProjectRisks, type Risk, type ProbabilityLevel, type ImpactLevel } from '../lib/riskRegister';

const PROB_LABELS: Record<ProbabilityLevel, string> = {
  very_high: 'Très élevée',
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
  very_low: 'Très faible',
};

const IMPACT_COLS: ImpactLevel[] = ['low', 'medium', 'high'];
const IMPACT_COL_LABELS: Record<ImpactLevel, string> = { very_low: 'Très faible', low: 'Faible', medium: 'Moyen', high: 'Élevé', very_high: 'Très élevé' };
const PROB_ROWS: ProbabilityLevel[] = ['very_high', 'high', 'medium', 'low', 'very_low'];

export default function RiskMatrix({ projectId }: { projectId?: string }) {
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [totalRisks, setTotalRisks] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectRisks(projectId).then((risks: Risk[]) => {
      const m: Record<string, number> = {};
      for (const r of risks) {
        const key = `${r.probability}|${r.impact}`;
        m[key] = (m[key] ?? 0) + 1;
      }
      setMatrix(m);
      setTotalRisks(risks.length);
      setLoading(false);
    });
  }, [projectId]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-green-100 text-green-600';
    if (count === 1) return 'bg-yellow-100 text-yellow-600';
    if (count === 2) return 'bg-orange-100 text-orange-600';
    return 'bg-red-100 text-red-600';
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Grid3X3 size={18} className="text-red-600" />
          <h3 className="font-semibold">Matrice de risque</h3>
        </div>
        {!projectId && <span className="text-xs text-gray-400">Aucun projet sélectionné</span>}
        {loading && <span className="text-xs text-gray-400">Chargement…</span>}
        {!loading && totalRisks > 0 && <span className="text-xs text-gray-500">{totalRisks} risque{totalRisks > 1 ? 's' : ''}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left p-2 bg-gray-50">Probabilité / Impact</th>
              {IMPACT_COLS.map(imp => (
                <th key={imp} className="p-2 bg-gray-50 text-center font-medium">{IMPACT_COL_LABELS[imp]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROB_ROWS.map((prob) => (
              <tr key={prob} className="border-b">
                <td className="p-2 font-medium bg-gray-50">{PROB_LABELS[prob]}</td>
                {IMPACT_COLS.map(imp => {
                  const count = matrix[`${prob}|${imp}`] ?? 0;
                  return (
                    <td key={imp} className={`p-2 text-center font-semibold ${getColor(count)}`}>
                      {count > 0 ? count : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-100" /><span>Faible risque</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-yellow-100" /><span>Risque modéré</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-100" /><span>Risque élevé</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-100" /><span>Critique</span></div>
      </div>
    </div>
  );
}
