import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import React from 'react';

interface ReportsChartFullProps {
  weeklyCompletionData: { label: string; count: number }[];
}

export default function ReportsChartFull({ weeklyCompletionData }: ReportsChartFullProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={weeklyCompletionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
