import { useState, useEffect } from 'react';
import { Flag, CheckCircle, AlertTriangle } from 'lucide-react';
import { getProjectMilestones, updateMilestoneStatus } from '../lib/milestones';

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  status: string;
  completion_percent: number;
  is_on_track: boolean;
  task_count?: number;
}

export default function MilestoneTracker({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  async function loadMilestones() {
    const data = await getProjectMilestones(projectId);
    setMilestones(data.map(m => ({
      id: m.id,
      name: m.name,
      target_date: m.target_date,
      status: m.status,
      completion_percent: m.completion_percent,
      is_on_track: m.is_on_track,
      task_count: m.tasks.length,
    })));
    setLoading(false);
  }

  async function handleStatusChange(milestoneId: string, newStatus: string) {
    await updateMilestoneStatus(milestoneId, newStatus as any);
    loadMilestones();
  }

  const getStatusIcon = (milestone: Milestone) => {
    if (milestone.status === 'completed') return <CheckCircle size={16} className="text-green-600" />;
    if (!milestone.is_on_track) return <AlertTriangle size={16} className="text-red-600" />;
    return <Flag size={16} className="text-blue-600" />;
  };

  const getStatusColor = (status: string, isOnTrack: boolean) => {
    if (status === 'completed') return 'bg-green-50';
    if (!isOnTrack) return 'bg-red-50';
    if (status === 'in_progress') return 'bg-blue-50';
    return 'bg-gray-50';
  };

  if (loading) return <div className="text-center py-4">Chargement...</div>;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Flag size={18} /> Jalons
      </h3>

      <div className="space-y-2">
        {milestones.map(milestone => (
          <div
            key={milestone.id}
            className={`p-3 rounded border ${getStatusColor(milestone.status, milestone.is_on_track)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-1">
                {getStatusIcon(milestone)}
                <div>
                  <p className="font-medium text-sm">{milestone.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(milestone.target_date).toLocaleDateString('fr-FR')} · {milestone.task_count} tâches
                  </p>
                </div>
              </div>
              <select
                value={milestone.status}
                onChange={(e) => handleStatusChange(milestone.id, e.target.value)}
                className="px-2 py-1 text-xs border rounded bg-white font-medium"
              >
                <option value="planned">Planifié</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Complété</option>
                <option value="postponed">Reporté</option>
              </select>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all"
                style={{ width: `${milestone.completion_percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1 text-right">{milestone.completion_percent}%</p>
          </div>
        ))}
      </div>

      {milestones.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">Aucun jalon</p>
      )}
    </div>
  );
}
