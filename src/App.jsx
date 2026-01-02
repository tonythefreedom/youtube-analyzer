import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrendData } from './useTrendData';
import TrendChart from './components/TrendChart';
import VideoList from './components/VideoList';
import Login from './components/Login';
import { Layers, Globe, Zap, BarChart3, Filter, Calendar, Play, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { hashString } from './utils/auth';
import authConfig from './authConfig.json';

const App = () => {
  const version = "v3.3.1";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [selectedCountries, setSelectedCountries] = useState(['KR', 'US']);
  const [filterType, setFilterType] = useState('all');
  const [activeCategory, setActiveCategory] = useState(null);
  const [dateRange, setDateRange] = useState({ start: lastWeek, end: today });
  
  // [v3.2.0] 기본 비율을 7:3으로 변경 (화면의 70%)
  const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.7);
  const isResizing = useRef(false);
  const [copiedId, setCopiedId] = useState(null);

  const { data, analysis, aiStrategy, isLoading, isAiLoading, runAiAnalysis, countries, apiStatus } = useTrendData(selectedCountries);

  const handleCopy = (story, index) => {
    const text = `[Angle ${index + 1}: ${story.angle}]\nTitle: ${story.title}\nConcept: ${story.concept}\nKey Points:\n${story.key_points.map(p => `- ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredVideos = useMemo(() => {
    return data.filter(v => {
      const typeMatch = filterType === 'all' || (filterType === 'shorts' && v.isShorts) || (filterType === 'long' && !v.isShorts);
      
      // [v3.2.2] 검색 범위를 제목, 채널명, 설명으로 확장하여 매칭률 향상
      const keyword = activeCategory ? activeCategory.toLowerCase() : null;
      const categoryMatch = !keyword || 
        v.title.toLowerCase().includes(keyword) || 
        v.channelTitle.toLowerCase().includes(keyword) ||
        (v.description && v.description.toLowerCase().includes(keyword));
      
      const videoDate = v.publishedAt.split('T')[0];
      return typeMatch && categoryMatch && videoDate >= dateRange.start && videoDate <= dateRange.end;
    });
  }, [data, filterType, activeCategory, dateRange]);

  const toggleCountry = (code) => {
    setSelectedCountries(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  // [v3.0.0] 드래그 리사이징 핸들러
  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const onResize = useCallback((e) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX - 16; // 마진 고려
    if (newWidth > 400 && newWidth < window.innerWidth - 300) {
      setLeftWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [onResize, stopResizing]);

  if (!isLoggedIn) {
    return (
      <Login 
        onLogin={() => setIsLoggedIn(true)} 
        expectedIdHash={authConfig.idHash}
        expectedPwHash={authConfig.pwHash}
      />
    );
  }

  return (
    <div key={version} className="h-screen bg-background text-gray-100 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 z-30 bg-background/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="text-primary fill-primary/20" size={24} />
            <h1 className="text-xl font-black tracking-tighter text-white uppercase">
              YT-TREND<span className="text-primary font-bold">SCOPE</span>
              <span className="ml-2 text-[9px] bg-primary text-black px-1.5 py-0.5 rounded font-bold">{version}</span>
            </h1>
          </div>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Advanced Dynamic Analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface px-4 py-1.5 rounded-full border border-gray-800 shadow-inner">
            <Calendar size={14} className="text-primary" />
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-[11px] font-bold outline-none text-gray-300 w-28 cursor-pointer" />
            <span className="text-gray-600">~</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-[11px] font-bold outline-none text-gray-300 w-28 cursor-pointer" />
          </div>

          <div className="flex items-center gap-2 bg-surface p-1 rounded-full border border-gray-800">
            {Object.entries(countries).map(([code, { flag }]) => (
              <button key={code} onClick={() => toggleCountry(code)} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${selectedCountries.includes(code) ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,255,0.5)]' : 'text-gray-500 hover:text-gray-300'}`}>{flag} {code}</button>
            ))}
          </div>
          {apiStatus === "blocked" && (
            <div className="bg-orange-500/10 border border-orange-500/50 text-orange-500 text-[9px] font-black px-3 py-1.5 rounded-full animate-pulse">
              SIMULATION MODE ACTIVE
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-row overflow-hidden p-4 gap-0 relative">
        {/* [v3.1.0] 좌측 패널: 스크롤 영역 및 태그 구조 완전 정상화 */}
        <div 
          style={{ width: `${leftWidth}px` }}
          className="flex-shrink-0 flex flex-col h-full min-h-0"
        >
          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar min-h-0">
            <div className="bg-surface/50 rounded-2xl p-6 border border-gray-800 relative overflow-visible ring-1 ring-white/5 shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={80} /></div>
              <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Layers size={16} className="text-primary" />AI Analysis Hub</h2>
                <button 
                  onClick={() => runAiAnalysis(filteredVideos)} 
                  disabled={isAiLoading || filteredVideos.length === 0} 
                  className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black transition-all overflow-hidden ${isAiLoading ? 'bg-gray-800 text-primary cursor-wait' : 'bg-primary text-black shadow-[0_0_25px_rgba(0,242,255,0.4)] hover:scale-105 active:scale-95'}`}
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span className="tracking-widest animate-pulse">ANALYZING...</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    </>
                  ) : (
                    <>
                      <Zap size={14} fill="currentColor" /> RUN DEEP ANALYSIS
                    </>
                  )}
                </button>
              </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/40 p-4 rounded-2xl border border-gray-800/50 text-center shadow-lg"><p className="text-[9px] text-gray-500 uppercase font-black mb-1">Cumulative Views</p><p className="text-xl font-black text-white">{(analysis.totalViews / 1000000).toFixed(1)}M</p></div>
                  <div className="bg-black/40 p-4 rounded-2xl border border-gray-800/50 text-center shadow-lg"><p className="text-[9px] text-gray-500 uppercase font-black mb-1">Top Trending</p><p className="text-xl font-black text-primary truncate px-2">{analysis.keywords[0]?.name || '---'}</p></div>
                </div>

                {aiStrategy && (
                  <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                      <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                        Weekly Trend Insight & 3 Storytelling Angles
                      </h3>
                    </div>
                    
                    <p className="text-xs text-gray-200 mb-6 leading-relaxed font-medium italic bg-white/5 p-4 rounded-xl border border-white/5">
                      "{aiStrategy.strategy}"
                    </p>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
                      {aiStrategy.stories?.map((story, sIdx) => (
                        <div key={sIdx} className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full hover:border-primary/30 transition-all group shadow-xl relative">
                          <button 
                            onClick={() => handleCopy(story, sIdx)}
                            className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-primary transition-colors z-20"
                            title="전략 복사"
                          >
                            {copiedId === sIdx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>

                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[8px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter">
                              Angle {sIdx + 1}: {story.angle}
                            </span>
                          </div>
                          <h4 className="text-[11px] font-black text-white mb-2 leading-tight uppercase group-hover:text-primary transition-colors">
                            {story.title}
                          </h4>
                          <p className="text-[10px] text-gray-400 leading-relaxed mb-4 flex-grow italic">
                            {story.concept}
                          </p>
                          <div className="space-y-1.5 mt-auto pt-4 border-t border-white/5">
                            {story.key_points?.map((point, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-2">
                                <span className="text-primary text-[10px] mt-0.5">•</span>
                                <span className="text-[9px] text-gray-300 font-medium leading-tight">
                                  {point}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Zap size={12} className="text-primary fill-primary" />
                      <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Strategic Benchmarks for Implementation
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {aiStrategy.similarVideos.map(video => (
                        <div key={`ref-${video.uniqueId}`} onClick={() => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')} className="flex flex-col gap-2 p-2 bg-black/30 hover:bg-white/5 rounded-xl border border-gray-800 cursor-pointer transition-all group hover:border-primary/30 shadow-lg">
                          <div className="relative aspect-video rounded-lg overflow-hidden">
                            <img src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play size={16} className="text-white fill-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[9px] font-bold text-gray-300 line-clamp-2 group-hover:text-primary transition-colors leading-tight mb-1 uppercase">
                              {video.title}
                            </h4>
                            <div className="flex items-center justify-between">
                              <p className="text-[8px] text-gray-500 font-bold">{(video.viewCount/10000).toFixed(0)}만</p>
                              <ExternalLink size={8} className="text-gray-600" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 트리맵 차트 영역 */}
                <div className="mt-4 bg-black/20 rounded-2xl border border-gray-800/50 p-4">
                  <TrendChart data={analysis.keywords} onCategoryClick={setActiveCategory} />
                </div>
              </div>
            </div>
            <div className="h-24" /> {/* 스크롤 하단 여백: 스크롤러 내부에 위치 */}
          </div>
        </div>

        {/* [v3.0.0] 드래그 리사이저 핸들 */}
        <div 
          onMouseDown={startResizing}
          className="w-1.5 hover:w-2 bg-transparent hover:bg-primary/30 cursor-col-resize transition-all flex items-center justify-center group relative z-20"
        >
          <div className="absolute h-10 w-1 bg-gray-800 group-hover:bg-primary rounded-full opacity-50"></div>
        </div>

        {/* [v3.0.0] 우측 리스트: 남은 영역 전체 활용 */}
        <div className="flex-grow flex flex-col gap-4 overflow-hidden h-full min-w-0 min-h-0 relative pl-4">
          <div className="flex items-center justify-between px-2 flex-shrink-0">
            <div className="flex gap-2 bg-surface p-1 rounded-xl border border-gray-800 shadow-lg">
              {['all', 'long', 'shorts'].map(t => (
                <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${filterType === t ? 'bg-gray-700 text-white shadow-md ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t === 'all' ? 'TOTAL' : t === 'long' ? 'LONG-FORM' : 'SHORTS'}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 font-black tracking-widest flex items-center gap-4">
              {activeCategory && (
                <button 
                  onClick={() => setActiveCategory(null)}
                  className="bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full flex items-center gap-2 hover:bg-primary/20 transition-all animate-pulse"
                >
                  <span className="text-[9px]">KEYWORD: {activeCategory}</span>
                  <span className="text-xs">×</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-primary" /> 
                {filteredVideos.length} NODES IDENTIFIED
              </div>
            </div>
          </div>
          <VideoList videos={filteredVideos} />
        </div>
      </main>
    </div>
  );
};

export default App;
