import React, { useState } from 'react';
import { AdListing } from '../../types';
import { Megaphone, ExternalLink, Sparkles, ChevronRight, X } from 'lucide-react';

interface AdBannerProps {
  ads: AdListing[];
  onOpenContactModal: () => void;
}

export const AdBanner: React.FC<AdBannerProps> = ({ ads, onOpenContactModal }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  const activeAds = ads.filter((a) => a.isActive);
  if (activeAds.length === 0 || isDismissed) return null;

  const currentAd = activeAds[currentIndex % activeAds.length];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeAds.length);
  };

  return (
    <div className="w-full bg-[#0c0e15] border-t border-slate-800/80 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-300">
      {/* Ad content */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
          Auspicio Local
        </span>

        <div className="flex items-center gap-2 truncate">
          <strong className="text-white font-semibold truncate">{currentAd.businessName}:</strong>
          <span className="text-slate-400 truncate">{currentAd.title}</span>
          {currentAd.discountBadge && (
            <span className="hidden sm:inline text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.2 rounded">
              {currentAd.discountBadge}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={currentAd.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-xs font-medium flex items-center gap-1 transition-colors"
        >
          <span>Ver promo</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {activeAds.length > 1 && (
          <button
            onClick={handleNext}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Siguiente anuncio"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onOpenContactModal}
          className="hidden md:inline px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          Anunciar acá
        </button>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-slate-500 hover:text-slate-400"
          title="Ocultar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
