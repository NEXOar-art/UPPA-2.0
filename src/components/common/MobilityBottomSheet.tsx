import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Bus,
  Bike,
  Car,
  MessageSquare,
  Zap,
  Navigation,
  Clock,
  Gauge,
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  ExternalLink,
  Sparkles,
  Activity,
  Layers,
  Minimize2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LINEA_228_STOPS, Linea228Stop } from '../../data/linea228Stops';
import { RankingPrestadoresDropdown } from '../taxi/RankingPrestadoresDropdown';
import { LottieMicroIcon } from './LottieMicroIcon';
import { playMicroSound } from '../../utils/soundEffects';

interface MobilityBottomSheetProps {
  userName?: string;
  onOpenPedirTransporte: () => void;
  onOpenTaxis: () => void;
  onOpenPrestarServicio?: () => void;
  onOpenChat: () => void;
  onSelectStop?: (stop: Linea228Stop) => void;
  unreadChatCount?: number;
}

export const MobilityBottomSheet: React.FC<MobilityBottomSheetProps> = ({
  userName = 'Pasajero',
  onOpenPedirTransporte,
  onOpenTaxis,
  onOpenPrestarServicio,
  onOpenChat,
  onSelectStop,
  unreadChatCount = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isMapFreeMode, setIsMapFreeMode] = useState(false);

  useEffect(() => {
    const handleVisibility = (e: Event) => {
      const custom = e as CustomEvent<{ visible: boolean }>;
      setIsMapFreeMode(!custom.detail?.visible);
    };
    window.addEventListener('uppa-map-cards-visibility', handleVisibility);
    return () => window.removeEventListener('uppa-map-cards-visibility', handleVisibility);
  }, []);

  // Arrastre táctil / mouse para ocultar el panel hacia abajo
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const hasDraggedRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    hasDraggedRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    if (Math.abs(deltaY) > 6) {
      hasDraggedRef.current = true;
    }
    // Solo permitimos desplazamiento visual hacia abajo (de 0 a 140px)
    if (deltaY > 0) {
      setDragOffsetY(Math.min(deltaY, 140));
    } else {
      setDragOffsetY(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const didDrag = hasDraggedRef.current;

    dragStartYRef.current = null;
    setDragOffsetY(0);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Función 2: Si tocó y arrastró hacia abajo (más de 30px) -> oculta / minimiza el panel
    if (didDrag && deltaY > 30) {
      setIsExpanded(false);
      setIsMinimized(true);
      return;
    }

    // Si arrastró hacia arriba (más de 30px) -> expande el panel
    if (didDrag && deltaY < -30) {
      setIsExpanded(true);
      return;
    }

    // Función 1: Si tocó / hizo clic sin arrastrar hacia abajo -> expande / contrae el panel
    if (!didDrag || Math.abs(deltaY) < 15) {
      setIsExpanded((prev) => !prev);
    }
  };

  const handlePointerCancel = () => {
    dragStartYRef.current = null;
    hasDraggedRef.current = false;
    setDragOffsetY(0);
  };

  // Filter stops by query and zone
  const filteredStops = useMemo(() => {
    return LINEA_228_STOPS.filter((stop) => {
      const matchesSearch =
        stop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stop.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(stop.sequence).includes(searchQuery);

      const matchesZone = selectedZone === 'all' || stop.zone === selectedZone;
      return matchesSearch && matchesZone;
    });
  }, [searchQuery, selectedZone]);

  const zones = useMemo(() => {
    const list: string[] = [];
    LINEA_228_STOPS.forEach((s) => {
      if (!list.includes(s.zone)) list.push(s.zone);
    });
    return list;
  }, []);

  if (isMinimized) {
    return (
      <div className="w-full max-w-sm mx-auto px-4 pointer-events-auto flex items-center justify-center gap-2 pb-1 uppa-card-enter">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 24 }}
          onClick={() => {
            playMicroSound('ui_tap');
            setIsMinimized(false);
            setDragOffsetY(0);
          }}
          className="relative w-11 h-11 rounded-2xl uppa-glass-ios hover:border-[#FFF19A] hover:shadow-[0_0_12px_rgba(255,241,154,0.45)] border-[#FFF19A]/60 text-white flex items-center justify-center cursor-pointer group transition-colors"
          title="Opciones de transporte"
          aria-label="Opciones de transporte"
        >
          <div className="flex items-center -space-x-1">
            <Bus className="w-4 h-4 text-[#FFF19A]" />
            <Car className="w-4 h-4 text-[#B7F36B]" />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FFF19A] text-[#101114] border border-[#101114] flex items-center justify-center shadow">
            <ChevronUp className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        </motion.button>

        {isMapFreeMode && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              playMicroSound('ui_tap');
              window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
            }}
            className="relative w-7 h-7 rounded-full uppa-glass-ios border border-white/25 hover:border-[#FFF19A] hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-[#FFF19A] flex items-center justify-center cursor-pointer transition-colors uppa-card-enter"
            title="Modo Mapa Libre · Tocar para ver controles"
            aria-label="Modo Mapa Libre · Tocar para ver controles"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#B7F36B] border border-[#101114] animate-pulse" />
          </motion.button>
        )}

        <RankingPrestadoresDropdown
          placement="top"
          onOpenTaxiTab={onOpenTaxis}
          triggerButtonClassName="w-8 h-8 rounded-full uppa-glass-ios border border-white/25 hover:border-[#FFF19A] hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-[#FFF19A] flex items-center justify-center cursor-pointer transition-colors"
        />
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-2xl mx-auto px-2 sm:px-4 pointer-events-auto transition-transform"
      style={{
        transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
        transition: dragOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
    >
      <div className="uppa-glass-ios rounded-t-3xl sm:rounded-3xl overflow-visible transition-all duration-300">
        {/* Barra superior de agarre */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
          className="w-full pt-2.5 pb-1 rounded-t-3xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/[0.03] transition-colors select-none group"
          title={
            isExpanded
              ? 'Tocar para contraer · Arrastrar hacia abajo para ocultar el panel'
              : 'Tocar para expandir panel hacia arriba · Arrastrar hacia abajo para ocultar'
          }
        >
          <div className="w-14 h-1.5 bg-[#9299A5]/60 group-hover:bg-[#FFF19A] rounded-full transition-all group-active:w-20" />
          <div className="flex items-center gap-1.5 mt-1 text-[9.5px] font-bold text-[#9299A5] group-hover:text-[#FFF19A] transition-colors">
            <ChevronUp className="w-3 h-3 text-[#FFF19A]" />
            <span>{isExpanded ? 'Tocar para contraer' : 'Tocar para expandir'}</span>
            <span>·</span>
            <span>Arrastrar hacia abajo para ocultar</span>
            <ChevronDown className="w-3 h-3 text-[#9299A5]" />
          </div>
        </div>

        {/* Header */}
        <div className="px-3.5 sm:px-5 pt-1 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] shrink-0" />
            <p className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
              ¡Hola, {userName || 'Pasajero'}!
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isMapFreeMode && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation();
                  playMicroSound('ui_tap');
                  window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
                }}
                className="relative w-7 h-7 rounded-full uppa-glass-ios border border-white/25 hover:border-[#FFF19A] hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-[#FFF19A] flex items-center justify-center cursor-pointer transition-colors"
                title="Modo Mapa Libre · Tocar para ver controles"
                aria-label="Modo Mapa Libre · Tocar para ver controles"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#B7F36B] border border-[#101114] animate-pulse" />
              </motion.button>
            )}

            <RankingPrestadoresDropdown
              placement="top"
              onOpenTaxiTab={onOpenTaxis}
              triggerButtonClassName="w-8 h-8 rounded-full uppa-glass-ios border border-white/25 hover:border-[#FFF19A] hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-[#FFF19A] flex items-center justify-center transition-all cursor-pointer"
            />

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playMicroSound('ui_tap');
                setIsExpanded((prev) => !prev);
              }}
              className={`min-h-[38px] flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-xl border-2 transition-colors cursor-pointer ${
                isExpanded
                  ? 'text-[#101114] bg-[#FFF19A] border-[#FFF19A]'
                  : 'text-white hover:border-[#FFF19A] bg-[#101114] border-white/15'
              }`}
              title={isExpanded ? 'Ocultar listado de paradas' : 'Ver 62 Paradas de Línea 228'}
            >
              <span>{isExpanded ? 'Ocultar listado' : '62 Paradas'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                playMicroSound('ui_tap');
                setIsExpanded(false);
                setIsMinimized(true);
              }}
              className="w-9 h-9 rounded-xl bg-[#101114] hover:border-rose-400 text-[#9299A5] hover:text-rose-300 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              title="Minimizar panel de opciones (x)"
              aria-label="Minimizar panel"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </motion.button>
          </div>
        </div>

        {/* 4 Action Cards */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Card 1: Pedir Transporte Alternativo */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.015 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenPedirTransporte();
              }}
              title="Emitir una solicitud rápida de Moto Taxi o Auto Taxi"
              className="min-h-[76px] p-2.5 rounded-2xl bg-[#101114] hover:border-[#FFF19A] border-2 border-[#FFF19A]/40 text-left transition-colors group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF19A] text-[#101114] flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-[#101114]" />
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/40 flex items-center gap-1">
                  <LottieMicroIcon variant="spark" size={12} />
                  <span>Rápido</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-white block leading-tight group-hover:text-[#FFF19A]">
                  Pedir Transporte
                </span>
                <span className="text-[9.5px] text-[#9299A5] block mt-0.5 truncate">
                  Moto & Auto Taxi
                </span>
              </div>
            </motion.button>

            {/* Card 2: Taxi & Motos */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.015 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenTaxis();
              }}
              title="Ver prestadores habilitados en Taxis & Motos"
              className="min-h-[76px] p-2.5 rounded-2xl bg-[#101114] hover:border-[#B7F36B] border-2 border-[#B7F36B]/40 text-left transition-colors group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center">
                  <div className="flex items-center -space-x-1">
                    <Bike className="w-3.5 h-3.5" />
                    <Car className="w-3.5 h-3.5" />
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/40">
                  En vivo
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-white block leading-tight group-hover:text-[#B7F36B]">
                  Taxi & Motos
                </span>
                <span className="text-[9.5px] text-[#9299A5] block mt-0.5 truncate">
                  Prestadores en vivo
                </span>
              </div>
            </motion.button>

            {/* Card 3: Prestar Servicio */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.015 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                if (onOpenPrestarServicio) {
                  onOpenPrestarServicio();
                } else {
                  onOpenTaxis();
                }
              }}
              title="Habilitar mi Auto o Moto para prestar servicio de traslado"
              className="min-h-[76px] p-2.5 rounded-2xl bg-[#101114] hover:border-white/50 border-2 border-white/15 text-left transition-colors group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#202329] text-[#FFF19A] border border-white/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#202329] text-white border border-white/15">
                  Choferes
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-white block leading-tight group-hover:text-[#FFF19A]">
                  Prestar Servicio
                </span>
                <span className="text-[9.5px] text-[#9299A5] block mt-0.5 truncate">
                  Habilitá tu unidad
                </span>
              </div>
            </motion.button>

            {/* Card 4: Chat Comunitario */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.015 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenChat();
              }}
              title="Abrir Chat Comunitario de pasajeros y choferes"
              className="min-h-[76px] p-2.5 rounded-2xl bg-[#101114] hover:border-white/50 border-2 border-white/15 text-left transition-colors group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#202329] text-white border border-white/15 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                {unreadChatCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-[#FFF19A] text-[#101114]">
                    {unreadChatCount}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#202329] text-[#9299A5] border border-white/10">
                    Vecinos
                  </span>
                )}
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-white block leading-tight group-hover:text-[#FFF19A]">
                  Chat Comunitario
                </span>
                <span className="text-[9.5px] text-[#9299A5] block mt-0.5 truncate">
                  Alertas en directo
                </span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* Corredor Card Línea 228 */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#202329] text-[#FFF19A] flex items-center justify-center border border-white/15">
                  <Bus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>Línea 228</span>
                    <LottieMicroIcon variant="radar" size={16} />
                  </h3>
                  <p className="text-[10px] text-[#9299A5] font-medium">
                    Corredor en vivo · <strong className="text-white">62 paradas</strong>
                  </p>
                </div>
              </div>

              {/* Live telemetry badges */}
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#202329] text-[#FFF19A] border border-white/10 flex items-center gap-1" title="Demora estimada actual">
                  <Clock className="w-3 h-3" />
                  <span>+18m</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#202329] text-white border border-white/10 flex items-center gap-1" title="Velocidad promedio">
                  <Gauge className="w-3 h-3 text-[#FFF19A]" />
                  <span>42 km/h</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#B7F36B] text-[#101114] flex items-center gap-1" title="Próximo arribo">
                  <Activity className="w-3 h-3" />
                  <span>ETA 1m</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10.5px] gap-2">
              <span className="text-[#9299A5] flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-[#FFF19A] shrink-0" />
                <span className="truncate">Traza completa por RP 6 y Colectora</span>
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 border ${
                  isExpanded
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A]'
                    : 'bg-[#202329] hover:border-[#FFF19A] text-white border-white/15'
                }`}
                title={isExpanded ? 'Ocultar listado de paradas' : 'Explorar las 62 paradas de Línea 228'}
              >
                <span>{isExpanded ? 'Ocultar listado' : 'Explorar 62 paradas'}</span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upward scrolling list of 62 stops */}
        <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22 }}
            className="px-3.5 sm:px-5 pb-3 border-t border-white/10 pt-3"
          >
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] shrink-0" />
                <span className="text-xs font-black text-white truncate">
                  62 Paradas de Línea 228
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#101114] text-[#FFF19A] border border-white/15">
                  {filteredStops.length}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FFF19A] text-[#101114] font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  title="Ocultar listado de paradas"
                >
                  <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Ocultar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsMinimized(true);
                  }}
                  className="w-9 h-9 rounded-xl bg-[#101114] hover:border-rose-400 text-[#9299A5] hover:text-rose-300 border border-white/15 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  title="Minimizar panel (x)"
                  aria-label="Minimizar panel"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Search and zone filters */}
            <div className="space-y-2 mb-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar entre las 62 paradas (ej: McDonald's, Plaza, Alem)..."
                  className="w-full min-h-[40px] bg-[#101114] border-2 border-white/10 focus:border-[#FFF19A] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#9299A5] focus:outline-none transition-colors"
                />
              </div>

              {/* Zone pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedZone('all')}
                  title="Mostrar todas las zonas de paradas"
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg font-black shrink-0 transition-all cursor-pointer border ${
                    selectedZone === 'all'
                      ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                      : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                  }`}
                >
                  Todas (62)
                </button>
                {zones.map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    title={`Filtrar paradas por zona ${zone}`}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer border ${
                      selectedZone === zone
                        ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                        : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable container with all 62 stops */}
            <div className="max-h-60 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredStops.map((stop) => (
                <div
                  key={stop.id}
                  className="p-2.5 rounded-xl bg-[#101114] hover:border-[#FFF19A]/50 border border-white/10 flex items-center justify-between gap-2 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-[#202329] border border-white/15 text-[#FFF19A] font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                      #{stop.sequence}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-[#FFF19A]">
                        {stop.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9.5px] text-[#9299A5] truncate">
                          {stop.zone}
                        </span>
                        {stop.sequence === 1 && (
                          <span className="text-[8.5px] font-black text-[#101114] bg-[#B7F36B] px-1.5 rounded">
                            CABECERA ORIGEN
                          </span>
                        )}
                        {stop.sequence === 62 && (
                          <span className="text-[8.5px] font-black text-rose-200 bg-rose-500/20 border border-rose-400/30 px-1.5 rounded">
                            TERMINAL DESTINO
                          </span>
                        )}
                        {stop.id === 'p228-mcdonalds' && (
                          <span className="text-[8.5px] font-black text-[#101114] bg-[#FFF19A] px-1.5 rounded">
                            PUNTO ESTRATÉGICO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {onSelectStop && (
                    <button
                      type="button"
                      onClick={() => onSelectStop(stop)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#202329] hover:bg-[#FFF19A] hover:text-[#101114] border border-white/15 text-white font-bold text-[10.5px] flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-all"
                      title={`Centrar parada ${stop.name} en el mapa`}
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Ver</span>
                    </button>
                  )}
                </div>
              ))}

              {filteredStops.length === 0 && (
                <div className="text-center py-6 text-[#9299A5] text-xs">
                  No se encontraron paradas con ese criterio.
                </div>
              )}
            </div>

            <div className="sticky bottom-0 -mx-1 px-2 pt-2.5 pb-1 bg-[#202329] border-t border-white/10 flex items-center justify-between gap-2 mt-2 rounded-b-2xl">
              <span className="text-[11px] text-[#9299A5] font-medium truncate">
                ¿Terminaste de consultar?
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl uppa-cta-yellow font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Ocultar listado de paradas"
                >
                  <ChevronUp className="w-4 h-4 stroke-[3]" />
                  <span>Ocultar listado</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsMinimized(true);
                  }}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-[#101114] hover:border-rose-400 text-white hover:text-rose-300 border border-white/15 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Minimizar panel (x)"
                  aria-label="Minimizar panel"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Cerrar (x)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};
