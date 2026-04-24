import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import React from 'react';

const data = [
  { week: 'Sem 1', allocated: 40, available: 40, utilization: 100 },
  { week: 'Sem 2', allocated: 42, available: 40, utilization: 105 },
  { week: 'Sem 3', allocated: 38, available: 40, utilization: 95 },
  { week: 'Sem 4', allocated: 45, available: 40, utilization: 112 },
];

export default function WorkloadChartFull() {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-cyan-600" />
        <h3 className="font-semibold">Charge de travail par semaine</h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="allocated"
            stroke="#3b82f6"
            name="Allouées"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="available"
            stroke="#10b981"
            name="Disponibles"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-2 bg-yellow-50 rounded text-xs border border-yellow-200">
        <p className="text-yellow-900">
          ⚠ Surcharge: La semaine 4 dépasse la capacité de 12%
        </p>
      </div>
    </div>
  );
}
