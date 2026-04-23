import { useState, useEffect } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { getOpenViolations, resolveViolation } from '../lib/slaAlerts';

interface SLAViolation {
  id: string;
  sla_rule_id: string;
  task_id: string | null;
  detected_at: string;
  status: string;
  details?: Record<string, any>;
}

export default function SLADashboard({ projectId }: { projectId: string }) {
  const [violations, setViolations] = useState<SLAViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadViolations();
    const interval = setInterval(loadViolations, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [projectId]);

  async function loadViolations() {
    const data = await getOpenViolations(projectId);
    setViolations(data);
    setLoading(false);
  }

  async function handleResolve(violationId: string) {
    await resolveViolation(violationId);
    loadViolations();
  }

  const criticalViolations = violations.filter(v => v.status === 'open').length;

  if (loading) return <div className="text-center py-4">Chargement...</div>;

  return (
    <div className={`bg-white rounded-lg border p-4 ${criticalViolations > 0 ? 'border-red-300' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className={criticalViolations > 0 ? 'text-red-600 animate-pulse' : 'text-gray-600'} />
          <h3 className="font-semibold">SLA & Alertes</h3>
        </div>
        {criticalViolations > 0 && (
          <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
            <AlertTriangle size={14} />
            {criticalViolations} violation{criticalViolations > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {violations.map(violation => (
          <div
            key={violation.id}
            className={`p-3 rounded border ${
              violation.status === 'open'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {String((violation.details as Record<string, unknown>)?.task_title || 'SLA Violation')}
                </p>
                <p className="text-xs text-gray-600">
                  Détecté: {new Date(violation.detected_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {violation.status === 'open' && (
                <button
                  onClick={() => handleResolve(violation.id)}
                  className="py-1 px-2 bg-green-100 text-green-600 text-xs rounded hover:bg-green-200 font-medium"
                >
                  Résolu
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {violations.length === 0 && (
        <p className="text-sm text-green-600 text-center py-4">✓ Aucune violation SLA</p>
      )}
    </div>
  );
}
