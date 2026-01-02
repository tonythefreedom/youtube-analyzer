import React, { useRef, useEffect } from 'react';
import { Play, ExternalLink, Globe, Clock, BarChart, Zap } from 'lucide-react';

const VideoItemSimple = ({ video }) => {
  const handleOpenYouTube = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    // [v1.8.0] 절대 경로 일치 검증
    console.log(`[v1.8.0 ACTION] Opening ID: ${video.id} | Title: ${video.title}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      onClick={handleOpenYouTube}
      className="group relative bg-surface/40 hover:bg-surface/80 rounded-2xl border border-gray-800/50 hover:border-primary/30 transition-all p-3 flex gap-4 cursor-pointer overflow-hidden"
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <ExternalLink size={14} className="text-primary" />
      </div>
      
      <div className="relative w-40 md:w-52 flex-shrink-0 aspect-video rounded-xl overflow-hidden shadow-xl bg-black">
        <img 
          src={video.thumbnail} 
          alt=""
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            const cur = e.target.src;
            if (cur.includes('hqdefault')) {
              e.target.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
            } else if (cur.includes('mqdefault')) {
              e.target.src = `https://img.youtube.com/vi/${video.id}/0.jpg`;
            }
          }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-black p-2 rounded-full shadow-lg shadow-primary/50">
            <Play size={20} fill="currentColor" />
          </div>
        </div>
        {video.isShorts && (
          <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded uppercase">Shorts</div>
        )}
      </div>

      <div className="flex-grow min-w-0 flex flex-col justify-between py-1">
        <div>
          <h3 className="text-sm font-bold text-gray-100 line-clamp-2 leading-snug group-hover:text-primary transition-colors mb-1 uppercase tracking-tight">
            {video.title}
          </h3>
          <p className="text-[10px] font-black text-gray-500 uppercase">{video.channelTitle}</p>
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
            <div className="flex items-center gap-1">
              <BarChart size={12} className="text-primary" />
              {(video.viewCount / 10000).toFixed(0)}만
            </div>
            <div className="flex items-center gap-1">
              <Globe size={10} className="text-primary/60" />
              {video.country}
            </div>
          </div>
          <span className="text-[8px] font-mono text-gray-700 bg-black/30 px-1.5 py-0.5 rounded border border-gray-800/30">
            {video.id}
          </span>
        </div>
      </div>
    </div>
  );
};

const VideoList = ({ videos }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    // [v2.8.0 CRITICAL SYNC]
    if (videos.length > 0) {
      console.log(`[v2.8.0] DATA SYNC CHECK: ID=${videos[0].id} | Title=${videos[0].title}`);
    }
  }, [videos]);

  if (!videos || videos.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-gray-700 bg-black/20 rounded-3xl border border-dashed border-gray-800">
        <Zap size={40} className="mb-4 opacity-10" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Searching Trends...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-grow overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-800 min-h-0"
    >
      {videos.map((video) => (
        <VideoItemSimple key={video.uniqueId} video={video} />
      ))}
      <div className="h-20 flex-shrink-0" />
    </div>
  );
};

export default VideoList;
