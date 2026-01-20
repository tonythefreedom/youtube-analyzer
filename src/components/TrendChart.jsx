import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-primary/30 p-2 rounded shadow-xl text-xs">
        <p className="font-bold text-primary">{payload[0].name}</p>
        <p className="text-gray-400">Trend Score: {payload[0].value}</p>
        <p className="text-gray-500 text-[10px] mt-1">Click to select/deselect</p>
      </div>
    );
  }
  return null;
};

// [v4.3.0] 다중 선택 지원하는 CustomizedContent
const CustomizedContent = (props) => {
  const { root, depth = 0, x, y, width, height, index, payload, name, onKeywordToggle, selectedKeywords = [] } = props;
  const isSelected = selectedKeywords.includes(name);

  const handleClick = (e) => {
    e.stopPropagation();
    console.log('[TrendChart] Keyword clicked:', name);
    if (onKeywordToggle) {
      onKeywordToggle(name);
    }
  };

  return (
    <g
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: isSelected ? '#00f2ff20' : (index % 2 === 0 ? '#16161a' : '#1a1a20'),
          stroke: isSelected ? '#00f2ff' : '#00f2ff',
          strokeWidth: isSelected ? 3 : 2 / (depth + 1),
          strokeOpacity: isSelected ? 1 : 0.3,
        }}
        className="hover:fill-primary/10 transition-colors"
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isSelected ? '#00f2ff' : '#00f2ff'}
          fontSize={Math.min(width / 6, 14)}
          fontWeight={isSelected ? 'bold' : 'normal'}
          className="pointer-events-none select-none"
        >
          {isSelected ? `✓ ${name}` : name}
        </text>
      )}
    </g>
  );
};

// [v4.3.0] 다중 선택 및 검색 기능 추가
const TrendChart = ({ data, onCategoryClick, selectedKeywords = [], onKeywordToggle, onSearchSelectedKeywords, onClearSelectedKeywords }) => {
  // [v3.5.9] 제목은 항상 표시되도록 수정
  // [v3.6.0] 디버깅 로그 추가
  console.log('[TrendChart] Received data:', data);
  console.log('[TrendChart] Data type:', typeof data);
  console.log('[TrendChart] Is array:', Array.isArray(data));
  console.log('[TrendChart] Data length:', data?.length);

  const hasData = data && Array.isArray(data) && data.length > 0;

  // [v3.2.4] 데이터 안정성 확보: 유효한 데이터만 필터링하고 고유 키 보장
  const safeData = hasData
    ? data
        .filter(item => {
          const isValid = item && item.name && (item.value !== undefined && item.value !== null);
          if (!isValid) {
            console.warn('[TrendChart] Invalid item:', item);
          }
          return isValid;
        })
        .map((item, idx) => ({
          ...item,
          id: `node-${item.name}-${idx}` // 고유 ID 강제 부여
        }))
    : [];

  console.log('[TrendChart] Safe data length:', safeData.length);
  console.log('[TrendChart] Has data:', hasData);

  return (
    <div className="w-full h-[600px] bg-surface/50 rounded-2xl p-6 border border-gray-800 shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2 relative z-10">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_theme('colors.primary')]"></span>
          <span className="text-primary/80">Deep AI Trend Map</span>
          <span className="text-gray-500">(Click keywords to select)</span>
        </h3>
        {/* [v4.3.0] 선택된 키워드로 검색하는 버튼들 */}
        {selectedKeywords.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">{selectedKeywords.length} selected</span>
            <button
              onClick={onClearSelectedKeywords}
              className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onSearchSelectedKeywords}
              className="px-3 py-1 text-[10px] bg-primary hover:bg-primary/80 text-black font-bold rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Keywords
            </button>
          </div>
        )}
      </div>
      {/* [v4.3.0] 선택된 키워드 태그 표시 */}
      {selectedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {selectedKeywords.map((keyword, idx) => (
            <span
              key={idx}
              onClick={() => onKeywordToggle && onKeywordToggle(keyword)}
              className="px-2 py-0.5 text-[10px] bg-primary/20 text-primary border border-primary/50 rounded-full cursor-pointer hover:bg-primary/30 transition-colors"
            >
              {keyword} ✕
            </span>
          ))}
        </div>
      )}
      {hasData && safeData.length > 0 ? (
        <div className={`w-full relative bg-black/20 rounded-xl overflow-hidden`} style={{ height: selectedKeywords.length > 0 ? '440px' : '500px', minHeight: selectedKeywords.length > 0 ? '440px' : '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={safeData}
              dataKey="value"
              stroke="#fff"
              fill="#8884d8"
              content={<CustomizedContent onKeywordToggle={onKeywordToggle} selectedKeywords={selectedKeywords} />}
              animationDuration={300}
              onClick={(node) => {
                console.log('[TrendChart] Treemap onClick:', node);
                if (node && node.name && onKeywordToggle) {
                  onKeywordToggle(node.name);
                }
              }}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
          {safeData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-orange-500 text-xs">No valid keyword data to display</p>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[500px] flex flex-col items-center justify-center border border-dashed border-gray-700 rounded-xl bg-black/10">
          <p className="text-gray-400 text-xs uppercase tracking-widest animate-pulse mb-2">Waiting for AI Analysis...</p>
          {(!data || data.length === 0) && (
            <div className="text-center mt-4">
              <p className="text-gray-500 text-[10px] mb-1">Click "RUN DEEP ANALYSIS" button above</p>
              <p className="text-gray-600 text-[9px]">to generate keyword trend map</p>
            </div>
          )}
          {data && data.length > 0 && (
            <div className="text-center mt-4">
              <p className="text-orange-500 text-[10px] mb-1">Data received but invalid format</p>
              <p className="text-gray-600 text-[9px]">Check browser console for details</p>
              <p className="text-gray-500 text-[9px] mt-2">Expected format: [{"{name: 'keyword', value: 10-100}"}]</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrendChart;

