import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'yt-trend-scope-saved-angles';
const MAX_SAVED_ANGLES = 100;

const getInitialData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { version: 1, angles: [] };
    }
    const parsed = JSON.parse(stored);
    if (!parsed.version || !Array.isArray(parsed.angles)) {
      return { version: 1, angles: [] };
    }
    return parsed;
  } catch (e) {
    // console.error('[useSavedAngles] Failed to parse stored data:', e);
    return { version: 1, angles: [] };
  }
};

export const useSavedAngles = () => {
  const [data, setData] = useState(getInitialData);

  // localStorage에 저장
  const saveToStorage = useCallback((newData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      // console.error('[useSavedAngles] Failed to save to localStorage:', e);
    }
  }, []);

  // Angle 저장
  const saveAngle = useCallback((angleData) => {
    const id = `angle-${Date.now()}`;
    const newAngle = {
      id,
      savedAt: new Date().toISOString(),
      angleData: {
        angle: angleData.angle,
        title: angleData.title,
        concept: angleData.concept,
        slide_scenario: angleData.slide_scenario || [],
        key_points: angleData.key_points || []
      }
    };

    setData(prev => {
      let newAngles = [newAngle, ...prev.angles];

      // 최대 개수 제한
      if (newAngles.length > MAX_SAVED_ANGLES) {
        newAngles = newAngles.slice(0, MAX_SAVED_ANGLES);
      }

      const newData = { ...prev, angles: newAngles };
      saveToStorage(newData);
      return newData;
    });

    return id;
  }, [saveToStorage]);

  // 개별 Angle 삭제
  const deleteAngle = useCallback((angleId) => {
    setData(prev => {
      const newAngles = prev.angles.filter(a => a.id !== angleId);
      const newData = { ...prev, angles: newAngles };
      saveToStorage(newData);
      return newData;
    });
  }, [saveToStorage]);

  // 전체 삭제
  const clearAllAngles = useCallback(() => {
    const newData = { version: 1, angles: [] };
    setData(newData);
    saveToStorage(newData);
  }, [saveToStorage]);

  // 중복 체크 (angle + title + concept 조합)
  const isAngleSaved = useCallback((angleData) => {
    return data.angles.some(saved =>
      saved.angleData.angle === angleData.angle &&
      saved.angleData.title === angleData.title &&
      saved.angleData.concept === angleData.concept
    );
  }, [data.angles]);

  // 저장된 개수
  const savedCount = data.angles.length;

  return {
    savedAngles: data.angles,
    saveAngle,
    deleteAngle,
    clearAllAngles,
    isAngleSaved,
    savedCount
  };
};

export default useSavedAngles;
