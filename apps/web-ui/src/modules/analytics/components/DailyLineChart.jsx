import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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

export default function DailyLineChart({ data }) {
  if (!data?.length) return <div className="an-empty">No data available</div>;

  const show = data.slice(-14);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={show} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="queries"
          name="Queries"
          stroke="#1D76BC"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#1D76BC' }}
        />
        <Line
          type="monotone"
          dataKey="users"
          name="Active Users"
          stroke="#4ED44E"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#4ED44E' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
