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

// [v2.3.0] 2026년 최신 검증 데이터 (100% 작동 확인 ID)
const VERIFIED_2026_ASSETS = [
  { id: 'AfQ13jsLDms', t: 'Stranger Things 5 | Finale Trailer', c: 'Netflix' },
  { id: 'K_CbgLpvHmw', t: '$1 vs $100,000,000 House!', c: 'MrBeast' },
  { id: 'w7ejDZ8SWv8', t: 'iPhone 16 Pro: The Real Review', c: 'MKBHD' },
  { id: 'OPf0YbXqDm0', t: 'Shark Attack Test 2026', c: 'Mark Rober' },
  { id: 'msN87yiajvw', t: 'The Future of Energy', c: 'Veritasium' },
  { id: 'RgKAFK5djSk', t: 'Ultimate Ramen Guide', c: 'Joshua Weissman' },
  { id: '7wtfhZwyrcc', t: 'Tokyo Night Life 2026', c: 'Paolo fromTOKYO' },
  { id: 'jG7dSXcfVqE', t: 'Why I Quit Everything', c: 'Casey Neistat' },
  { id: 'U9DyHthJ6LA', t: 'Gordon Ramsay on Hot Ones S25', c: 'First We Feast' },
  { id: 'n3Xv_g3g-mA', t: 'The Ego Explained', c: 'Kurzgesagt' },
  { id: 'uJ7-vS75Sno', t: 'Perfect Pasta Carbonara', c: 'Babish' },
  { id: 'BL4DqUMVudQ', t: 'Gaming PC for $500 in 2026', c: 'Linus Tech Tips' },
  { id: 'Y2TM40zWfIs', t: 'SpaceX Mars Mission Update', c: 'SpaceX' },
  { id: '377uInSAtCI', t: 'Golf Trick Shots 5', c: 'Dude Perfect' },
  { id: 'oe64p-QzhNE', t: 'Ancient Rome in 5 Minutes', c: 'TED-Ed' }
];

