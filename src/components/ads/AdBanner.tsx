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
          className={`h-8.5 rounded-full bg-[#0a0d14]/95 hover:bg-slate-900 text-amber-300 hover:text-white border border-amber-400/40 shadow-2xl backdrop-blur-md text-xs font-bold flex items-center cursor-pointer transition-all duration-500 active:scale-95 ring-1 ring-amber-400/30 group ${
            isCompact && !isHovered ? 'w-8.5 px-0 justify-center' : 'px-3.5 gap-2'
          }`}
          title="Habilitar banner publicitario de auspicios locales"
        >
          <Megaphone className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
          <span
            className={`transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${
              isCompact && !isHovered ? 'max-w-0 opacity-0 -ml-1 pointer-events-none' : 'max-w-xs opacity-100'
            }`}
          >
            Habilitar Banner Publicitario
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5 shrink-0" />
        </button>
      </div>
    );
  }

  if (activeAds.length === 0) return null;

  // Cloned list to achieve smooth infinite looping without visual seams
  const marqueeItems = [...activeAds, ...activeAds, ...activeAds];

  return (
    <div
      className="w-full bg-[#0a0d14]/95 border-t border-slate-800/80 backdrop-blur-xl relative overflow-hidden z-20 transition-all select-none"
      title="Auspicios locales en vivo: pasá el cursor para pausar y hacer clic en cualquier comercio"
    >
      <div className="flex items-center h-12 sm:h-13 px-2 sm:px-3 gap-2">
        {/* Left Sticky Compact Pill: "Auspicio Local" que se achica automáticamente a los 5 segundos */}
        <div className="flex items-center shrink-0 z-10 bg-[#0a0d14] pr-1.5 border-r border-slate-800/80">
          <button
            type="button"
            onClick={onOpenContactModal}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`h-7.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 text-amber-300 hover:text-white border border-amber-400/40 hover:border-amber-300 text-[10px] font-black uppercase tracking-tight flex items-center shadow-sm active:scale-95 transition-all duration-500 ease-in-out cursor-pointer shrink-0 group ${
              isCompact && !isHovered ? 'w-7.5 px-0 justify-center' : 'px-2 gap-1'
            }`}
            title="Auspicio - Pedir incluir un negocio en el banner publicitario de UPPA"
          >
            <Megaphone className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            <span
              className={`transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${
                isCompact && !isHovered ? 'max-w-0 opacity-0 -ml-1 pointer-events-none' : 'max-w-xs opacity-100 ml-1'
              }`}
            >
              Auspicio
            </span>
            <span
              className={`hidden sm:inline text-[8.5px] bg-amber-400/20 px-1 py-0.2 rounded text-amber-200 font-extrabold border border-amber-400/30 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${
                isCompact && !isHovered ? 'max-w-0 opacity-0 border-0 p-0 m-0 pointer-events-none' : 'max-w-xs opacity-100 ml-0.5'
              }`}
            >
              + Negocio
            </span>
          </button>
        </div>

        {/* Infinite Moving Marquee Track (Auto-pausa suavemente al pasar el mouse encima) */}
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee-infinite flex items-center gap-3">
            {marqueeItems.map((ad, idx) => (
              <div
                key={`${ad.id}-${idx}`}
                className="flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-sky-400/40 transition-all shrink-0 group"
              >
                {/* Image */}
                <a
                  href={ad.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 group-hover:border-sky-400 transition-colors"
                  title={`Visitar ${ad.businessName}`}
                >
                  <img
                    src={ad.imageUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80'}
                    alt={ad.businessName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </a>

                {/* Information Text */}
                <a
                  href={ad.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0"
                  title={`Ingresar a ${ad.businessName}: ${ad.linkUrl}`}
                >
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-white font-bold text-xs group-hover:text-sky-300 transition-colors truncate">
                        {ad.businessName}
                      </strong>
                      {ad.discountBadge && (
                        <span className="text-[9.5px] font-mono font-extrabold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.2 rounded shrink-0">
                          {ad.discountBadge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-400 group-hover:text-slate-200 transition-colors truncate max-w-[190px] sm:max-w-xs">
                      {ad.title}
                    </span>
                  </div>
                </a>

                {/* Direct Action Buttons: Web and WhatsApp */}
                <div className="flex items-center gap-1.5 ml-1 shrink-0">
                  <a
                    href={ad.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 px-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 hover:text-white text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95"
                    title={`Abrir sitio web oficial: ${ad.linkUrl}`}
                  >
                    <span>Web</span>
                    <ExternalLink className="w-2.5 h-2.5 text-cyan-300" />
                  </a>

                  {ad.whatsappUrl && (
                    <a
                      href={ad.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 hover:text-emerald-200 text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95"
                      title="Contactar o pedir por WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3 fill-emerald-400/30 text-emerald-400" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Actions: Anunciar Acá & Botón Cruz "X" para cerrar banner */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 bg-[#0a0d14] pl-2 border-l border-slate-800/80">
          <button
            type="button"
            onClick={onOpenContactModal}
            className="hidden lg:flex px-2 py-1 rounded-lg text-[10.5px] font-semibold text-slate-400 hover:text-amber-300 hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Pedir incluir mi negocio en el banner"
          >
            Anunciar
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar banner publicitario (podrás habilitarlo nuevamente en cualquier momento)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
