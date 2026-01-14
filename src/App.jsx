import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrendData } from './useTrendData';
import TrendChart from './components/TrendChart';
import VideoList from './components/VideoList';
import Login from './components/Login';
import { Layers, Globe, Zap, BarChart3, Filter, Calendar, Play, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { hashString } from './utils/auth';
import authConfig from './authConfig.json';

const App = () => {
  const version = "v3.4.0";
  // [v3.4.6] 로그인 세션을 localStorage에 저장하여 새로고침 후에도 유지
  // [v3.4.7] 세션 만료 시간 30분 추가
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // 페이지 로드 시 localStorage에서 로그인 상태 확인
    const sessionData = localStorage.getItem('yt-trend-scope-session');
    if (!sessionData) return false;
    
    try {
      const { timestamp } = JSON.parse(sessionData);
      const now = Date.now();
      const sessionAge = now - timestamp;
      const thirtyMinutes = 30 * 60 * 1000; // 30분을 밀리초로 변환
      
      if (sessionAge > thirtyMinutes) {
        // 세션 만료
        localStorage.removeItem('yt-trend-scope-session');
        console.log('[v3.4.7] Session expired after 30 minutes');
        return false;
      }
      
      return true;
    } catch (e) {
      // 기존 형식 호환성 (문자열 'authenticated'만 있는 경우)
      if (sessionData === 'authenticated') {
        // 기존 세션을 새 형식으로 변환
        localStorage.setItem('yt-trend-scope-session', JSON.stringify({ timestamp: Date.now() }));
        return true;
      }
      return false;
    }
  });
  
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // [v3.5.7] 한 달 전으로 변경

  // [v3.5.0] 여러 국가 복수 선택 가능
  // [v3.5.2] 기본값을 US만으로 설정
  const [selectedCountries, setSelectedCountries] = useState(['US']);
  // [v3.8.0] 기본값을 long-form으로 설정, 'all' 필터 제거
  const [filterType, setFilterType] = useState('long');
  const [activeCategory, setActiveCategory] = useState(null);
  const [dateRange, setDateRange] = useState({ start: lastMonth, end: today }); // [v3.5.7] 한 달 전으로 변경
  const [rankRange, setRankRange] = useState('all'); // [v3.5.8] 기본값을 all로 변경: top50, 50-100, 100-150, 150-200, all (YouTube API는 최대 200개만 반환)
  
  // [v3.7.0] 기본 비율을 6.5:3.5로 변경 (화면의 65%)
  const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.65);
  const isResizing = useRef(false);
  const [copiedId, setCopiedId] = useState(null);

  // [v3.4.2] 로그인 후에만 API 호출
  // [v3.5.0] 선택된 모든 국가의 데이터 수집
  // [v3.8.0] contentType 파라미터 추가 (long 또는 shorts)
  const { data, analysis, aiStrategy, isLoading, isAiLoading, runAiAnalysis, countries, apiStatus } = useTrendData(
    isLoggedIn ? selectedCountries : [], 
    isLoggedIn,
    filterType // contentType 전달
  );

  const handleCopy = (story, index) => {
    const text = `[Angle ${index + 1}: ${story.angle}]\nTitle: ${story.title}\nConcept: ${story.concept}\nKey Points:\n${story.key_points.map(p => `- ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredVideos = useMemo(() => {
    // 1단계: 조회수 기준으로 전체 데이터 정렬
    const sortedData = [...data].sort((a, b) => b.viewCount - a.viewCount);
    console.log(`[v3.5.5] Total data: ${data.length}, After sort: ${sortedData.length}`);
    
    // 2단계: 구간 필터 적용 (필터링 전에 구간 선택)
    // [v3.4.4] YouTube API는 최대 200개만 반환하므로 구간을 200개 기준으로 조정
    let rangeFiltered = sortedData;
    switch(rankRange) {
      case 'top50':
        rangeFiltered = sortedData.slice(0, 50);
        break;
      case '50-100':
        rangeFiltered = sortedData.slice(50, 100);
        break;
      case '100-150':
        rangeFiltered = sortedData.slice(100, 150);
        break;
      case '150-200':
        rangeFiltered = sortedData.slice(150, 200);
        break;
      case 'all':
        rangeFiltered = sortedData;
        break;
      default:
        rangeFiltered = sortedData;
    }
    console.log(`[v3.5.5] After rank range filter (${rankRange}): ${rangeFiltered.length}`);
    
    // 3단계: 선택된 구간 내에서 날짜 필터 적용 (타입 필터 제거 - 이미 데이터가 해당 타입만 포함)
    const beforeFilter = rangeFiltered.length;
    const filtered = rangeFiltered.filter(v => {
      const videoDate = v.publishedAt.split('T')[0];
      const dateMatch = videoDate >= dateRange.start && videoDate <= dateRange.end;
      
      return dateMatch;
    });
    
    // [v3.5.5] 필터링 통계 로그
    const dateFiltered = rangeFiltered.filter(v => {
      const videoDate = v.publishedAt.split('T')[0];
      return videoDate >= dateRange.start && videoDate <= dateRange.end;
    });
    console.log(`[v3.8.0] ===== Filtering Summary =====`);
    console.log(`[v3.8.0] Content type: ${filterType}`);
    console.log(`[v3.8.0] After rank filter: ${beforeFilter}`);
    console.log(`[v3.8.0] After date filter (${dateRange.start} ~ ${dateRange.end}): ${dateFiltered.length}`);
    console.log(`[v3.8.0] Final filtered videos: ${filtered.length}`);
    console.log(`[v3.8.0] =============================`);
    
    return filtered;
  }, [data, filterType, dateRange, rankRange]); // [v3.5.6] activeCategory 의존성 제거

  // [v3.5.0] 국가 토글 선택 (복수 선택 가능)
  // [v3.5.1] 최소 1개 제한 제거 - 모든 국가를 선택/해제 가능
  const toggleCountry = (code) => {
    setSelectedCountries(prev => {
      if (prev.includes(code)) {
        // 이미 선택된 경우 제거
        return prev.filter(c => c !== code);
      } else {
        // 선택되지 않은 경우 추가
        return [...prev, code];
      }
    });
  };

  // [v3.5.1] 전체 선택/해제 기능
  const toggleAllCountries = () => {
    const allCountryCodes = Object.keys(countries);
    const allSelected = allCountryCodes.every(code => selectedCountries.includes(code));
    
    if (allSelected) {
      // 모두 선택된 경우 모두 해제 (하지만 최소 1개는 유지)
      setSelectedCountries([allCountryCodes[0]]);
    } else {
      // 일부만 선택된 경우 모두 선택
      setSelectedCountries(allCountryCodes);
    }
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

  // [v3.4.7] 세션 만료 체크 (1분마다 확인)
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkSessionExpiry = () => {
      const sessionData = localStorage.getItem('yt-trend-scope-session');
      if (!sessionData) {
        setIsLoggedIn(false);
        return;
      }

      try {
        const { timestamp } = JSON.parse(sessionData);
        const now = Date.now();
        const sessionAge = now - timestamp;
        const thirtyMinutes = 30 * 60 * 1000; // 30분

        if (sessionAge > thirtyMinutes) {
          localStorage.removeItem('yt-trend-scope-session');
          setIsLoggedIn(false);
          console.log('[v3.4.7] Session expired after 30 minutes');
        }
      } catch (e) {
        // 세션 데이터 형식 오류
        localStorage.removeItem('yt-trend-scope-session');
        setIsLoggedIn(false);
      }
    };

    // 즉시 한 번 체크
    checkSessionExpiry();

    // 1분마다 체크
    const interval = setInterval(checkSessionExpiry, 60 * 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // [v3.4.6] 로그인 핸들러: localStorage에 세션 저장
  // [v3.4.7] 세션에 타임스탬프 추가 (30분 만료)
  const handleLogin = () => {
    const sessionData = {
      timestamp: Date.now(),
      authenticated: true
    };
    localStorage.setItem('yt-trend-scope-session', JSON.stringify(sessionData));
    setIsLoggedIn(true);
    console.log('[v3.4.7] Session created, will expire in 30 minutes');
  };

  if (!isLoggedIn) {
    return (
      <Login 
        onLogin={handleLogin} 
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
            {/* [v3.5.1] 전체 선택/해제 버튼 */}
            <button
              onClick={toggleAllCountries}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black transition-all ${
                Object.keys(countries).every(code => selectedCountries.includes(code))
                  ? 'bg-secondary text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="전체 선택/해제"
            >
              {Object.keys(countries).every(code => selectedCountries.includes(code)) ? 'ALL' : 'SELECT ALL'}
            </button>
            {Object.entries(countries).map(([code, { flag }]) => (
              <button 
                key={code} 
                onClick={() => toggleCountry(code)} 
                className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${
                  selectedCountries.includes(code) 
                    ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,255,0.5)]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title={selectedCountries.includes(code) ? '선택됨 (클릭하여 해제)' : '클릭하여 선택'}
              >
                {flag} {code}
              </button>
            ))}
          </div>
          {apiStatus === "blocked" && (
            <div className="flex flex-col items-end">
              <div className="bg-orange-500/10 border border-orange-500/50 text-orange-500 text-[9px] font-black px-3 py-1.5 rounded-full animate-pulse">
                SIMULATION MODE ACTIVE
              </div>
              <p className="text-[7px] text-orange-500/70 mt-1 uppercase font-bold">Check YouTube API Key in Secrets</p>
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-lg border border-gray-800">
                    <span className="text-[9px] text-gray-500 font-black uppercase">Rank Range:</span>
                    <select 
                      value={rankRange} 
                      onChange={(e) => setRankRange(e.target.value)}
                      className="bg-transparent text-[10px] font-black text-white outline-none cursor-pointer"
                    >
                      <option value="top50">Top 50</option>
                      <option value="50-100">50-100</option>
                      <option value="100-150">100-150</option>
                      <option value="150-200">150-200</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => runAiAnalysis(filteredVideos, {
                      selectedCountries,
                      rankRange,
                      dateRange,
                      totalVideos: data.length
                    })} 
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
              </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/40 p-4 rounded-2xl border border-gray-800/50 text-center shadow-lg"><p className="text-[9px] text-gray-500 uppercase font-black mb-1">Cumulative Views</p><p className="text-xl font-black text-white">{(analysis.totalViews / 1000000).toFixed(1)}M</p></div>
                  <div className="bg-black/40 p-4 rounded-2xl border border-gray-800/50 text-center shadow-lg"><p className="text-[9px] text-gray-500 uppercase font-black mb-1">Top Trending</p><p className="text-xl font-black text-primary truncate px-2">{analysis.keywords && analysis.keywords.length > 0 ? analysis.keywords[0]?.name : '---'}</p></div>
                </div>

                {aiStrategy && (
                  <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                      <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                        Monthly Trend Insight & 6 Diverse Storytelling Angles
                      </h3>
                    </div>
                    
                    <p className="text-xs text-gray-200 mb-6 leading-relaxed font-medium italic bg-white/5 p-4 rounded-xl border border-white/5">
                      "{aiStrategy.strategy}"
                    </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
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
              {['long', 'shorts'].map(t => (
                <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${filterType === t ? 'bg-gray-700 text-white shadow-md ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t === 'long' ? 'LONG-FORM' : 'SHORTS'}
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
