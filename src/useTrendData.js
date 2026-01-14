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

export const useTrendData = (selectedCountries, enabled = true) => {
  const [data, setData] = useState([]);
  const dataRef = useRef(data); // [v3.5.4] 최신 data 참조를 위한 ref
  const [isLoading, setIsLoading] = useState(false);
  const [aiKeywords, setAiKeywords] = useState([]);
  const [aiStrategy, setAiStrategy] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("idle");
  const quotaExceededRef = useRef(false); // 할당량 초과 플래그
  const hasLoadedRef = useRef(false); // 로그인 후 한 번만 로드하기 위한 플래그
  const loadedCountriesRef = useRef(new Set()); // [v3.5.4] 이미 로드된 국가 추적
  
  // [v3.5.4] data가 변경될 때마다 ref 업데이트
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchTrends = useCallback(async () => {
    // [v3.5.4] data를 의존성에 추가하여 기존 데이터에 접근 가능하도록 함
    // [v3.5.9] 할당량 초과 시 재시도 방지 및 실제 데이터만 사용
    if (quotaExceededRef.current) {
      console.warn("[v3.5.9] Quota exceeded. No data will be loaded.");
      setApiStatus("blocked");
      setData([]);
      alert("YouTube API 할당량이 초과되었습니다. API 키의 할당량을 확인해 주세요.");
      setIsLoading(false);
      return;
    }
    
    // [v3.5.9] API 키가 없으면 데이터를 로드하지 않음
    if (!YOUTUBE_API_KEY) {
      console.warn("[v3.5.9] YouTube API Key missing. No data will be loaded.");
      setApiStatus("blocked");
      setData([]);
      alert("YouTube API 키가 설정되지 않았습니다. GitHub Secrets를 확인해 주세요.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setApiStatus("loading");

    try {
      // [v3.5.4] 기존 데이터를 Map으로 변환하여 유지 (ref를 통해 최신 데이터 접근)
      const existingDataMap = new Map();
      dataRef.current.forEach(video => {
        existingDataMap.set(video.id, video);
      });
      
      // [v3.5.4] 아직 로드되지 않은 국가만 필터링
      const countriesToFetch = selectedCountries.filter(country => !loadedCountriesRef.current.has(country));
      
      if (countriesToFetch.length === 0) {
        console.log(`[v3.5.4] All selected countries already loaded. No new API calls needed.`);
        setIsLoading(false);
        return;
      }
      
      console.log(`[v3.5.4] Starting data collection for ${countriesToFetch.length} new countries: ${countriesToFetch.join(', ')}`);
      console.log(`[v3.5.4] Already loaded countries: ${Array.from(loadedCountriesRef.current).join(', ') || 'none'}`);
      
      const results = await Promise.allSettled(
        countriesToFetch.map(async (country) => {
          // [v3.4.4] YouTube API mostPopular는 최대 200개까지만 반환 (500개는 불가능)
          const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${country}&maxResults=200&key=${YOUTUBE_API_KEY}`;
          const response = await fetch(url);
          const resData = await response.json();
          
          // [v3.4.1] 할당량 초과 오류 명확히 감지
          if (resData.error) {
            const errorMessage = resData.error.message || '';
            if (errorMessage.includes('quota') || errorMessage.includes('exceeded') || response.status === 403) {
              quotaExceededRef.current = true;
              throw new Error('QUOTA_EXCEEDED');
            }
            throw new Error(resData.error.message);
          }
          
          const allItems = resData.items || [];
          // [v3.4.4] categoryId 필터 제거 - 음악 카테고리도 포함하여 더 많은 데이터 확보
          const filteredItems = allItems; // 필터 제거: .filter(item => item.snippet.categoryId !== "10")
          
          console.log(`[v3.5.3] ${country}: API returned ${allItems.length} items (requested 200), after filter: ${filteredItems.length}`);
          if (allItems.length < 200) {
            console.warn(`[v3.5.3] ${country}: API returned only ${allItems.length} items instead of 200. This may be due to API limitations or region-specific restrictions.`);
          }
          
          return { 
            country, 
            items: filteredItems
          };
        })
      );
      
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

      // [v3.5.4] 기존 데이터를 먼저 Map에 추가
      const allItemsMap = new Map(existingDataMap);
      
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
              isShorts: item.contentDetails?.duration ? parseDuration(item.contentDetails.duration) <= 60 : false
            });
          } else {
            duplicateCount++;
            // 중복 발견 시 로그 (너무 많으면 로그 제한)
            if (duplicateCount <= 10) {
              console.log(`[v3.5.4] Duplicate video ID found: ${item.id} (already exists)`);
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

      const finalData = Array.from(allItemsMap.values()).sort((a, b) => b.viewCount - a.viewCount);
      
      // [v3.5.4] 상세 통계 로그
      console.log(`[v3.5.4] ===== Data Collection Summary =====`);
      console.log(`[v3.5.4] Selected countries: ${selectedCountries.length} (${selectedCountries.join(', ')})`);
      console.log(`[v3.5.4] New countries fetched: ${countriesToFetch.length} (${countriesToFetch.join(', ')})`);
      console.log(`[v3.5.4] Successful countries: ${successfulResults.length}`);
      if (failedCountries.length > 0) {
        console.log(`[v3.5.4] Failed countries: ${failedCountries.length} (${failedCountries.join(', ')})`);
      }
      console.log(`[v3.5.4] Country breakdown:`, countryStats);
      console.log(`[v3.5.4] Existing videos: ${existingDataMap.size}`);
      console.log(`[v3.5.4] New videos added: ${newItemsCount}`);
      console.log(`[v3.5.4] Total before deduplication: ${totalBeforeDedup}`);
      console.log(`[v3.5.4] Duplicates removed: ${duplicateCount}`);
      console.log(`[v3.5.4] Final unique videos: ${finalData.length}`);
      console.log(`[v3.5.4] ====================================`);
      
      if (finalData.length < 50) {
        console.warn(`[v3.5.3] WARNING: Only ${finalData.length} videos collected. This may be insufficient for rank range filtering.`);
        console.warn(`[v3.5.3] Possible reasons: API limitations, high duplicate rate, or failed API calls.`);
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
        console.warn("[v3.5.9] YouTube API Quota Exceeded. No simulation data will be used.");
        handleApiFailure("YouTube API 할당량이 초과되었습니다.");
      } else {
        console.warn("[v3.5.9] API Error Detected. No simulation data will be used.", error.message);
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
    if (enabled) {
      if (!hasLoadedRef.current) {
        // 첫 로그인 시 플래그 설정 및 로드된 국가 초기화
        hasLoadedRef.current = true;
        loadedCountriesRef.current.clear();
      }
      fetchTrends();
    } else {
      // 로그아웃 시 플래그 및 로드된 국가 리셋
      hasLoadedRef.current = false;
      loadedCountriesRef.current.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedCountries.join(',')]); // enabled 또는 selectedCountries 변경 시 실행

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
    try {
      // [v3.5.9] 분석 컨텍스트 정보 수집
      const { selectedCountries = [], rankRange = 'all', dateRange = null, totalVideos = 0 } = analysisContext;
      
      // 선택된 구간의 비디오 메타데이터를 더 상세하게 전달 (국가, 조회수, 날짜 포함)
      const sampleData = filteredVideos.map((v, index) => ({
        index,
        title: v.title,
        channel: v.channelTitle,
        country: v.country,
        views: v.viewCount,
        publishedAt: v.publishedAt,
        description: v.description.substring(0, 200) // 설명은 200자까지 확장
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

      const prompt = `You are a World-Class YouTube Storytelling Strategist and Trend Analyst.
      Analyze the trending video data and derive 3 distinct video production strategies (Sub-Stories) based on different storytelling angles.

      ANALYSIS CONTEXT:
      - Countries: ${countriesInfo}
      - Date Range: ${dateInfo}
      - Rank Range: ${rankInfo}
      - Total Videos Analyzed: ${filteredVideos.length} out of ${totalVideos} total collected videos
      - Data Source: YouTube Trending Videos API

      TREND DATA (${filteredVideos.length} videos):
      ${JSON.stringify(sampleData, null, 2)}

      INSTRUCTIONS:
      1. Analyze the core trend patterns across the selected countries and date range.
      2. Identify common themes, content types, and storytelling approaches that are performing well.
      3. Derive 3 completely different storytelling angles (e.g., Documentary, Review/Analysis, Entertainment/Challenge, Educational, Personal Story, etc.).
      4. For each angle, provide:
         - A compelling video title
         - A detailed concept explaining the storytelling strategy
         - Key points including story hook, main conflict/point, and call to action
      5. Select 5 benchmark video indices from the provided data that best represent successful examples.

      Return ONLY a JSON object with this structure:
      {
        "keywords": [{"name": "Keyword", "value": 10-100}],
        "overall_strategy": "A deep, 2-3 sentence summary of the trend analysis in Korean, considering the multi-country and monthly time span context.",
        "stories": [
          {
            "angle": "Angle Name (e.g. Documentary)",
            "title": "Video Title",
            "concept": "Storytelling strategy and concept in Korean, explaining how this angle addresses the identified trend.",
            "key_points": ["Story Hook", "Main Conflict/Point", "Call to Action"]
          },
          {
            "angle": "Angle Name",
            "title": "Video Title",
            "concept": "...",
            "key_points": ["...", "...", "..."]
          },
          {
            "angle": "Angle Name",
            "title": "Video Title",
            "concept": "...",
            "key_points": ["...", "...", "..."]
          }
        ],
        "benchmark_indices": [index1, index2, index3, index4, index5]
      }
      
      IMPORTANT:
      - Extract 30-40 high-value keywords in ENGLISH based on the actual video titles, descriptions, and trends.
      - All other textual analysis (overall_strategy, stories) must be in KOREAN.
      - Consider the multi-country context and monthly time span when analyzing trends.
      - The benchmark indices should reference the actual index numbers from the provided data array.`;
      
      const result = await aiModel.generateContent(prompt);
      const rawText = result.response.text().replace(/```json|```/g, '').trim();
      const res = JSON.parse(rawText);
      
      setAiKeywords(res.keywords || []);
      
      let similar = [];
      if (res.benchmark_indices && Array.isArray(res.benchmark_indices)) {
        similar = res.benchmark_indices
          .map(idx => filteredVideos[idx])
          .filter(v => v !== undefined);
      }
      
      if (similar.length === 0) similar = filteredVideos.slice(0, 5);

      setAiStrategy({ 
        strategy: res.overall_strategy, 
        stories: res.stories, 
        similarVideos: similar 
      });
    } catch (e) { 
      console.error("AI Analysis Failed", e); 
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

  return { data, analysis: { keywords: aiKeywords, totalViews: data.reduce((sum, v) => sum + v.viewCount, 0) }, aiStrategy, isLoading, isAiLoading, runAiAnalysis, apiStatus, countries: COUNTRIES, englishSpeakingCountries: ENGLISH_SPEAKING_COUNTRIES };
};

function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0"), m = parseInt(match[2] || "0"), s = parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}
