import { useState, useEffect } from 'react';
import { BookOpen, ThumbsUp, CheckCircle } from 'lucide-react';
import { getProjectDecisions } from '../lib/decisionJournal';

interface Decision {
  id: string;
  title: string;
  decision_made: string;
  risk_level: string;
  status: string;
  created_at: string;
}

export default function DecisionJournal({ projectId }: { projectId: string }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    loadDecisions();
  }, [projectId, filter]);

  async function loadDecisions() {
    const data = await getProjectDecisions(projectId);
    let filtered = data.map(d => ({
      id: d.id,
      title: d.title,
      decision_made: d.decision_made,
      risk_level: d.risk_level,
      status: d.status,
      created_at: d.created_at,
    }));

    if (filter === 'pending') {
      filtered = filtered.filter(d => d.status === 'pending');
    } else if (filter === 'approved') {
      filtered = filtered.filter(d => d.status === 'approved');
    }

    setDecisions(filtered);
    setLoading(false);
  }

  async function handleApprove() {
    // Implement approval logic
    loadDecisions();
  }

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'bg-red-100';
    if (risk === 'medium') return 'bg-yellow-100';
    return 'bg-green-100';
  };

  if (loading) return <div className="text-center py-4">Chargement...</div>;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={18} className="text-purple-600" />
        <h3 className="font-semibold">Journal de décisions</h3>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-3">
        {(['all', 'pending', 'approved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded font-medium ${
              filter === f ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : 'Approuvés'}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {decisions.map(decision => (
          <div key={decision.id} className={`p-3 rounded border ${getRiskColor(decision.risk_level)}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">{decision.title}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{decision.decision_made}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(decision.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {decision.status === 'pending' && (
                <button
                  onClick={() => handleApprove()}
                  className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                  title="Approuver"
                >
                  <ThumbsUp size={16} />
                </button>
              )}
              {decision.status === 'approved' && (
                <CheckCircle size={16} className="text-green-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {decisions.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">Aucune décision</p>
      )}
    </div>
  );
}
