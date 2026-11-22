import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { motion } from 'motion/react';
import { AdListing } from '../../types';
import { AdBanner3DStage } from './AdBanner3DStage';
import { AdFlyerCarouselModal } from './AdFlyerCarouselModal';
import { LottieMicroIcon } from '../common/LottieMicroIcon';
import { playMicroSound } from '../../utils/soundEffects';
import {
  ExternalLink,
  MessageCircle,
  X,
  Megaphone,
  Sparkles,
  Maximize2,
  Images,
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
  const [isTrackHovered, setIsTrackHovered] = useState(false);
  const [selectedFlyerAdId, setSelectedFlyerAdId] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const marqueeTweenRef = useRef<gsap.core.Tween | null>(null);

  // Auto-achicar el botón de auspicio después de 5 segundos para despejar la pantalla
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCompact(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const activeAds = useMemo(() => ads.filter((a) => a.isActive), [ads]);

  // GSAP: Marquee continuo + destellos persuasivos + entrada coreografiada
  useEffect(() => {
    if (isDismissed || activeAds.length === 0 || !trackRef.current || !containerRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      marqueeTweenRef.current = gsap.to(trackRef.current, {
        xPercent: -50,
        duration: 28,
        ease: 'none',
        repeat: -1,
      });

      gsap.fromTo(
        '.uppa-ad-card',
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: 'power3.out',
          clearProps: 'transform',
        }
      );

      gsap.fromTo(
        '.uppa-ad-sheen',
        { xPercent: -140 },
        {
          xPercent: 240,
          duration: 1.45,
          stagger: { each: 0.85, repeat: -1, repeatDelay: 2.2 },
          ease: 'power2.inOut',
        }
      );
    }, containerRef);

    return () => {
      marqueeTweenRef.current = null;
      ctx.revert();
    };
  }, [isDismissed, activeAds.length]);

  // Suavizar pausa/reanudación GSAP cuando el usuario pasa el cursor o ve el carrusel de flyers
  useEffect(() => {
    if (!marqueeTweenRef.current) return;
    gsap.to(marqueeTweenRef.current, {
      timeScale: isTrackHovered || Boolean(selectedFlyerAdId) ? 0 : 1,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, [isTrackHovered, selectedFlyerAdId]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (selectedFlyerAdId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    setPointer({ x: nx, y: ny });
  };

  if (isDismissed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24 }}
        className="fixed bottom-3 left-3 sm:left-4 z-30 pointer-events-auto"
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            playMicroSound('ui_tap');
            setIsDismissed(false);
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`h-9 rounded-xl bg-[#202329] hover:bg-[#101114] text-[#FFF19A] border-2 border-[#FFF19A]/60 shadow-[3px_3px_0px_rgba(0,0,0,0.75)] text-xs font-black flex items-center cursor-pointer transition-all duration-300 group ${
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
          <LottieMicroIcon variant="spark" className="w-4 h-4" />
        </motion.button>
      </motion.div>
    );
  }

  if (activeAds.length === 0) return null;

  // Duplicado exacto x2 + x2 para recorrido GSAP -50% sin saltos
  const halfCycle = [...activeAds, ...activeAds];
  const marqueeItems = [...halfCycle, ...halfCycle];

  return (
    <>
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onMouseEnter={() => setIsTrackHovered(true)}
      onMouseLeave={() => {
        setIsTrackHovered(false);
        setPointer({ x: 0, y: 0 });
      }}
      onTouchStart={() => setIsTrackHovered(true)}
      onTouchEnd={() => setIsTrackHovered(false)}
      className="w-full bg-[#101114] border-t-2 border-[#FFF19A]/25 relative overflow-hidden z-20 transition-all select-none"
      title="Auspicios locales en vivo: pasá el cursor para pausar y hacé clic en la miniatura o 'Ver Flyer' para ver los flyers en carrusel"
    >
      {/* Fondo 3D interactivo (Three.js + React Three Fiber) detrás de las tarjetas */}
      <AdBanner3DStage
        isHovered={isTrackHovered}
        pointerX={pointer.x}
        pointerY={pointer.y}
      />

      {/* Línea superior luminosa sutil */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFF19A]/65 to-transparent z-10 pointer-events-none" />

      <div className="relative z-10 flex items-center h-12 sm:h-13 px-2 sm:px-3 gap-2">
        {/* Left Sticky Persuasive Auspicio Pill */}
        <div className="flex items-center shrink-0 z-10 bg-[#101114]/95 pr-2 border-r border-white/15">
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              playMicroSound('ad_spark');
              onOpenContactModal();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`h-8 rounded-xl bg-gradient-to-r from-[#FFF19A] via-[#fff5b8] to-[#B7F36B] text-[#101114] border border-[#FFF19A] shadow-[0_0_12px_rgba(255,241,154,0.3)] text-[10px] font-black uppercase tracking-tight flex items-center transition-all duration-300 ease-in-out cursor-pointer shrink-0 group ${
              isCompact && !isHovered ? 'w-8 px-0 justify-center' : 'px-2.5 gap-1'
            }`}
            title="Auspicio - Pedir incluir un negocio en el banner publicitario de UPPA"
          >
            <Megaphone className="w-3.5 h-3.5 text-[#101114] shrink-0" />
            <span
              className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isCompact && !isHovered ? 'max-w-0 opacity-0 -ml-1 pointer-events-none' : 'max-w-xs opacity-100 ml-0.5'
              }`}
            >
              Auspicio
            </span>
          </motion.button>
        </div>

        {/* Infinite GSAP Marquee Track */}
        <div className="flex-1 overflow-hidden relative">
          <div ref={trackRef} className="flex items-center gap-0 w-max will-change-transform">
            {marqueeItems.map((ad, idx) => {
              const safeWebUrl = isSafeExternalUrl(ad.linkUrl);
              const safeWaUrl = isSafeExternalUrl(ad.whatsappUrl);
              return (
                <motion.div
                  key={`${ad.id}-${idx}`}
                  whileHover={{ y: -1, scale: 1.015 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  onMouseEnter={() => playMicroSound('ad_spark')}
                  className="uppa-ad-card relative overflow-hidden flex items-center gap-2.5 px-3 py-1 rounded-none bg-[#202329]/92 hover:bg-[#272B33] hover:border-[#FFF19A]/75 border-y border-r border-white/15 first:border-l transition-colors shrink-0 group"
                >
                  {/* Haz luminoso persuasivo animado con GSAP */}
                  <span
                    aria-hidden="true"
                    className="uppa-ad-sheen pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent via-[#FFF19A]/20 to-transparent skew-x-[-20deg]"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playMicroSound('ad_spark');
                      setSelectedFlyerAdId(ad.id);
                    }}
                    className="relative w-9 h-9 rounded-none overflow-hidden shrink-0 border border-[#FFF19A]/55 hover:border-[#FFF19A] cursor-pointer transition-colors group/thumb touch-manipulation z-10"
                    title={`Ver flyer completo de ${ad.businessName} (carrusel deslizante)`}
                    aria-label={`Ver flyer completo de ${ad.businessName}`}
                  >
                    <img
                      src={ad.flyerUrl || ad.imageUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80'}
                      alt={`Flyer ${ad.businessName}`}
                      className="w-full h-full object-cover object-top group-hover/thumb:scale-110 transition-transform duration-300"
                    />
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#FFF19A] text-[#101114] flex items-center justify-center">
                      <Maximize2 className="w-2.5 h-2.5" />
                    </span>
                  </button>

                  <a
                    href={safeWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playMicroSound('ad_spark')}
                    className="flex items-center gap-2 min-w-0 relative z-10"
                    title={`Ingresar a ${ad.businessName}`}
                  >
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-white font-black text-xs group-hover:text-[#FFF19A] transition-colors truncate">
                          {ad.businessName}
                        </strong>
                        {ad.discountBadge && (
                          <span className="text-[9.5px] font-mono font-black text-[#101114] bg-gradient-to-r from-[#FFF19A] to-[#B7F36B] px-1.5 py-0.2 rounded-none shrink-0 flex items-center gap-1 shadow-[0_0_8px_rgba(255,241,154,0.35)]">
                            <LottieMicroIcon variant="spark" className="w-3.5 h-3.5" />
                            <span>{ad.discountBadge}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-[#9299A5] group-hover:text-white/90 transition-colors truncate max-w-[190px] sm:max-w-xs">
                        {ad.title}
                      </span>
                    </div>
                  </a>

                  <div className="flex items-center gap-1.5 ml-1 shrink-0 relative z-10">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        playMicroSound('ad_spark');
                        setSelectedFlyerAdId(ad.id);
                      }}
                      className="h-7 px-2 rounded-none bg-[#FFF19A] hover:brightness-95 border border-[#FFF19A] text-[#101114] text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer touch-manipulation"
                      title={`Ver flyer de ${ad.businessName}`}
                    >
                      <Images className="w-3 h-3" />
                      <span>Ver Flyer</span>
                    </motion.button>

                    <motion.a
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.94 }}
                      href={safeWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => playMicroSound('ad_spark')}
                      className="h-7 px-2.5 rounded-none bg-[#101114] hover:bg-white/10 border border-white/20 hover:border-[#FFF19A] text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                      title={`Web de ${ad.businessName}`}
                    >
                      <span>Web</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#FFF19A]" />
                    </motion.a>

                    {safeWaUrl !== '#' && (
                      <motion.a
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        href={safeWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => playMicroSound('ad_spark')}
                        className="h-7 px-2.5 rounded-none bg-[#B7F36B] hover:bg-[#c5f784] text-[#101114] text-[11px] font-black flex items-center gap-1 shadow-[0_0_10px_rgba(183,243,107,0.3)] transition-all"
                        title={`WhatsApp ${ad.businessName}`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </motion.a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 bg-[#101114]/95 pl-2 border-l border-white/15">
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              playMicroSound('ad_spark');
              onOpenContactModal();
            }}
            className="hidden lg:flex px-2.5 py-1.5 rounded-lg text-[10.5px] font-black text-[#FFF19A] hover:bg-[#202329] border border-transparent hover:border-[#FFF19A]/40 transition-colors cursor-pointer items-center gap-1"
            title="Anunciar mi negocio"
          >
            <Sparkles className="w-3 h-3" />
            <span>Anunciar</span>
          </motion.button>

          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              setIsDismissed(true);
            }}
            className="w-8 h-8 rounded-lg text-[#9299A5] hover:text-white hover:bg-[#202329] flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar banner"
            aria-label="Cerrar banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <AdFlyerCarouselModal
      ads={activeAds}
      initialAdId={selectedFlyerAdId}
      onClose={() => setSelectedFlyerAdId(null)}
    />
    </>
  );
};
