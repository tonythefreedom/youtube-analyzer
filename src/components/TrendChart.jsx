import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-primary/30 p-2 rounded shadow-xl text-xs">
        <p className="font-bold text-primary">{payload[0].name}</p>
        <p className="text-gray-400">Trend Score: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const CustomizedContent = (props) => {
  const { root, depth = 0, x, y, width, height, index, payload, name, onCategoryClick } = props;

  return (
    <g 
      onClick={() => onCategoryClick && onCategoryClick(name)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: index % 2 === 0 ? '#16161a' : '#1a1a20',
          stroke: '#00f2ff',
          strokeWidth: 2 / (depth + 1),
          strokeOpacity: 0.3,
        }}
        className="hover:fill-primary/10 transition-colors"
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#00f2ff"
          fontSize={Math.min(width / 6, 14)}
          className="font-bold pointer-events-none select-none"
        >
          {name}
        </text>
      )}
    </g>
  );
};

const TrendChart = ({ data, onCategoryClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-gray-700 rounded-xl">
        <p className="text-gray-500 text-xs uppercase tracking-widest animate-pulse">Waiting for AI Analysis...</p>
      </div>
    );
  }

  // [v3.2.4] 데이터 안정성 확보: 유효한 데이터만 필터링하고 고유 키 보장
  const safeData = data
    .filter(item => item && item.name)
    .map((item, idx) => ({
      ...item,
      id: `node-${item.name}-${idx}` // 고유 ID 강제 부여
    }));

  return (
    <div className="w-full h-[600px] bg-surface/50 rounded-2xl p-6 border border-gray-800 shadow-inner">
      <h3 className="text-[10px] font-black text-gray-500 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_theme('colors.primary')]"></span>
        Deep AI Trend Map (Extended Keyword Analysis)
      </h3>
      <div className="w-full h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={safeData}
            dataKey="value"
            stroke="#fff"
            fill="#8884d8"
            content={<CustomizedContent onCategoryClick={onCategoryClick} />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;

