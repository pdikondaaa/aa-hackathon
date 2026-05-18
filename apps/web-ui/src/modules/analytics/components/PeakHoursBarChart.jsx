import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <div className="an-tooltip-label">{label}</div>
      <div className="an-tooltip-value">{payload[0].value} queries</div>
    </div>
  );
};

export default function PeakHoursBarChart({ data }) {
  if (!data?.length) return <div className="an-empty">No data available</div>;

  const max = Math.max(...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }} barSize={22}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,118,188,0.08)' }} />
        <ReferenceLine y={max} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth={1.5} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#27AAE1" opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
