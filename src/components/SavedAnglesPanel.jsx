import React, { useState } from 'react';
import { X, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';

const SavedAnglesPanel = ({
  isOpen,
  onClose,
  savedAngles,
  onDelete,
  onClearAll
}) => {
  const [copiedId, setCopiedId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleCopy = (angle) => {
    const slideText = angle.angleData.slide_scenario?.map(s =>
      `${s.slide}\n  내용: ${s.content}\n  리서치: ${s.research}`
    ).join('\n\n') || 'N/A';

    const text = `[${angle.angleData.angle}]\n\n📌 Title: ${angle.angleData.title}\n\n💡 Concept: ${angle.angleData.concept}\n\n🎬 슬라이드 시나리오:\n${slideText}\n\n🎯 Key Points:\n${angle.angleData.key_points.map(p => `${p}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedId(angle.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearAll = () => {
    onClearAll();
    setShowClearConfirm(false);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-surface border-l border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Saved Angles</h2>
              <p className="text-[10px] text-gray-500 font-bold mt-1">
                {savedAngles.length} angle{savedAngles.length !== 1 ? 's' : ''} saved
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {savedAngles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📑</span>
                </div>
                <p className="text-sm text-gray-400 font-bold">No saved angles</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  Click the bookmark icon on any angle to save it
                </p>
              </div>
            ) : (
              savedAngles.map((angle) => (
                <div
                  key={angle.id}
                  className="bg-black/40 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[8px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter">
                      {angle.angleData.angle}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {formatDate(angle.savedAt)}
                    </span>
                  </div>

                  <h3 className="text-[11px] font-bold text-white mb-1 line-clamp-2 uppercase">
                    {angle.angleData.title}
                  </h3>

                  <p className="text-[10px] text-gray-400 line-clamp-2 italic mb-3">
                    {angle.angleData.concept}
                  </p>

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleCopy(angle)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[9px] font-bold transition-colors"
                    >
                      {copiedId === angle.id ? (
                        <>
                          <Check size={12} className="text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => onDelete(angle.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[9px] font-bold transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {savedAngles.length > 0 && (
            <div className="p-4 border-t border-gray-800">
              {showClearConfirm ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-[10px] font-bold text-red-400">Delete all saved angles?</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearAll}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-400 transition-colors"
                    >
                      Yes, Delete All
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 text-[10px] font-bold hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors"
                >
                  Clear All Saved Angles
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SavedAnglesPanel;