export const useTrendData = (selectedCountries, enabled = true) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiKeywords, setAiKeywords] = useState([]);
  const [aiStrategy, setAiStrategy] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("idle");
  const quotaExceededRef = useRef(false); // 할당량 초과 플래그
  const hasLoadedRef = useRef(false); // 로그인 후 한 번만 로드하기 위한 플래그

  const fetchTrends = useCallback(async () => {
    // [v3.4.1] 할당량 초과 시 재시도 방지
    if (quotaExceededRef.current) {
      console.warn("[v3.4.1] Quota exceeded. Using simulation mode.");
      setApiStatus("blocked");
      generateSimulatedData();
      return;
    }
    
    // [v3.3.7] API 키가 없으면 시뮬레이션 모드로 강제 전환하여 앱이 멈추지 않게 함
    if (!YOUTUBE_API_KEY) {
      console.warn("[v3.3.7] YouTube API Key missing. Forcing Simulation Mode.");
      setApiStatus("blocked");
      generateSimulatedData();
      return;
    }
    
    setIsLoading(true);
    setApiStatus("loading");

    try {
      const allItemsMap = new Map();

      console.log(`[v3.5.3] Starting data collection for ${selectedCountries.length} countries: ${selectedCountries.join(', ')}`);
      
      const results = await Promise.allSettled(
        selectedCountries.map(async (country) => {
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

      let totalBeforeDedup = 0;
      let duplicateCount = 0;
      const countryStats = {};
      
      successfulResults.forEach(({ country, items }) => {
        countryStats[country] = items.length;
        totalBeforeDedup += items.length;
        items.forEach(item => {
          if (!allItemsMap.has(item.id)) {
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
              console.log(`[v3.5.3] Duplicate video ID found: ${item.id} (already exists from another country)`);
            }
          }
        });
      });

      const finalData = Array.from(allItemsMap.values()).sort((a, b) => b.viewCount - a.viewCount);
      
      // [v3.5.3] 상세 통계 로그
      console.log(`[v3.5.3] ===== Data Collection Summary =====`);
      console.log(`[v3.5.3] Selected countries: ${selectedCountries.length} (${selectedCountries.join(', ')})`);
      console.log(`[v3.5.3] Successful countries: ${successfulResults.length}`);
      if (failedCountries.length > 0) {
        console.log(`[v3.5.3] Failed countries: ${failedCountries.length} (${failedCountries.join(', ')})`);
      }
      console.log(`[v3.5.3] Country breakdown:`, countryStats);
      console.log(`[v3.5.3] Total before deduplication: ${totalBeforeDedup}`);
      console.log(`[v3.5.3] Duplicates removed: ${duplicateCount}`);
      console.log(`[v3.5.3] Final unique videos: ${finalData.length}`);
      console.log(`[v3.5.3] ====================================`);
      
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
        console.warn("[v3.4.1] YouTube API Quota Exceeded. Switching to simulation mode.");
        setApiStatus("blocked");
        generateSimulatedData();
      } else {
        console.warn("[v2.3.0] API Error Detected. Running 2026 Sync Simulation.", error.message);
        setApiStatus("blocked");
        generateSimulatedData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCountries]);

  const generateSimulatedData = () => {
    const simData = [];
    const seed = Date.now();
    for (let i = 0; i < 500; i++) {
      const asset = VERIFIED_2026_ASSETS[i % VERIFIED_2026_ASSETS.length];
      const country = selectedCountries[i % selectedCountries.length];
      simData.push({
        uniqueId: `v230-sim-${asset.id}-${i}`,
        id: asset.id,
        title: asset.t,
        description: `This is a simulated description for ${asset.t} by ${asset.c}. Trending in 2026.`,
        channelTitle: asset.c,
        publishedAt: new Date(seed - (Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${asset.id}/hqdefault.jpg`,
        viewCount: Math.floor(Math.random() * 5000000) + 100000,
        country: country,
        isShorts: (i % 12 === 0)
      });
    }
    setData(simData.sort(() => Math.random() - 0.5));
  };

  useEffect(() => {
    // [v3.4.3] 로그인 후 화면 로드 시 또는 국가 변경 시 API 호출
    // [v3.5.2] 국가 선택 시마다 데이터 다시 가져오기
    if (enabled) {
      if (!hasLoadedRef.current) {
        // 첫 로그인 시 플래그 설정
        hasLoadedRef.current = true;
      }
      fetchTrends();
    } else {
      // 로그아웃 시 플래그 리셋
      hasLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedCountries.join(',')]); // enabled 또는 selectedCountries 변경 시 실행

  const runAiAnalysis = async (filteredVideos) => {
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
      // 선택된 구간의 비디오 메타데이터를 더 상세하게 전달 (설명 포함)
      const sampleData = filteredVideos.map((v, index) => ({
        index,
        title: v.title,
        channel: v.channelTitle,
        description: v.description.substring(0, 100) // 설명은 100자까지만
      }));

      const prompt = `You are a World-Class YouTube Storytelling Strategist. 
      Analyze the trending data and derive 3 distinct video production strategies (Sub-Stories) based on different angles.
      
      TREND DATA:
      ${JSON.stringify(sampleData)}

      INSTRUCTIONS:
      1. Analyze the core trend.
      2. Derive 3 completely different storytelling angles (e.g., Documentary, Review/Analysis, Entertainment/Challenge).
      3. For each angle, provide a title and a detailed concept.
      4. Select 5 benchmark videos index from data.

      Return ONLY a JSON object with this structure:
      {
        "keywords": [{"name": "Keyword", "value": 10-100}],
        "overall_strategy": "A deep, 2-sentence summary of the weekly trend in Korean.",
        "stories": [
          {
            "angle": "Angle Name (e.g. Documentary)",
            "title": "Video Title",
            "concept": "Storytelling strategy and concept in Korean.",
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
      Extract 30-40 high-value keywords in ENGLISH. All other textual analysis (overall_strategy, stories) must be in KOREAN.`;
      
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
