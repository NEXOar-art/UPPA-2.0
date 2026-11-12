import React, { useState, useEffect, useRef } from 'react';
import { CalificacionChoferFirestore } from '../../types';
import {
  subscribeToRankingChoferes,
  getCalificacionInfo,
} from '../../services/realtimeFirebaseService';
import {
  Trophy,
  Star,
  X,
  MoreVertical,
  Award,
} from 'lucide-react';

interface RankingPrestadoresDropdownProps {
  isOpen?: boolean;
  onClose?: () => void;
  triggerButtonClassName?: string;
  renderTriggerOnly?: boolean;
  onOpenTaxiTab?: () => void;
  placement?: 'top' | 'bottom';
}

export const RankingPrestadoresDropdown: React.FC<RankingPrestadoresDropdownProps> = ({
  isOpen: controlledIsOpen,
  onClose,
  triggerButtonClassName,
  onOpenTaxiTab,
  placement = 'top',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    const unsub = subscribeToRankingChoferes((list) => {
      setRankingList(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (onClose) onClose();
        else setInternalIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (controlledIsOpen !== undefined && onClose) {
      if (controlledIsOpen) onClose();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className={
          triggerButtonClassName ||
          'p-2 rounded-xl text-[#FFF19A] hover:text-[#101114] hover:bg-[#FFF19A] border border-white/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center'
        }
        title="Ver Ranking de Prestadores (calificaciones reales de las últimas 3 horas)"
        aria-label="Abrir Ranking de Prestadores"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 w-80 sm:w-96 max-h-[70vh] rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/45 shadow-[0_8px_0_rgba(0,0,0,0.65)] p-4 z-50 flex flex-col text-white animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#101114] text-[#FFF19A] border border-[#FFF19A]/50 flex items-center justify-center text-base">
                <Trophy className="w-4 h-4 text-[#FFF19A]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-extrabold text-white tracking-wide font-display">
                    Ranking de Prestadores
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-[#FFF19A] text-[#101114]">
                    {rankingList.length}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#9299A5] font-mono">
                  Calificaciones en vivo (últimas 3 hs)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else setInternalIsOpen(false);
              }}
              className="w-9 h-9 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ranking de prestadores"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-2.5 space-y-1.5 overflow-y-auto max-h-[48vh] pr-1">
            {rankingList.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#101114] border border-white/10 flex items-center justify-center mx-auto text-[#9299A5]">
                  <Award className="w-5 h-5" />
                </div>
                <p className="text-xs text-[#9299A5]">
                  Sin calificaciones registradas en la ventana de 3 horas.
                </p>
                <p className="text-[10px] text-[#9299A5] max-w-xs mx-auto">
                  Los pasajeros pueden calificar a los prestadores luego de cada viaje de 1 a 5 estrellas.
                </p>
              </div>
            ) : (
              rankingList.slice(0, 20).map((item, idx) => {
                const info = getCalificacionInfo(item.puntuacion);
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-2xl bg-[#101114] hover:border-[#FFF19A]/45 border border-white/10 flex items-center justify-between gap-2.5 text-xs transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl font-mono font-black text-[10.5px] flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-[#FFF19A] text-[#101114]'
                            : idx === 1
                            ? 'bg-white text-[#101114]'
                            : idx === 2
                            ? 'bg-[#9299A5] text-[#101114]'
                            : 'bg-[#202329] text-[#9299A5] border border-white/10'
                        }`}
                      >
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white truncate text-xs">
                            {item.driverName}
                          </span>
                        </div>
                        {item.comentario && (
                          <p className="text-[10px] text-[#9299A5] italic truncate max-w-[170px] sm:max-w-xs">
                            "{item.comentario}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <span
                        className="px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider border border-[#FFF19A]/40 bg-[#202329] text-[#FFF19A] flex items-center gap-1"
                      >
                        <Star className="w-3 h-3 fill-[#FFF19A]" />
                        <span>{item.puntuacion} · {info.label}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#9299A5]">
            <span className="font-mono text-[10px]">
              ⭐ 5: Muy Bueno · 4: Bueno · 1: Malo
            </span>
            {onOpenTaxiTab && (
              <button
                type="button"
                onClick={() => {
                  onOpenTaxiTab();
                  if (onClose) onClose();
                  else setInternalIsOpen(false);
                }}
                className="font-bold text-[#FFF19A] hover:underline transition-colors cursor-pointer"
                title="Ir a la sección completa de Taxis & Motos"
              >
                Ver Taxis & Motos ➔
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
