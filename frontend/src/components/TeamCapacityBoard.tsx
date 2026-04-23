import { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { getTeamWorkloadStatus, detectWorkloadOverloads } from '../lib/workloadDistribution';

interface WorkloadStatus {
  user_id: string;
  user_name: string;
  available_hours: number;
  allocated_hours: number;
  utilization_percent: number;
  overloaded: boolean;
  remaining_capacity: number;
}

export default function TeamCapacityBoard({ projectId, weekStart }: { projectId: string; weekStart: Date }) {
  const [workload, setWorkload] = useState<WorkloadStatus[]>([]);
  const [overloads, setOverloads] = useState<WorkloadStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkload();
  }, [projectId, weekStart]);

 async function loadWorkload() {
    setLoading(true);
    const status = await getTeamWorkloadStatus(projectId, weekStart);
    const overloaded = await detectWorkloadOverloads(projectId, weekStart);

    setWorkload(status);
    setOverloads(overloaded);
    setLoading(false);
  }

  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return 'bg-green-100';
    if (percent < 80) return 'bg-yellow-100';
    if (percent < 100) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getUtilizationBarColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    if (percent < 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return <div className="text-center py-4">Chargement...</div>;
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h3 className="font-semibold">Distribution de charge</h3>
        </div>
        {overloads.length > 0 && (
          <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
            <AlertTriangle size={14} />
            {overloads.length} surchargé{overloads.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {workload.map(status => (
          <div
            key={status.user_id}
            className={`p-3 rounded-lg border ${getUtilizationColor(status.utilization_percent)}`}
          >
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="font-medium text-sm">{status.user_name}</p>
                <p className="text-xs text-gray-600">
                  {status.allocated_hours.toFixed(1)}h / {status.available_hours}h
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{status.utilization_percent}%</p>
                <p className={`text-xs ${status.overloaded ? 'text-red-600' : 'text-green-600'}`}>
                  {status.overloaded ? `+${(status.allocated_hours - status.available_hours).toFixed(1)}h` : `${status.remaining_capacity.toFixed(1)}h libre`}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white bg-opacity-50 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getUtilizationBarColor(status.utilization_percent)} transition-all`}
                style={{ width: `${Math.min(100, status.utilization_percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {workload.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">Aucune donnée de capacité</p>
      )}
    </div>
  );
}
