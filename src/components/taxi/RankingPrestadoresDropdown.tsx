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
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bike,
  Car,
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
  renderTriggerOnly = false,
  onOpenTaxiTab,
  placement = 'top',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Suscripción al ranking de choferes en tiempo real (últimas 3 hs)
  useEffect(() => {
    const unsub = subscribeToRankingChoferes((list) => {
      setRankingList(list);
    });
    return () => unsub();
  }, []);

  // Cerrar al hacer clic afuera
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
      {/* Botón de 3 puntitos para abrir el desplegable de Ranking de Prestadores */}
      <button
        type="button"
        onClick={toggleDropdown}
        className={
          triggerButtonClassName ||
          'p-1.5 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-400/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center'
        }
        title="Ranking de Prestadores (Calificaciones en vivo de las últimas 3 horas)"
        aria-label="Abrir Ranking de Prestadores"
      >
        <MoreVertical className="w-4 h-4 text-amber-400" />
      </button>

      {/* Menú Desplegable con animación y diseño vidriado */}
      {isOpen && (
        <div
          className={`absolute ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 w-80 sm:w-96 max-h-[70vh] rounded-3xl bg-[#090d18]/98 backdrop-blur-2xl border border-amber-500/35 shadow-2xl p-4 z-50 flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200`}
        >
          {/* Header con Copa y Contador */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center text-base shadow-sm">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-white tracking-wide">
                    Ranking de Prestadores
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {rankingList.length}
                  </span>
                </div>
                <p className="text-[10.5px] text-amber-300/80 font-mono">
                  Calificaciones comunitarias en vivo (últimas 3 hs)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else setInternalIsOpen(false);
              }}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Cerrar ranking"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista scrollable de los choferes rankeados */}
          <div className="py-2.5 space-y-1.5 overflow-y-auto max-h-[48vh] pr-1">
            {rankingList.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-500">
                  <Award className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-xs text-slate-400">
                  Sin calificaciones registradas en la ventana de 3 horas.
                </p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                  Los pasajeros pueden calificar a los prestadores luego de cada viaje de 1 a 5 estrellas.
                </p>
              </div>
            ) : (
              rankingList.slice(0, 20).map((item, idx) => {
                const info = getCalificacionInfo(item.puntuacion);
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-amber-400/30 flex items-center justify-between gap-2.5 text-xs transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Posición Medalla */}
                      <span
                        className={`w-6 h-6 rounded-xl font-mono font-black text-[10.5px] flex items-center justify-center shrink-0 shadow-sm ${
                          idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 ring-1 ring-amber-300'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950 font-bold'
                            : idx === 2
                            ? 'bg-amber-700 text-amber-100 font-bold'
                            : 'bg-white/5 text-slate-400 border border-white/5'
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
                          <p className="text-[10px] text-slate-400 italic truncate max-w-[170px] sm:max-w-xs">
                            "{item.comentario}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Badge de puntuación */}
                    <div className="shrink-0 flex items-center gap-1">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider border flex items-center gap-1 shadow-sm ${info.badgeClass}`}
                      >
                        <Star className="w-3 h-3 fill-current" />
                        <span>{item.puntuacion} · {info.label}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer del Desplegable */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
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
                className="font-bold text-amber-300 hover:text-white transition-colors cursor-pointer"
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
