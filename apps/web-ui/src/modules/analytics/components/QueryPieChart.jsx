import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text)" fontSize={16} fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={13}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function QueryPieChart({ data }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!data?.length) return <div className="an-empty">No data available</div>;

  return (
    <div className="an-pie-wrap">
      <ResponsiveContainer width="60%" height={260}>
        <PieChart>
          <Pie
            activeIndex={activeIdx}
            activeShape={renderActiveShape}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={100}
            dataKey="value"
            onMouseEnter={(_, idx) => setActiveIdx(idx)}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="an-pie-legend">
        {data.map((entry) => (
          <div key={entry.name} className="an-pie-legend-item">
            <span className="an-pie-legend-dot" style={{ background: entry.color }} />
            <span className="an-pie-legend-name">{entry.name}</span>
            <span className="an-pie-legend-val">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
