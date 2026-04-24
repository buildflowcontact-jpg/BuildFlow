import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import React from 'react';

interface PortfolioChartFullProps {
  chartData: { name: string; completion: number; status: string }[];
  chartColors: Record<string, string>;
}

export default function PortfolioChartFull({ chartData, chartColors }: PortfolioChartFullProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, 'Avancement']} />
        <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={chartColors[entry.status] ?? '#6366f1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
