import React, { useState, useMemo, useRef } from 'react';
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
  MoreVertical,
  Activity,
  Layers,
  Minimize2,
  Maximize2,
  X,
} from 'lucide-react';
import { LINEA_228_STOPS, Linea228Stop } from '../../data/linea228Stops';
import { RankingPrestadoresDropdown } from '../taxi/RankingPrestadoresDropdown';

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
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

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
      <div className="w-full max-w-sm mx-auto px-4 pointer-events-auto flex justify-center pb-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            setDragOffsetY(0);
          }}
          className="px-4 py-2.5 rounded-2xl bg-[#0b0f1b]/95 hover:bg-[#12182a] border border-cyan-400/50 text-white shadow-2xl backdrop-blur-2xl flex items-center gap-2.5 text-xs font-black transition-all cursor-pointer active:scale-95 group ring-2 ring-cyan-400/25"
          title="Abrir panel de opciones de transporte"
        >
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30 group-hover:scale-110 transition-transform">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          <span>Opciones de Transporte</span>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            Abrir
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
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
      <div className="bg-[#0b0f1b]/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* Barra superior con doble función: Tocar para expandir / Arrastrar hacia abajo para ocultar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
          className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/[0.04] transition-colors select-none group"
          title={
            isExpanded
              ? 'Tocar para contraer · Arrastrar hacia abajo para ocultar el panel'
              : 'Tocar para expandir panel hacia arriba · Arrastrar hacia abajo para ocultar'
          }
        >
          {/* Barra central de agarre */}
          <div className="w-14 h-1.5 bg-slate-600/80 group-hover:bg-cyan-400/80 rounded-full transition-all group-active:w-20 group-active:bg-cyan-400" />
          
          {/* Micro indicadores de función dual: Expandir / Arrastrar para Ocultar */}
          <div className="flex items-center gap-1.5 mt-1 text-[9.5px] font-bold text-slate-400 group-hover:text-cyan-300 transition-colors">
            <ChevronUp className="w-3 h-3 text-cyan-400" />
            <span>{isExpanded ? 'Tocar para contraer' : 'Tocar para expandir'}</span>
            <span className="text-slate-600">·</span>
            <span>Arrastrar hacia abajo para ocultar</span>
            <ChevronDown className="w-3 h-3 text-slate-400 animate-bounce" />
          </div>
        </div>

        {/* Header: sin el título "¿Qué querés hacer?" y con botón "x" para minimizar */}
        <div className="px-3.5 sm:px-5 pt-1 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
              ¡Hola, {userName || 'Pasajero'}!
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className={`flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 shadow-sm ${
                isExpanded
                  ? 'text-cyan-200 bg-cyan-500/20 border-cyan-400/60 ring-1 ring-cyan-400/40'
                  : 'text-sky-400 hover:text-sky-300 bg-sky-500/10 border-sky-400/20'
              }`}
              title={isExpanded ? 'Ocultar listado de paradas' : 'Ver 62 Paradas'}
            >
              <span>{isExpanded ? 'Ocultar listado' : '62 Paradas'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-cyan-300 stroke-[3]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* BOTÓN "X" PARA MINIMIZAR Y VER EL MAPA COMPLETO */}
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setIsMinimized(true);
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-white/15 hover:border-rose-400/50 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Minimizar panel (x)"
              aria-label="Minimizar panel"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 3 Action Cards Inspiradas en la captura de Cabify:
            1. "Pedir Transporte Alternativo"
            2. "Taxi & Motos" con 3 puntitos para "Ranking de Prestadores"
            3. "Chat Comunitario"
        */}
        {/* 4 Action Cards Inspiradas en el panel de opciones de movilidad:
            1. "Pedir Transporte Alternativo"
            2. "Taxi & Motos" con 3 puntitos para "Ranking de Prestadores"
            3. "Prestar Servicio" (Habilitación de Chofer Auto & Moto)
            4. "Chat Comunitario"
        */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Card 1: Pedir Transporte Alternativo */}
            <button
              onClick={onOpenPedirTransporte}
              className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-b from-amber-500/15 to-orange-500/5 hover:from-amber-500/25 hover:to-orange-500/15 border border-amber-400/40 text-left transition-all group shadow-md shadow-amber-500/5 active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-400/30 group-hover:scale-105 transition-transform">
                  <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Rápido
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-amber-100 block leading-tight group-hover:text-amber-200">
                  Pedir Transporte
                </span>
                <span className="text-[9px] text-amber-300/80 block mt-0.5 truncate">
                  Moto & Auto Taxi
                </span>
              </div>
            </button>

            {/* Card 2: Taxi & Motos con 3 puntitos para Ranking de Prestadores */}
            <div className="relative p-2 sm:p-2.5 rounded-2xl bg-gradient-to-b from-emerald-500/15 to-teal-500/5 hover:from-emerald-500/25 hover:to-teal-500/15 border border-emerald-400/40 text-left transition-all group shadow-md shadow-emerald-500/5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={onOpenTaxis}
                  className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30 group-hover:scale-105 transition-transform cursor-pointer"
                  title="Abrir Taxis & Motos"
                >
                  <div className="flex items-center -space-x-1">
                    <Bike className="w-3.5 h-3.5 text-emerald-300" />
                    <Car className="w-3.5 h-3.5 text-teal-300" />
                  </div>
                </button>

                {/* 3 Puntitos para desplegar el Ranking de Prestadores */}
                <RankingPrestadoresDropdown
                  isOpen={isRankingDropdownOpen}
                  onClose={() => setIsRankingDropdownOpen(false)}
                  onOpenTaxiTab={onOpenTaxis}
                  placement="top"
                  triggerButtonClassName="w-6 h-6 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 flex items-center justify-center transition-all cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={onOpenTaxis}
                className="text-left w-full cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-black text-emerald-100 block leading-tight group-hover:text-emerald-200">
                    Taxi & Motos
                  </span>
                </div>
                <span className="text-[9px] text-emerald-300/80 block mt-0.5 truncate">
                  Prestadores en vivo
                </span>
              </button>
            </div>

            {/* Card 3: Prestar Servicio (Habilitación Chofer) */}
            <button
              onClick={() => {
                if (onOpenPrestarServicio) {
                  onOpenPrestarServicio();
                } else {
                  onOpenTaxis();
                }
              }}
              className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-b from-cyan-500/15 to-blue-500/5 hover:from-cyan-500/25 hover:to-blue-500/15 border border-cyan-400/40 text-left transition-all group shadow-md shadow-cyan-500/5 active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                </div>
                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  Choferes
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-cyan-100 block leading-tight group-hover:text-cyan-200">
                  Prestar Servicio
                </span>
                <span className="text-[9px] text-cyan-300/80 block mt-0.5 truncate">
                  Habilitá tu unidad
                </span>
              </div>
            </button>

            {/* Card 4: Chat Comunitario */}
            <button
              onClick={onOpenChat}
              className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-b from-purple-500/15 to-indigo-500/5 hover:from-purple-500/25 hover:to-indigo-500/15 border border-purple-400/40 text-left transition-all group shadow-md shadow-purple-500/5 active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-400/30 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4 text-purple-300" />
                </div>
                {unreadChatCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-500 text-white animate-pulse">
                    {unreadChatCount}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                    Vecinos
                  </span>
                )}
              </div>
              <div>
                <span className="text-[11px] sm:text-xs font-black text-purple-100 block leading-tight group-hover:text-purple-200">
                  Chat Comunitario
                </span>
                <span className="text-[9px] text-purple-300/80 block mt-0.5 truncate">
                  Alertas en directo
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Corredor Card Línea 228 con Telemetría en Vivo */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="p-3.5 rounded-2xl bg-[#0c1222]/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30">
                  <Bus className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>Línea 228</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    Corredor en vivo · <strong className="text-cyan-300">62 paradas</strong>
                  </p>
                </div>
              </div>

              {/* Live telemetry badges */}
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1" title="Demora estimada actual">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>+18m</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center gap-1" title="Velocidad promedio">
                  <Gauge className="w-3 h-3 text-sky-400" />
                  <span>42 km/h</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 flex items-center gap-1" title="Próximo arribo">
                  <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>· ETA 1m</span>
                </span>
              </div>
            </div>

            {/* Quick action bar inside telemetry */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10.5px]">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>Traza completa por RP 6 y Colectora</span>
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm ${
                  isExpanded
                    ? 'bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/60 shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-400/30'
                }`}
                title={isExpanded ? 'Ocultar listado de paradas' : 'Explorar las 62 paradas'}
              >
                <span>{isExpanded ? 'Ocultar listado' : 'Explorar las 62 paradas'}</span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-300 stroke-[3]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upward scrolling list of 62 stops (scrolling web hacia arriba) */}
        {isExpanded && (
          <div className="px-3.5 sm:px-5 pb-3 border-t border-white/10 pt-3 animate-in slide-in-from-bottom-2 duration-200">
            {/* Barra superior de listado con botón 'Ocultar listado' y 'Minimizar' */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="text-xs font-black text-white truncate">
                  62 Paradas de Línea 228
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  {filteredStops.length}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 hover:text-white border border-cyan-400/60 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer ring-1 ring-cyan-400/40"
                  title="Ocultar listado de paradas"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-300 stroke-[3]" />
                  <span>Ocultar listado</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsMinimized(true);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-white/15 hover:border-rose-400/50 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
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
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar entre las 62 paradas (ej: McDonald's, Plaza, Alem)..."
                  className="w-full bg-[#131826] border border-slate-700 focus:border-cyan-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Zone pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] scrollbar-none">
                <button
                  onClick={() => setSelectedZone('all')}
                  className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                    selectedZone === 'all'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Todas (62)
                </button>
                {zones.map((zone) => (
                  <button
                    key={zone}
                    onClick={() => setSelectedZone(zone)}
                    className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                      selectedZone === zone
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable container with all 62 stops */}
            <div className="max-h-60 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {filteredStops.map((stop) => (
                <div
                  key={stop.id}
                  className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-400/40 flex items-center justify-between gap-2 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                      #{stop.sequence}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-cyan-200">
                        {stop.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-slate-400 truncate">
                          {stop.zone}
                        </span>
                        {stop.sequence === 1 && (
                          <span className="text-[8.5px] font-black text-emerald-300 bg-emerald-500/20 px-1 rounded">
                            CABECERA ORIGEN
                          </span>
                        )}
                        {stop.sequence === 62 && (
                          <span className="text-[8.5px] font-black text-rose-300 bg-rose-500/20 px-1 rounded">
                            TERMINAL DESTINO
                          </span>
                        )}
                        {stop.id === 'p228-mcdonalds' && (
                          <span className="text-[8.5px] font-black text-amber-300 bg-amber-500/20 px-1 rounded">
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
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-300 font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-all"
                      title="Ver en el mapa"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Ver</span>
                    </button>
                  )}
                </div>
              ))}

              {filteredStops.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No se encontraron paradas con ese criterio.
                </div>
              )}
            </div>

            {/* Barra inferior fija para Ocultar Listado y Minimizar sin tener que volver a subir */}
            <div className="sticky bottom-0 -mx-1 px-2 pt-2.5 pb-1 bg-gradient-to-t from-[#0b0f1b] via-[#0b0f1b]/95 to-[#0b0f1b]/80 border-t border-white/10 backdrop-blur-md flex items-center justify-between gap-2 mt-2 rounded-b-2xl">
              <span className="text-[11px] text-slate-300 font-medium truncate">
                ¿Terminaste de consultar?
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/30 active:scale-95 transition-all cursor-pointer"
                  title="Ocultar listado de paradas"
                >
                  <ChevronUp className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>Ocultar listado</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsMinimized(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-200 border border-white/20 hover:border-rose-400/50 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                  title="Minimizar panel (x)"
                  aria-label="Minimizar panel"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Cerrar (x)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
