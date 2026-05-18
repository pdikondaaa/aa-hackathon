import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <div className="an-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="an-tooltip-row">
          <span className="an-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

export default function SuccessFailedChart({ data }) {
  if (!data?.length) return <div className="an-empty">No data available</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }} barSize={20} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,118,188,0.05)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }} />
        <Bar dataKey="success" name="Success"  radius={[4,4,0,0]} fill="#4ED44E" />
        <Bar dataKey="failed"  name="Failed"   radius={[4,4,0,0]} fill="#f05252" />
      </BarChart>
    </ResponsiveContainer>
  );
}
