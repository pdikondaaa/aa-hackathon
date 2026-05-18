import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
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

export default function ActiveUsersAreaChart({ data }) {
  if (!data?.length) return <div className="an-empty">No data available</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <defs>
          <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#27AAE1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#27AAE1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1D76BC" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1D76BC" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="week"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }} />
        <Area
          type="monotone"
          dataKey="total"
          name="Total Users"
          stroke="#1D76BC"
          strokeWidth={2}
          fill="url(#gradTotal)"
        />
        <Area
          type="monotone"
          dataKey="active"
          name="Active Users"
          stroke="#27AAE1"
          strokeWidth={2.5}
          fill="url(#gradActive)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
