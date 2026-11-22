import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AdListing } from '../../types';
import { playMicroSound } from '../../utils/soundEffects';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Hand,
  Images,
} from 'lucide-react';

interface AdFlyerCarouselModalProps {
  ads: AdListing[];
  initialAdId: string | null;
  onClose: () => void;
}

const isSafeExternalUrl = (raw?: string): string => {
  if (!raw || typeof raw !== 'string') return '#';
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '#';
};

export const AdFlyerCarouselModal: React.FC<AdFlyerCarouselModalProps> = ({
  ads,
  initialAdId,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (!initialAdId) return 0;
    const idx = ads.findIndex((a) => a.id === initialAdId);
    return idx >= 0 ? idx : 0;
  });
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const lastInitialAdIdRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Refs para arrastre/swipe sin cierres obsoletos (stale closures) incluso en flicks rápidos
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const latestDxRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const isHorizontalLockRef = useRef<boolean | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Solo sincronizar activeIndex cuando realmente se abre o cambia initialAdId (nunca por re-renders de ads)
  useEffect(() => {
    if (!initialAdId) {
      lastInitialAdIdRef.current = null;
      return;
    }
    if (lastInitialAdIdRef.current !== initialAdId) {
      lastInitialAdIdRef.current = initialAdId;
      const idx = ads.findIndex((a) => a.id === initialAdId);
      setActiveIndex(idx >= 0 ? idx : 0);
      setDragOffsetX(0);
      latestDxRef.current = 0;
    }
  }, [initialAdId, ads]);

  const total = ads.length;

  useEffect(() => {
    if (total > 0 && activeIndex >= total) {
      setActiveIndex(0);
    }
  }, [total, activeIndex]);

  const goToIndex = useCallback(
    (index: number) => {
      if (total === 0) return;
      const normalized = ((index % total) + total) % total;
      playMicroSound('ui_tap');
      setActiveIndex(normalized);
      setDragOffsetX(0);
      latestDxRef.current = 0;
    },
    [total]
  );

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    playMicroSound('ui_tap');
    setActiveIndex((prev) => (prev - 1 + total) % total);
    setDragOffsetX(0);
    latestDxRef.current = 0;
  }, [total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    playMicroSound('ui_tap');
    setActiveIndex((prev) => (prev + 1) % total);
    setDragOffsetX(0);
    latestDxRef.current = 0;
  }, [total]);

  useEffect(() => {
    if (!initialAdId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialAdId, onClose, goPrev, goNext]);

  if (!initialAdId || total === 0) return null;

  const safeIndex = activeIndex >= 0 && activeIndex < total ? activeIndex : 0;
  const currentAd = ads[safeIndex] || ads[0];
  const safeWebUrl = isSafeExternalUrl(currentAd.linkUrl);
  const safeWaUrl = isSafeExternalUrl(currentAd.whatsappUrl);

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    return target instanceof Element && Boolean(target.closest('button, a'));
  };

  const beginSwipe = (clientX: number, clientY: number) => {
    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    latestDxRef.current = 0;
    dragStartTimeRef.current = Date.now();
    isHorizontalLockRef.current = null;
    setIsDragging(true);
  };

  const moveSwipe = (clientX: number, clientY: number) => {
    if (dragStartXRef.current === null || dragStartYRef.current === null) return;
    const dx = clientX - dragStartXRef.current;
    const dy = clientY - dragStartYRef.current;

    if (isHorizontalLockRef.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHorizontalLockRef.current = Math.abs(dx) >= Math.abs(dy) * 0.8;
    }

    if (isHorizontalLockRef.current) {
      latestDxRef.current = dx;
      setDragOffsetX(dx);
    }
  };

  const finishSwipe = () => {
    if (dragStartXRef.current !== null && isHorizontalLockRef.current) {
      const dx = latestDxRef.current;
      const elapsed = Date.now() - dragStartTimeRef.current;
      const isQuickFlick = Math.abs(dx) >= 18 && elapsed < 300;
      const isDistanceSwipe = Math.abs(dx) >= 36;

      if (isDistanceSwipe || isQuickFlick) {
        if (dx < 0) {
          goNext();
        } else if (dx > 0) {
          goPrev();
        }
      }
    }

    dragStartXRef.current = null;
    dragStartYRef.current = null;
    latestDxRef.current = 0;
    isHorizontalLockRef.current = null;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setDragOffsetX(0);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/94 backdrop-blur-md flex flex-col justify-between select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Flyer de ${currentAd.businessName}`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#101114]/95 border-b border-white/15 shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF19A] text-[#101114] font-mono font-black text-[11px] shrink-0">
            {safeIndex + 1} / {total}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-white truncate leading-tight">
              {currentAd.businessName}
            </h3>
            <p className="text-[10.5px] text-[#9299A5] truncate leading-tight">
              {currentAd.category} · {currentAd.zone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {total > 1 && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10.5px] text-[#9299A5] font-semibold">
              <Hand className="w-3.5 h-3.5 text-[#FFF19A]" />
              Deslizá el flyer para ver todos los locales
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              onClose();
            }}
            className="w-10 h-10 rounded-xl bg-[#202329] hover:bg-white/15 border border-white/25 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="Cerrar visor de flyers"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Touch / Pointer Swipe Carousel Stage */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden touch-none cursor-grab active:cursor-grabbing"
        onTouchStart={(e) => {
          if (isInteractiveTarget(e.target)) return;
          if (e.touches.length === 1) {
            beginSwipe(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (dragStartXRef.current === null) return;
          if (e.touches.length === 1) {
            moveSwipe(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={() => finishSwipe()}
        onTouchCancel={() => finishSwipe()}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return; // touch manejado arriba para máxima fluidez móvil
          if (e.button !== 0 || isInteractiveTarget(e.target)) return;
          activePointerIdRef.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          beginSwipe(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch') return;
          if (activePointerIdRef.current !== e.pointerId) return;
          moveSwipe(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return;
          if (activePointerIdRef.current !== e.pointerId) return;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
          finishSwipe();
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === 'touch') return;
          if (activePointerIdRef.current !== e.pointerId) return;
          finishSwipe();
        }}
      >
        {/* Carousel Track */}
        <div
          className={`flex h-full w-full ${
            isDragging ? '' : 'transition-transform duration-300 ease-out'
          }`}
          style={{
            transform: `translate3d(calc(-${safeIndex * 100}% + ${dragOffsetX}px), 0, 0)`,
          }}
        >
          {ads.map((adItem) => {
            const flyerSrc = adItem.flyerUrl || adItem.imageUrl || '';
            return (
              <div
                key={adItem.id}
                className="w-full h-full shrink-0 flex items-center justify-center p-2 sm:p-4"
              >
                <img
                  src={flyerSrc}
                  alt={`Flyer ${adItem.businessName}`}
                  draggable={false}
                  className="max-h-full max-w-full w-auto h-auto object-contain rounded-2xl border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.85)] bg-[#101114] pointer-events-none"
                />
              </div>
            );
          })}
        </div>

        {/* Prev / Next Floating Controls */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#101114]/90 hover:bg-[#101114] border-2 border-white/30 hover:border-[#FFF19A] text-white flex items-center justify-center shadow-2xl cursor-pointer active:scale-95 transition-all z-30"
              title="Ver flyer anterior"
              aria-label="Ver flyer anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#101114]/90 hover:bg-[#101114] border-2 border-white/30 hover:border-[#FFF19A] text-white flex items-center justify-center shadow-2xl cursor-pointer active:scale-95 transition-all z-30"
              title="Ver siguiente flyer"
              aria-label="Ver siguiente flyer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Footer: Botones claros "Ver flyer" por local + Web & WhatsApp del local activo */}
      <div className="px-3 sm:px-5 py-2.5 bg-[#101114]/98 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 z-30">
        <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start w-full sm:w-auto">
          {ads.map((adItem, index) => {
            const isActive = index === safeIndex;
            return (
              <button
                key={adItem.id}
                type="button"
                onClick={() => goToIndex(index)}
                className={`min-h-[40px] flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A] shadow-[0_0_14px_rgba(255,241,154,0.4)]'
                    : 'bg-[#202329] text-white border-white/20 hover:border-[#FFF19A]/70 hover:bg-[#2a2e36]'
                }`}
                title={`Ver flyer de ${adItem.businessName}`}
              >
                <img
                  src={adItem.flyerUrl || adItem.imageUrl}
                  alt={adItem.businessName}
                  className="w-6 h-6 rounded object-cover object-top border border-black/25 shrink-0"
                />
                <div className="leading-tight">
                  <span className="block text-[11px] font-black truncate max-w-[115px]">
                    {adItem.businessName}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-[9.5px] font-bold ${
                      isActive ? 'text-[#101114]/80' : 'text-[#FFF19A]'
                    }`}
                  >
                    <Images className="w-2.5 h-2.5" />
                    <span>{isActive ? 'Viendo flyer' : 'Ver flyer'}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Direct Web & WhatsApp actions for current flyer */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end shrink-0">
          <span className="sm:hidden text-[10px] text-[#9299A5] font-semibold mr-auto flex items-center gap-1">
            <Hand className="w-3 h-3 text-[#FFF19A]" />
            Deslizá ↔
          </span>
          {safeWebUrl !== '#' && (
            <a
              href={safeWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playMicroSound('ad_spark')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#202329] hover:bg-white/10 border border-white/25 hover:border-[#FFF19A] text-white text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <span>Visitar Web</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#FFF19A]" />
            </a>
          )}

          {safeWaUrl !== '#' && (
            <a
              href={safeWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playMicroSound('ad_spark')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#B7F36B] hover:bg-[#c5f784] text-[#101114] text-xs font-black flex items-center gap-1.5 shadow-[0_0_12px_rgba(183,243,107,0.3)] transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
