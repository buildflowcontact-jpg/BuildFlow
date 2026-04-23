import { GanttChartSquare } from 'lucide-react';

interface MilestoneBar {
  id: number;
  name: string;
  start: number;
  duration: number;
  completion: number;
}

const milestones: MilestoneBar[] = [
  { id: 1, name: 'Phase 1: Setup', start: 0, duration: 20, completion: 100 },
  { id: 2, name: 'Phase 2: Dev', start: 18, duration: 35, completion: 60 },
  { id: 3, name: 'Phase 3: Testing', start: 50, duration: 15, completion: 20 },
  { id: 4, name: 'Phase 4: Deploy', start: 63, duration: 10, completion: 0 },
];

const SCALE = 3;

export default function MilestoneGantt() {
  const maxEnd = Math.max(...milestones.map(m => m.start + m.duration));

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <GanttChartSquare size={18} className="text-indigo-600" />
        <h3 className="font-semibold">Gantt des jalons</h3>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header with timeline */}
          <div className="flex mb-4">
            <div className="w-32 flex-shrink-0" />
            <div className="flex-1 border-b-2 border-gray-300 flex">
              {Array.from({ length: Math.ceil(maxEnd / 10) }, (_, i) => (
                <div
                  key={i}
                  className="text-xs text-gray-500 text-center"
                  style={{ width: SCALE * 10 }}
                >
                  {i * 10}
                </div>
              ))}
            </div>
          </div>

          {/* Milestone bars */}
          {milestones.map(milestone => (
            <div key={milestone.id} className="flex mb-2">
              <div className="w-32 flex-shrink-0 text-xs font-medium truncate pr-2">
                {milestone.name}
              </div>
              <div
                className="relative bg-gray-100 rounded h-8 flex items-center"
                style={{ width: SCALE * maxEnd }}
              >
                {/* Total duration bar */}
                <div
                  className="absolute h-full bg-gray-300 rounded"
                  style={{
                    left: SCALE * milestone.start,
                    width: SCALE * milestone.duration,
                  }}
                />

                {/* Completion bar */}
                <div
                  className="absolute h-full bg-indigo-500 rounded"
                  style={{
                    left: SCALE * milestone.start,
                    width: SCALE * milestone.duration * (milestone.completion / 100),
                  }}
                />

                {/* Label */}
                <div
                  className="absolute text-xs font-medium text-white ml-1"
                  style={{
                    left: SCALE * milestone.start,
                  }}
                >
                  {milestone.completion}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span>Complété</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-300" />
          <span>En cours</span>
        </div>
      </div>
    </div>
  );
}
