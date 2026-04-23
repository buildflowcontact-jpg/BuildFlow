import { useState, useEffect } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { getTaskDependencies, createTaskDependency, deleteTaskDependency } from '../lib/taskDependencies';
import { supabase } from '../lib/supabase';

interface Task {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

interface TaskDependency {
  id: string;
  source_task_id: string;
  target_task_id: string;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag_days: number;
}

export default function TaskDependenciesGraph({ taskId }: { taskId: string }) {
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [depType, setDepType] = useState<'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'>('finish_to_start');

  useEffect(() => {
    loadDependencies();
  }, [taskId]);

  async function loadDependencies() {
    const deps = await getTaskDependencies(taskId);
    setDependencies(deps);

    // Charger les tâches impliquées
    const taskIds = new Set([
      taskId,
      ...deps.map(d => d.source_task_id),
      ...deps.map(d => d.target_task_id),
    ]);

    const taskMap = new Map<string, Task>();

    for (const id of Array.from(taskIds)) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, status, start_date, end_date')
        .eq('id', id)
        .single();

      if (task) {
        taskMap.set(id, task);
      }
    }

    setTasks(taskMap);
  }

  async function handleAddDependency() {
    if (!selectedTarget) return;

    const success = await createTaskDependency(
      taskId,
      selectedTarget,
      depType,
      0
    );

    if (success) {
      setShowForm(false);
      setSelectedTarget('');
      loadDependencies();
    }
  }

  async function handleDeleteDependency(depId: string) {
    const success = await deleteTaskDependency(depId);
    if (success) {
      loadDependencies();
    }
  }

  const outgoing = dependencies.filter(d => d.source_task_id === taskId);
  const incoming = dependencies.filter(d => d.target_task_id === taskId);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <ArrowRight size={18} className="text-indigo-600" />
        Dépendances de tâches
      </h3>

      {/* Dépendances entrantes */}
      {incoming.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Dépend de:</p>
          {incoming.map(dep => (
            <div key={dep.id} className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium">{tasks.get(dep.source_task_id)?.title || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{dep.dependency_type.replace(/_/g, ' ')}</p>
              </div>
              <button
                onClick={() => handleDeleteDependency(dep.id)}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dépendances sortantes */}
      {outgoing.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Bloque:</p>
          {outgoing.map(dep => (
            <div key={dep.id} className="flex items-center gap-2 mb-2 p-2 bg-orange-50 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium">{tasks.get(dep.target_task_id)?.title || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{dep.dependency_type.replace(/_/g, ' ')}</p>
              </div>
              <button
                onClick={() => handleDeleteDependency(dep.id)}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-2 border border-indigo-300 text-indigo-600 rounded hover:bg-indigo-50 text-sm font-medium"
        >
          + Ajouter une dépendance
        </button>
      )}

      {showForm && (
        <div className="border-t pt-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Type de dépendance</label>
              <select
                value={depType}
                onChange={(e) => setDepType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="finish_to_start">Fin → Début</option>
                <option value="start_to_start">Début → Début</option>
                <option value="finish_to_finish">Fin → Fin</option>
                <option value="start_to_finish">Début → Fin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tâche cible</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Sélectionner une tâche...</option>
                {Array.from(tasks.values()).map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddDependency}
              className="flex-1 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
            >
              Ajouter
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="py-2 px-4 border rounded hover:bg-gray-50 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {dependencies.length === 0 && !showForm && (
        <p className="text-sm text-gray-500 text-center py-3">Aucune dépendance</p>
      )}
    </div>
  );
}
