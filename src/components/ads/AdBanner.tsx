import React, { useState, useEffect } from 'react';
import { AdListing } from '../../types';
import {
  ExternalLink,
  MessageCircle,
  X,
  Megaphone,
} from 'lucide-react';

interface AdBannerProps {
  ads: AdListing[];
  onOpenContactModal: () => void;
}

const isSafeExternalUrl = (raw?: string): string => {
  if (!raw || typeof raw !== 'string') return '#';
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '#';
};

export const AdBanner: React.FC<AdBannerProps> = ({ ads, onOpenContactModal }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-achicar el botón de auspicio después de los 5 segundos para despejar la pantalla
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCompact(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const activeAds = ads.filter((a) => a.isActive);

  // Botón para habilitar el banner cuando el usuario lo cerró con la "x"
  if (isDismissed) {
    return (
      <div className="fixed bottom-3 left-3 sm:left-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`h-9 rounded-xl bg-[#202329] hover:bg-[#101114] text-[#FFF19A] border-2 border-[#FFF19A]/50 shadow-[3px_3px_0px_rgba(0,0,0,0.65)] text-xs font-black flex items-center cursor-pointer transition-all duration-300 active:scale-95 group ${
            isCompact && !isHovered ? 'w-9 px-0 justify-center' : 'px-3.5 gap-2'
          }`}
          title="Habilitar banner publicitario de auspicios locales"
        >
          <Megaphone className="w-4 h-4 text-[#FFF19A] shrink-0" />
          <span
            className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
              isCompact && !isHovered ? 'max-w-0 opacity-0 -ml-1 pointer-events-none' : 'max-w-xs opacity-100'
            }`}
          >
            Habilitar Banner Publicitario
          </span>
          <span className="w-2 h-2 rounded-full bg-[#B7F36B] ml-0.5 shrink-0" />
        </button>
      </div>
    );
  }

  if (activeAds.length === 0) return null;

  const marqueeItems = [...activeAds, ...activeAds, ...activeAds];

  return (
    <div
      className="w-full bg-[#101114] border-t-2 border-white/10 relative overflow-hidden z-20 transition-all select-none"
      title="Auspicios locales en vivo: pasá el cursor para pausar y hacer clic en cualquier comercio"
    >
      <div className="flex items-center h-12 sm:h-13 px-2 sm:px-3 gap-2">
        {/* Left Sticky Compact Pill */}
        <div className="flex items-center shrink-0 z-10 bg-[#101114] pr-2 border-r border-white/10">
          <button
            type="button"
            onClick={onOpenContactModal}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`h-8 rounded-xl bg-[#FFF19A] hover:bg-[#fff5b8] text-[#101114] border border-[#FFF19A] text-[10px] font-black uppercase tracking-tight flex items-center active:scale-95 transition-all duration-300 ease-in-out cursor-pointer shrink-0 group ${
              isCompact && !isHovered ? 'w-8 px-0 justify-center' : 'px-2.5 gap-1'
            }`}
            title="Auspicio - Pedir incluir un negocio en el banner publicitario de UPPA"
          >
            <Megaphone className="w-3.5 h-3.5 text-[#101114] shrink-0" />
            <span
              className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isCompact && !isHovered ? 'max-w-0 opacity-0 -ml-1 pointer-events-none' : 'max-w-xs opacity-100 ml-1'
              }`}
            >
              Auspicio
            </span>
          </button>
        </div>

        {/* Infinite Moving Marquee Track */}
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee-infinite flex items-center gap-3">
            {marqueeItems.map((ad, idx) => {
              const safeWebUrl = isSafeExternalUrl(ad.linkUrl);
              const safeWaUrl = isSafeExternalUrl(ad.whatsappUrl);
              return (
                <div
                  key={`${ad.id}-${idx}`}
                  className="flex items-center gap-2.5 px-3 py-1 rounded-xl bg-[#202329] hover:border-[#FFF19A]/50 border border-white/10 transition-all shrink-0 group"
                >
                  <a
                    href={safeWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/15"
                    title={`Visitar ${ad.businessName}`}
                  >
                    <img
                      src={ad.imageUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80'}
                      alt={ad.businessName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </a>

                  <a
                    href={safeWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0"
                    title={`Ingresar a ${ad.businessName}`}
                  >
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-white font-bold text-xs group-hover:text-[#FFF19A] transition-colors truncate">
                          {ad.businessName}
                        </strong>
                        {ad.discountBadge && (
                          <span className="text-[9.5px] font-mono font-black text-[#101114] bg-[#FFF19A] px-1.5 py-0.2 rounded shrink-0">
                            {ad.discountBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-[#9299A5] truncate max-w-[190px] sm:max-w-xs">
                        {ad.title}
                      </span>
                    </div>
                  </a>

                  <div className="flex items-center gap-1.5 ml-1 shrink-0">
                    <a
                      href={safeWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 px-2.5 rounded-lg bg-[#101114] hover:bg-white/5 border border-white/15 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                      title={`Abrir sitio web oficial de ${ad.businessName}`}
                    >
                      <span>Web</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#FFF19A]" />
                    </a>

                    {safeWaUrl !== '#' && (
                      <a
                        href={safeWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 px-2.5 rounded-lg bg-[#B7F36B] hover:bg-[#c5f784] text-[#101114] text-[11px] font-black flex items-center gap-1 transition-all"
                        title={`Contactar o pedir a ${ad.businessName} por WhatsApp`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 bg-[#101114] pl-2 border-l border-white/10">
          <button
            type="button"
            onClick={onOpenContactModal}
            className="hidden lg:flex px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold text-[#9299A5] hover:text-[#FFF19A] hover:bg-[#202329] transition-colors cursor-pointer"
            title="Pedir incluir mi negocio en el banner"
          >
            Anunciar
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-8 h-8 rounded-lg text-[#9299A5] hover:text-white hover:bg-[#202329] flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar banner publicitario (podrás habilitarlo nuevamente en cualquier momento)"
            aria-label="Cerrar banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
