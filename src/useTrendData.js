import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// [v2.7.4] Gemini 3 Flash Preview 모델 적용
const YOUTUBE_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY || "").trim().replace(/[\s'"]/g, "");
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[\s'"]/g, "");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// 사용자 요청 모델 적용
const aiModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const COUNTRIES = {
  KR: { name: 'South Korea', flag: '🇰🇷' },
  US: { name: 'United States', flag: '🇺🇸' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
};

// [v3.4.9] 영어권 국가 목록
const ENGLISH_SPEAKING_COUNTRIES = ['US', 'GB', 'AU', 'CA', 'SG'];

// [v3.5.9] VERIFIED_2026_ASSETS 제거 - 동적으로 가져온 데이터만 사용

export const useTrendData = (selectedCountries, enabled = true, contentType = 'long') => {
  const [data, setData] = useState([]);
  const dataRef = useRef(data); // [v3.5.4] 최신 data 참조를 위한 ref
  const [isLoading, setIsLoading] = useState(false);
  const [aiKeywords, setAiKeywords] = useState([]);
  const [aiStrategy, setAiStrategy] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("idle");
  const [searchMode, setSearchMode] = useState('trending'); // [v4.2.0] 'trending' or 'keyword'
  const [currentKeyword, setCurrentKeyword] = useState(''); // [v4.2.0] 현재 검색 키워드
  const quotaExceededRef = useRef(false); // 할당량 초과 플래그
  const hasLoadedRef = useRef(false); // 로그인 후 한 번만 로드하기 위한 플래그
  const loadedCountriesRef = useRef(new Set()); // [v3.5.4] 이미 로드된 국가 추적
  const previousContentTypeRef = useRef(contentType); // [v3.8.0] 이전 contentType 추적
  
  // [v3.5.4] data가 변경될 때마다 ref 업데이트
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchTrends = useCallback(async (contentTypeParam, forceReload = false) => {
    // [v3.8.0] contentType 파라미터가 없으면 기본값 사용
    const currentContentType = contentTypeParam || contentType;
    // [v3.5.4] data를 의존성에 추가하여 기존 데이터에 접근 가능하도록 함
    // [v3.5.9] 할당량 초과 시 재시도 방지 및 실제 데이터만 사용
    if (quotaExceededRef.current) {
      // console.warn("[v3.5.9] Quota exceeded. No data will be loaded.");
      setApiStatus("blocked");
      setData([]);
      alert("YouTube API 할당량이 초과되었습니다. API 키의 할당량을 확인해 주세요.");
      setIsLoading(false);
      return;
    }
    
    // [v3.5.9] API 키가 없으면 데이터를 로드하지 않음
    if (!YOUTUBE_API_KEY) {
      // console.warn("[v3.5.9] YouTube API Key missing. No data will be loaded.");
      setApiStatus("blocked");
      setData([]);
      alert("YouTube API 키가 설정되지 않았습니다. GitHub Secrets를 확인해 주세요.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setApiStatus("loading");

    try {
      // [v3.8.1] contentType 변경 시 강제 리로드: 기존 데이터를 모두 제거하고 다시 가져오기
      if (forceReload) {
        // console.log(`[v3.8.1] Force reload: clearing all existing data and reloading for ${currentContentType}`);
        setData([]); // 상태도 초기화
        dataRef.current = [];
        loadedCountriesRef.current.clear();
      }
      
      // [v3.5.4] 기존 데이터를 Map으로 변환하여 유지 (ref를 통해 최신 데이터 접근)
      // [v3.8.1] forceReload 시 기존 데이터가 없으므로 빈 Map
      const existingDataMap = new Map();
      if (!forceReload) {
        dataRef.current.forEach(video => {
          existingDataMap.set(video.id, video);
        });
      }
      
      // [v3.5.4] 아직 로드되지 않은 국가만 필터링
      // [v3.8.1] forceReload 시 모든 선택된 국가를 다시 가져오기
      const countriesToFetch = forceReload 
        ? selectedCountries 
        : selectedCountries.filter(country => !loadedCountriesRef.current.has(country));
      
      // [v3.7.1] 해제된 국가 확인 (loadedCountriesRef에는 있지만 selectedCountries에는 없는 국가)
      const deselectedCountries = Array.from(loadedCountriesRef.current).filter(
        country => !selectedCountries.includes(country)
      );
      
      // [v3.7.1] 해제된 국가가 있으면 loadedCountriesRef에서 제거
      if (deselectedCountries.length > 0) {
        // console.log(`[v3.7.1] Countries deselected: ${deselectedCountries.join(', ')}`);
        deselectedCountries.forEach(country => {
          loadedCountriesRef.current.delete(country);
        });
      }
      
      // [v3.7.1] 새 국가가 없고 해제된 국가도 없으면 리턴
      if (countriesToFetch.length === 0 && deselectedCountries.length === 0) {
        // console.log(`[v3.5.4] All selected countries already loaded. No new API calls needed.`);
        setIsLoading(false);
        return;
      }
      
      // [v3.7.1] 해제된 국가만 있고 새 국가가 없으면 데이터 제거만 수행
      let results = [];
      if (countriesToFetch.length === 0 && deselectedCountries.length > 0) {
        // console.log(`[v3.7.1] No new countries to fetch, but removing data for deselected countries`);
        // API 호출 없이 빈 결과로 처리
        results = [];
      } else if (countriesToFetch.length > 0) {
        // console.log(`[v3.5.4] Starting data collection for ${countriesToFetch.length} new countries: ${countriesToFetch.join(', ')}`);
        // console.log(`[v3.5.4] Already loaded countries: ${Array.from(loadedCountriesRef.current).join(', ') || 'none'}`);
        
        results = await Promise.allSettled(
          countriesToFetch.map(async (country) => {
            // [v4.0.0] 혼합 접근: Long-form은 mostPopular, Shorts는 search API 사용

            if (currentContentType === 'long') {
              // Long-form: 기존 mostPopular 방식 유지
              const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${country}&maxResults=200&key=${YOUTUBE_API_KEY}`;
              const response = await fetch(url);
              const resData = await response.json();

              if (resData.error) {
                const errorMessage = resData.error.message || '';
                if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || response.status === 403) {
                  quotaExceededRef.current = true;
                  throw new Error('QUOTA_EXCEEDED');
                }
                throw new Error(resData.error.message);
              }

              const allItems = resData.items || [];
              // Duration > 60초만 유지
              const filteredItems = allItems.filter(item => {
                const duration = item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0;
                return duration > 60;
              });

              // console.log(`[v4.0.0] ${country} (long-form): mostPopular API returned ${allItems.length} items, after filter: ${filteredItems.length}`);

              return { country, items: filteredItems };

            } else {
              // Shorts: mostPopular에서 가져온 후 duration 기반 필터링 (개선된 방식)
              // search API는 트렌딩 Shorts를 제대로 반환하지 못하는 경우가 많음

              const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${country}&maxResults=200&key=${YOUTUBE_API_KEY}`;

              // console.log(`[v4.1.0] ${country} (shorts): Calling mostPopular API`);

              const response = await fetch(url);
              const resData = await response.json();

              if (resData.error) {
                const errorMessage = resData.error.message || '';
                console.error(`[ERROR] ${country} (shorts): mostPopular API error:`, resData.error);
                if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || response.status === 403) {
                  quotaExceededRef.current = true;
                  throw new Error('QUOTA_EXCEEDED');
                }
                throw new Error(resData.error.message);
              }

              const allItems = resData.items || [];

              // Duration ≤ 60초만 유지 (Shorts 필터링)
              // let debugCount = 0;
              const filteredItems = allItems.filter(item => {
                const duration = item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0;
                const isShorts = duration > 0 && duration <= 60;

                // 디버깅: 처음 10개 항목의 duration 로깅 (모든 항목)
                // if (debugCount < 10) {
                //   console.log(`[v4.1.1] ${country} video sample #${debugCount + 1}:`, {
                //     title: item.snippet.title.substring(0, 50),
                //     duration: duration,
                //     isShorts: isShorts,
                //     rawDuration: item.contentDetails?.duration
                //   });
                //   debugCount++;
                // }

                return isShorts;
              });

              // console.log(`[v4.1.1] ${country} (shorts): mostPopular returned ${allItems.length} items, after shorts filter (≤60s): ${filteredItems.length}`);

              return { country, items: filteredItems };
            }
          })
        );
      }
      
      // [v3.5.3] 실패한 국가 확인
      const failedCountries = results
        .map((result, index) => result.status === 'rejected' ? selectedCountries[index] : null)
        .filter(Boolean);
      
      if (failedCountries.length > 0) {
        console.error(`[v3.5.3] Failed to fetch data for countries: ${failedCountries.join(', ')}`);
      }
      
      // 성공한 결과만 필터링
      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      // [v3.8.0] 기존 데이터를 먼저 Map에 추가 (contentType에 맞는 것만 유지)
      const allItemsMap = new Map();
      existingDataMap.forEach((video, id) => {
        // contentType에 맞는 데이터만 유지
        if (currentContentType === 'long' && !video.isShorts) {
          allItemsMap.set(id, video);
        } else if (currentContentType === 'shorts' && video.isShorts) {
          allItemsMap.set(id, video);
        }
      });
      
      let totalBeforeDedup = 0;
      let duplicateCount = 0;
      let newItemsCount = 0;
      const countryStats = {};
      
      successfulResults.forEach(({ country, items }) => {
        countryStats[country] = items.length;
        totalBeforeDedup += items.length;
        loadedCountriesRef.current.add(country); // 로드된 국가로 표시
        
        items.forEach(item => {
          if (!allItemsMap.has(item.id)) {
            newItemsCount++;

            // [v3.9.0] Shorts 판정: Duration 기반
            const duration = item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0;
            const isShorts = duration > 0 && duration <= 60;

            allItemsMap.set(item.id, {
              uniqueId: `yt-${item.id}-${country}`,
              id: item.id,
              title: item.snippet.title,
              description: item.snippet.description || "",
              channelTitle: item.snippet.channelTitle,
              publishedAt: item.snippet.publishedAt,
              thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
              viewCount: parseInt(item.statistics.viewCount || "0"),
              country: country,
              isShorts: isShorts
            });
          } else {
            duplicateCount++;
            // 중복 발견 시 로그 (너무 많으면 로그 제한)
            if (duplicateCount <= 10) {
              // console.log(`[v3.5.4] Duplicate video ID found: ${item.id} (already exists)`);
            }
          }
        });
      });
      
      // [v3.5.4] 선택 해제된 국가의 데이터 제거
      const currentCountrySet = new Set(selectedCountries);
      Array.from(allItemsMap.values()).forEach(video => {
        if (!currentCountrySet.has(video.country)) {
          allItemsMap.delete(video.id);
        }
      });
      
      // [v3.8.0] contentType 변경 시 다른 타입 데이터 제거 (이미 위에서 처리됨)

      const finalData = Array.from(allItemsMap.values()).sort((a, b) => b.viewCount - a.viewCount);
      
      // [v3.5.4] 상세 통계 로그
      // console.log(`[v3.5.4] ===== Data Collection Summary =====`);
      // console.log(`[v3.5.4] Selected countries: ${selectedCountries.length} (${selectedCountries.join(', ')})`);
      if (deselectedCountries.length > 0) {
        // console.log(`[v3.7.1] Deselected countries: ${deselectedCountries.length} (${deselectedCountries.join(', ')})`);
      }
      // console.log(`[v3.5.4] New countries fetched: ${countriesToFetch.length} (${countriesToFetch.join(', ') || 'none'})`);
      // console.log(`[v3.5.4] Successful countries: ${successfulResults.length}`);
      if (failedCountries.length > 0) {
        // console.log(`[v3.5.4] Failed countries: ${failedCountries.length} (${failedCountries.join(', ')})`);
      }
      // console.log(`[v3.5.4] Country breakdown:`, countryStats);
      // console.log(`[v3.5.4] Existing videos: ${existingDataMap.size}`);
      // console.log(`[v3.5.4] New videos added: ${newItemsCount}`);
      // console.log(`[v3.5.4] Total before deduplication: ${totalBeforeDedup}`);
      // console.log(`[v3.5.4] Duplicates removed: ${duplicateCount}`);
      const removedCount = existingDataMap.size - finalData.length;
      if (removedCount > 0) {
        // console.log(`[v3.7.1] Videos removed (deselected countries): ${removedCount}`);
      }
      // console.log(`[v3.5.4] Final unique videos: ${finalData.length}`);
      // console.log(`[v3.5.4] ====================================`);
      
      if (finalData.length < 50) {
        // console.warn(`[v3.5.3] WARNING: Only ${finalData.length} videos collected. This may be insufficient for rank range filtering.`);
        // console.warn(`[v3.5.3] Possible reasons: API limitations, high duplicate rate, or failed API calls.`);
      }
      setData(finalData);
      setApiStatus("success");
      quotaExceededRef.current = false; // 성공 시 플래그 리셋
    } catch (error) {
      const isQuotaExceeded = error.message === 'QUOTA_EXCEEDED' || 
                                 error.message?.includes('quota') || 
                                 error.message?.includes('exceeded');
      
      if (isQuotaExceeded) {
        quotaExceededRef.current = true;
        // console.warn("[v3.5.9] YouTube API Quota Exceeded. No simulation data will be used.");
        handleApiFailure("YouTube API 할당량이 초과되었습니다.");
      } else {
        // console.warn("[v3.5.9] API Error Detected. No simulation data will be used.", error.message);
        handleApiFailure(error.message || "알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCountries]);

  // [v3.5.9] 시뮬레이션 모드 제거 - 실제 데이터만 사용
  const handleApiFailure = (errorMessage) => {
    console.error("[v3.5.9] API Error:", errorMessage);
    setApiStatus("blocked");
    setData([]); // 빈 데이터로 설정
    alert("YouTube API 호출에 실패했습니다. API 키와 할당량을 확인해 주세요.\n\n에러: " + errorMessage);
  };

  useEffect(() => {
    // [v3.4.3] 로그인 후 화면 로드 시 또는 국가 변경 시 API 호출
    // [v3.5.4] 국가 선택 시 새 국가만 추가로 가져오기
    // [v3.8.0] contentType 변경 시 로드된 국가 초기화
    if (enabled) {
      if (!hasLoadedRef.current) {
        // 첫 로그인 시 플래그 설정 및 로드된 국가 초기화
        hasLoadedRef.current = true;
        loadedCountriesRef.current.clear();
      }
      
      // [v3.8.0] contentType이 변경되면 로드된 국가 초기화 및 강제 리로드 (다른 타입 데이터를 가져와야 함)
      const contentTypeChanged = previousContentTypeRef.current !== contentType;
      if (contentTypeChanged) {
        // console.log(`[v3.8.1] Content type changed from ${previousContentTypeRef.current} to ${contentType}, forcing reload`);
        loadedCountriesRef.current.clear();
        previousContentTypeRef.current = contentType;
        fetchTrends(contentType, true); // 강제 리로드
      } else {
        fetchTrends(contentType);
      }
    } else {
      // 로그아웃 시 플래그 및 로드된 국가 리셋
      hasLoadedRef.current = false;
      loadedCountriesRef.current.clear();
      previousContentTypeRef.current = contentType;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedCountries.join(','), contentType]); // enabled, selectedCountries, contentType 변경 시 실행

  const runAiAnalysis = async (filteredVideos, analysisContext = {}) => {
    if (filteredVideos.length === 0) {
      alert("분석할 동영상이 없습니다.");
      return;
    }

    if (!GEMINI_API_KEY) {
      alert("[SECURITY] Gemini API Key가 설정되지 않았습니다. GitHub Secrets를 확인해 주세요.");
      return;
    }

    setIsAiLoading(true);
    // console.log('[AI Analysis] Starting analysis...');
    // console.log('[AI Analysis] Videos to analyze:', filteredVideos.length);
    const analysisStartTime = Date.now();

    try {
      // [v3.5.9] 분석 컨텍스트 정보 수집
      const { selectedCountries = [], rankRange = 'all', dateRange = null, totalVideos = 0 } = analysisContext;
      
      // 선택된 구간의 비디오 메타데이터를 더 상세하게 전달 (국가, 조회수, 날짜 포함)
      const sampleData = filteredVideos.map((v, index) => ({
        index,
        title: v.title,
        channel: v.channelTitle || v.channel || 'Unknown',
        country: v.country,
        views: v.viewCount,
        publishedAt: v.publishedAt,
        description: (v.description || '').substring(0, 200) // 설명은 200자까지 확장 (없으면 빈 문자열)
      }));

      // 국가 정보 문자열 생성
      const countriesInfo = selectedCountries.length > 0 
        ? selectedCountries.map(code => COUNTRIES[code] ? `${COUNTRIES[code].flag} ${COUNTRIES[code].name}` : code).join(', ')
        : 'Unknown';

      // 날짜 범위 정보
      const dateInfo = dateRange 
        ? `from ${dateRange.start} to ${dateRange.end} (approximately ${Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24))} days)`
        : 'date range not specified';

      // Rank range 정보
      const rankInfo = rankRange === 'all' 
        ? 'all rankings (complete dataset)'
        : rankRange === 'top50' 
          ? 'top 50 rankings'
          : `rankings ${rankRange}`;

      const prompt = `You are a World-Class YouTube Trend Analyst and Slide-Based Educational Content Strategist specializing in creating comprehensive slide lecture videos that investigate YouTube trends and derive actionable insights.

      ANALYSIS CONTEXT:
      - Countries: ${countriesInfo}
      - Date Range: ${dateInfo}
      - Rank Range: ${rankInfo}
      - Total Videos Analyzed: ${filteredVideos.length} out of ${totalVideos} total collected videos

      TREND DATA (${filteredVideos.length} videos):
      ${JSON.stringify(sampleData, null, 2)}

      YOUR MISSION:
      Analyze the provided YouTube trending video data to identify key phenomena, patterns, and insights. Create 6 distinct storytelling strategies (angles) for slide-based educational videos that investigate these trends and present findings in a lecture-style format.

      INSTRUCTIONS:

      1. MONTHLY TREND INSIGHT (overall_strategy):
         - Start with "이번 달 트렌드 핵심:"
         - Investigate the trends: What phenomena are emerging? What patterns do you observe?
         - Derive insights: What do these trends tell us about audience preferences, content evolution, or market shifts?
         - Write 4-5 comprehensive sentences that synthesize your investigation and insights

      2. 6 DIVERSE STORYTELLING ANGLES (Each must be completely different in approach):
         - Angle 1: Documentary/Investigative (심층 취재형) - Deep investigation into trend phenomena
         - Angle 2: Review/Analysis/Critical (리뷰/분석형) - Critical analysis and evaluation of trends
         - Angle 3: Entertainment/Challenge (엔터테인먼트형) - Entertaining exploration of trends
         - Angle 4: Educational/Tutorial (교육/튜토리얼형) - Educational breakdown of trend mechanics
         - Angle 5: Personal Story/Vlog (개인 스토리형) - Personal narrative connecting to trends
         - Angle 6: Creative/Experimental (크리에이티브형) - Creative and experimental approach to trends

      3. FOR EACH ANGLE, provide EXACTLY 10 SLIDES structured as follows:
         - Slides 1-2: Introduction & Hook
           * Slide 1: Opening hook with compelling question or statement about the trend
           * Slide 2: Overview of what will be investigated in this video

         - Slides 3-5: Trend Phenomenon Investigation
           * Slide 3: First key trend phenomenon identified from data
           * Slide 4: Second key trend phenomenon identified from data
           * Slide 5: Third key trend phenomenon or pattern identified from data

         - Slides 6-8: Insight Derivation & Deep Analysis
           * Slide 6: First major insight with supporting evidence
           * Slide 7: Second major insight with supporting evidence
           * Slide 8: Third major insight or cross-pattern analysis

         - Slides 9-10: Conclusion & Action Items
           * Slide 9: Summary of key findings and implications
           * Slide 10: Call-to-action and engagement prompt

      4. FOR EACH SLIDE, provide:
         - slide: Slide number and title (e.g., "슬라이드 1: 인트로 - 트렌드의 충격적 사실")
         - content: Detailed description of what to show/say on this slide (2-3 sentences)
         - research: Specific research sources, data points, or materials to find for this slide

      5. FOR EACH ANGLE, also provide:
         - angle: Angle name in English
         - title: Video title in【】brackets
         - concept: ONE sentence summary in Korean explaining the angle's unique approach
         - key_points: EXACTLY 4 items:
           [0] "🎯 Hook (0-30초): [오프닝 멘트와 장면]"
           [1] "📈 Watch Time: [클리프행어 타이밍 - 구체적 시간과 멘트]"
           [2] "🔄 좋아요 요청: [좋아요 요청 스크립트]"
           [3] "💬 댓글 유도: [구체적 질문]"

      Return ONLY JSON:
      {
        "keywords": [{"name": "Keyword", "value": 10-100}],
        "overall_strategy": "이번 달 트렌드 핵심: (4-5문장, 현상 조사 및 인사이트 도출 포함)",
        "stories": [
          {
            "angle": "Documentary Deep Dive",
            "title": "【컨텐츠 제목】",
            "concept": "한 줄 전략 설명",
            "slide_scenario": [
              {"slide": "슬라이드 1: 인트로 - 트렌드의 충격적 사실", "content": "구체적인 내용 설명 (2-3문장)", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 2: 오버뷰", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 3: 첫 번째 트렌드 현상", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 4: 두 번째 트렌드 현상", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 5: 세 번째 트렌드 현상", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 6: 첫 번째 인사이트 및 근거", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 7: 두 번째 인사이트 및 근거", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 8: 세 번째 인사이트 및 교차 분석", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 9: 핵심 발견 요약 및 시사점", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"},
              {"slide": "슬라이드 10: 액션 아이템 및 참여 유도", "content": "구체적인 내용 설명", "research": "구체적 조사 소스"}
            ],
            "key_points": [
              "🎯 Hook (0-30초): [오프닝 멘트와 장면]",
              "📈 Watch Time: [클리프행어 타이밍]",
              "🔄 좋아요 요청: [좋아요 요청 스크립트]",
              "💬 댓글 유도: [구체적 질문]"
            ]
          },
          {
            "angle": "Critical Analysis",
            "title": "【...】",
            "concept": "...",
            "slide_scenario": [10 slides following the same structure],
            "key_points": ["🎯 ...", "📈 ...", "🔄 ...", "💬 ..."]
          },
          {
            "angle": "Entertainment Challenge",
            "title": "【...】",
            "concept": "...",
            "slide_scenario": [10 slides following the same structure],
            "key_points": ["🎯 ...", "📈 ...", "🔄 ...", "💬 ..."]
          },
          {
            "angle": "Educational Tutorial",
            "title": "【...】",
            "concept": "...",
            "slide_scenario": [10 slides following the same structure],
            "key_points": ["🎯 ...", "📈 ...", "🔄 ...", "💬 ..."]
          },
          {
            "angle": "Personal Journey",
            "title": "【...】",
            "concept": "...",
            "slide_scenario": [10 slides following the same structure],
            "key_points": ["🎯 ...", "📈 ...", "🔄 ...", "💬 ..."]
          },
          {
            "angle": "Creative Experiment",
            "title": "【...】",
            "concept": "...",
            "slide_scenario": [10 slides following the same structure],
            "key_points": ["🎯 ...", "📈 ...", "🔄 ...", "💬 ..."]
          }
        ],
        "benchmark_indices": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      }

      CRITICAL REQUIREMENTS:
      - Each angle MUST have EXACTLY 10 slides (no more, no less)
      - Each slide MUST have slide number, title, detailed content (2-3 sentences), and specific research source
      - Slide structure MUST follow: Intro (1-2) → Trend Investigation (3-5) → Insight & Analysis (6-8) → Conclusion (9-10)
      - All content must be based on actual trend data provided
      - Each angle must investigate the SAME trends but from completely different perspectives
      - title in【】brackets
      - concept: ONE sentence only
      - key_points: EXACTLY 4 items (🎯, 📈, 🔄, 💬)
      - ALL Korean except keywords/angle
      - Extract 40-50 high-value keywords in ENGLISH based on actual video titles, descriptions, and trends
      - Make each slide scenario detailed, actionable, and research-backed`;
      
      // console.log('[AI Analysis] Sending request to Gemini API...');
      // console.log('[AI Analysis] Prompt length:', prompt.length, 'characters');

      const result = await aiModel.generateContent(prompt);
      // console.log('[AI Analysis] Received response from Gemini API');
      // console.log('[AI Analysis] Response time:', Date.now() - analysisStartTime, 'ms');

      const rawText = result.response.text().replace(/```json|```/g, '').trim();
      // console.log('[AI Analysis] Raw text length:', rawText.length, 'characters');
      // console.log('[AI Analysis] Raw text preview:', rawText.substring(0, 200));

      const res = JSON.parse(rawText);
      // console.log('[AI Analysis] JSON parsed successfully');
      
      // [v3.6.0] 키워드 데이터 검증 및 로깅
      // console.log('[AI Analysis] Raw response:', res);
      // console.log('[AI Analysis] Keywords received:', res.keywords);
      // console.log('[AI Analysis] Keywords type:', typeof res.keywords);
      // console.log('[AI Analysis] Is array:', Array.isArray(res.keywords));
      
      let keywords = res.keywords || [];
      
      // [v3.6.3] 키워드 데이터 형식 검증 및 변환
      if (keywords.length > 0) {
        // console.log('[AI Analysis] First keyword sample:', keywords[0]);
        // console.log('[AI Analysis] Keywords count:', keywords.length);
        
        // 키워드가 문자열 배열인 경우 {name, value} 형식으로 변환
        if (typeof keywords[0] === 'string') {
          // console.warn('[AI Analysis] Keywords are strings, converting to {name, value} format');
          keywords = keywords.map((keyword, index) => ({
            name: keyword,
            value: Math.max(10, 100 - Math.floor(index * 1.5)) // 인덱스에 따라 값 할당 (100부터 감소)
          }));
        } else if (keywords.length > 0 && (!keywords[0].name || keywords[0].value === undefined)) {
          // 키워드가 객체이지만 name이나 value가 없는 경우
          // console.warn('[AI Analysis] Keywords missing name or value, attempting to fix');
          keywords = keywords.map((keyword, index) => {
            if (typeof keyword === 'string') {
              return {
                name: keyword,
                value: Math.max(10, 100 - Math.floor(index * 1.5))
              };
            } else if (keyword && keyword.name && keyword.value === undefined) {
              return {
                name: keyword.name,
                value: Math.max(10, 100 - Math.floor(index * 1.5))
              };
            } else if (keyword && keyword.value !== undefined && !keyword.name) {
              return {
                name: `Keyword ${index + 1}`,
                value: keyword.value
              };
            }
            return keyword;
          }).filter(k => k && k.name && k.value !== undefined);
        }
        
        // 최종 검증: 모든 키워드가 올바른 형식인지 확인
        keywords = keywords.filter(k => {
          const isValid = k && typeof k === 'object' && k.name && (k.value !== undefined && k.value !== null);
          if (!isValid) {
            // console.warn('[AI Analysis] Filtered out invalid keyword:', k);
          }
          return isValid;
        });
        
        // console.log('[AI Analysis] Processed keywords:', keywords);
        // console.log('[AI Analysis] Final keywords count:', keywords.length);
      } else {
        // console.warn('[AI Analysis] No keywords received from AI response');
      }
      
      setAiKeywords(keywords);
      
      let similar = [];
      if (res.benchmark_indices && Array.isArray(res.benchmark_indices)) {
        similar = res.benchmark_indices
          .map(idx => filteredVideos[idx])
          .filter(v => v !== undefined);
      }
      
      // [v3.6.2] 6개 angles에 맞춰 benchmark도 8-10개로 확장
      if (similar.length === 0) similar = filteredVideos.slice(0, 8);

      setAiStrategy({ 
        strategy: res.overall_strategy, 
        stories: res.stories, 
        similarVideos: similar 
      });
    } catch (e) {
      console.error("[AI Analysis] FAILED - Error object:", e);
      console.error("[AI Analysis] Error message:", e.message);
      console.error("[AI Analysis] Error name:", e.name);
      console.error("[AI Analysis] Error stack:", e.stack);
      console.error("[AI Analysis] Time elapsed before error:", Date.now() - analysisStartTime, 'ms');

      let errMsg = "AI 분석 실패: API 키 또는 네트워크 상태를 확인해 주세요.";
      
      if (e.message?.includes("404")) {
        errMsg = "모델 미지원 (404): 현재 API 키에서 이 모델(gemini-3-pro-preview)을 찾을 수 없습니다. Google Cloud Console에서 'Generative Language API'가 활성화되어 있는지 확인해 주세요.";
      } else if (e.message?.includes("429")) {
        errMsg = "할당량 초과 또는 미지원 (429): 현재 계정에서 이 모델의 사용량이 제한되었습니다(limit: 0). 무료 티어에서 가용성이 높은 'gemini-1.5-flash' 모델로 변경을 고려해 보세요.";
      } else if (e.message?.includes("403")) {
        errMsg = "권한 거부 (403): API 서비스가 차단되었습니다. 구글 클라우드 설정을 확인해 주세요.";
      }
      
      alert(errMsg);
    } finally { 
      setIsAiLoading(false); 
    }
  };

  // [v4.2.0] 키워드 검색 함수 (선택된 국가별로 검색)
  const searchByKeyword = useCallback(async (keyword, countries = selectedCountries) => {
    if (!keyword || keyword.trim() === '') {
      alert('검색 키워드를 입력해주세요.');
      return;
    }

    if (!countries || countries.length === 0) {
      alert('검색할 국가를 선택해주세요.');
      return;
    }

    if (quotaExceededRef.current) {
      alert("YouTube API 할당량이 초과되었습니다.");
      return;
    }

    if (!YOUTUBE_API_KEY) {
      alert("YouTube API 키가 설정되지 않았습니다.");
      return;
    }

    setIsLoading(true);
    setApiStatus("loading");
    setSearchMode('keyword');
    setCurrentKeyword(keyword.trim());

    try {
      // console.log(`[v4.2.0] Keyword search: "${keyword}" for countries: ${countries.join(', ')}`);

      // [v4.2.3] 검색 기간: 일주일 전부터 현재까지
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const publishedAfter = oneWeekAgo.toISOString();
      // console.log(`[v4.2.3] Search date range: ${publishedAfter} ~ now`);

      // 각 국가별로 검색 수행
      const results = await Promise.allSettled(
        countries.map(async (country) => {
          // Step 1: Search API로 비디오 ID 가져오기 (국가별 최대 50개, 최근 일주일)
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&order=viewCount&regionCode=${country}&maxResults=50&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${YOUTUBE_API_KEY}`;

          // console.log(`[v4.2.0] Searching "${keyword}" in ${country}...`);
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();

          if (searchData.error) {
            const errorMessage = searchData.error.message || '';
            if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || searchResponse.status === 403) {
              quotaExceededRef.current = true;
              throw new Error('QUOTA_EXCEEDED');
            }
            throw new Error(searchData.error.message);
          }

          const searchItems = searchData.items || [];
          // console.log(`[v4.2.0] ${country}: Search returned ${searchItems.length} results`);

          if (searchItems.length === 0) {
            return { country, items: [] };
          }

          // Step 2: Videos API로 상세 정보 가져오기
          const videoIds = searchItems.map(item => item.id.videoId).join(',');
          const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;

          const videosResponse = await fetch(videosUrl);
          const videosData = await videosResponse.json();

          if (videosData.error) {
            const errorMessage = videosData.error.message || '';
            if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || videosResponse.status === 403) {
              quotaExceededRef.current = true;
              throw new Error('QUOTA_EXCEEDED');
            }
            throw new Error(videosData.error.message);
          }

          const videoItems = videosData.items || [];

          // 데이터 가공
          const processedVideos = videoItems.map((item, index) => ({
            id: item.id,
            uniqueId: `keyword_${country}_${item.id}_${Date.now()}`,
            title: item.snippet?.title || 'Unknown',
            channel: item.snippet?.channelTitle || 'Unknown',
            channelTitle: item.snippet?.channelTitle || 'Unknown', // AI 분석용
            description: item.snippet?.description || '', // AI 분석용
            thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
            viewCount: parseInt(item.statistics?.viewCount || '0', 10),
            likeCount: parseInt(item.statistics?.likeCount || '0', 10),
            commentCount: parseInt(item.statistics?.commentCount || '0', 10),
            publishedAt: item.snippet?.publishedAt || '',
            duration: item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) : 0,
            country: country,
            rank: index + 1,
            searchKeyword: keyword.trim()
          }));

          // console.log(`[v4.2.0] ${country}: Got ${processedVideos.length} videos`);
          return { country, items: processedVideos };
        })
      );

      // 결과 처리
      let allVideos = [];
      const countryBreakdown = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.items) {
          const { country, items } = result.value;
          allVideos = allVideos.concat(items);
          countryBreakdown[country] = items.length;
        }
      });

      // 중복 제거 (같은 비디오가 여러 국가에서 검색될 수 있음)
      const seen = new Set();
      const uniqueVideos = allVideos.filter(video => {
        if (seen.has(video.id)) return false;
        seen.add(video.id);
        return true;
      });

      // console.log(`[v4.2.0] Keyword search complete: ${uniqueVideos.length} unique videos for "${keyword}"`);
      // console.log(`[v4.2.0] Country breakdown:`, countryBreakdown);

      if (uniqueVideos.length === 0) {
        alert(`"${keyword}"에 대한 검색 결과가 없습니다.`);
        setIsLoading(false);
        setApiStatus("success");
        return;
      }

      // 조회수 순으로 정렬
      uniqueVideos.sort((a, b) => b.viewCount - a.viewCount);

      // 기존 데이터 교체
      setData(uniqueVideos);
      dataRef.current = uniqueVideos;
      loadedCountriesRef.current.clear();
      countries.forEach(c => loadedCountriesRef.current.add(c));

      setApiStatus("success");
    } catch (error) {
      console.error('[v4.2.0] Keyword search error:', error);
      setApiStatus("error");
      if (error.message !== 'QUOTA_EXCEEDED') {
        alert(`검색 중 오류가 발생했습니다: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCountries]);

  // [v4.2.0] 트렌딩 모드로 복귀
  const resetToTrending = useCallback(() => {
    setSearchMode('trending');
    setCurrentKeyword('');
    setData([]);
    dataRef.current = [];
    loadedCountriesRef.current.clear();
    hasLoadedRef.current = false;
  }, []);

  // [v3.6.1] totalViews를 useMemo로 메모이제이션하여 data 변경 시 자동 갱신
  const totalViews = useMemo(() => {
    const sum = data.reduce((acc, v) => acc + (v.viewCount || 0), 0);
    // console.log('[useTrendData] Total views calculated:', sum, 'from', data.length, 'videos');
    return sum;
  }, [data]);

  // [v3.6.1] analysis 객체를 useMemo로 메모이제이션하여 data나 aiKeywords 변경 시 자동 갱신
  const analysis = useMemo(() => ({
    keywords: aiKeywords,
    totalViews: totalViews
  }), [aiKeywords, totalViews]);

  return {
    data,
    analysis,
    aiStrategy,
    isLoading,
    isAiLoading,
    runAiAnalysis,
    apiStatus,
    countries: COUNTRIES,
    englishSpeakingCountries: ENGLISH_SPEAKING_COUNTRIES,
    // [v4.2.0] 키워드 검색 관련
    searchByKeyword,
    resetToTrending,
    searchMode,
    currentKeyword
  };
};

function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0"), m = parseInt(match[2] || "0"), s = parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}
