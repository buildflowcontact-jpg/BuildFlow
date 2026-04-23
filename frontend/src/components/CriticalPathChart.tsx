import { TrendingUp } from 'lucide-react';

export default function CriticalPathChart() {
  // Simplified critical path visualization

  const tasks = [
    { id: 1, title: 'Tâche 1', duration: 5, slack: 0 },
    { id: 2, title: 'Tâche 2', duration: 3, slack: 2 },
    { id: 3, title: 'Tâche 3', duration: 7, slack: 0 },
  ];

  const maxDuration = Math.max(...tasks.map(t => t.duration + t.slack));

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-green-600" />
        <h3 className="font-semibold">Chemin critique</h3>
      </div>

      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id}>
            <p className="text-sm font-medium mb-1">{task.title}</p>
            <div className="flex gap-1 items-center h-6">
              {/* Durée réelle */}
              <div
                className={`h-5 rounded flex items-center justify-center text-xs font-medium text-white ${
                  task.slack === 0 ? 'bg-red-600' : 'bg-green-600'
                }`}
                style={{ width: `${(task.duration / maxDuration) * 200}px` }}
              >
                {task.duration}j
              </div>
              {/* Slack */}
              {task.slack > 0 && (
                <div
                  className="h-5 rounded bg-yellow-300 flex items-center justify-center text-xs"
                  style={{ width: `${(task.slack / maxDuration) * 200}px` }}
                />
              )}
              <span className="text-xs text-gray-500 ml-2">{task.slack > 0 ? `+${task.slack}j flex` : 'Critique'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-2 bg-blue-50 rounded text-xs">
        <p className="font-medium text-blue-900">Durée totale du projet: {maxDuration} jours</p>
      </div>
    </div>
  );
}
