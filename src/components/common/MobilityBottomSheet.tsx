import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { LINEA_228_STOPS, Linea228Stop } from '../../data/linea228Stops';
import { RankingPrestadoresDropdown } from '../taxi/RankingPrestadoresDropdown';

interface MobilityBottomSheetProps {
  userName?: string;
  onOpenPedirTransporte: () => void;
  onOpenTaxis: () => void;
  onOpenChat: () => void;
  onSelectStop?: (stop: Linea228Stop) => void;
  unreadChatCount?: number;
}

export const MobilityBottomSheet: React.FC<MobilityBottomSheetProps> = ({
  userName = 'Pasajero',
  onOpenPedirTransporte,
  onOpenTaxis,
  onOpenChat,
  onSelectStop,
  unreadChatCount = 0,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

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
          onClick={() => setIsMinimized(false)}
          className="px-4 py-2.5 rounded-2xl bg-[#0b0f1b]/95 hover:bg-[#12182a] border border-cyan-400/50 text-white shadow-2xl backdrop-blur-2xl flex items-center gap-2.5 text-xs font-black transition-all cursor-pointer active:scale-95 group ring-2 ring-cyan-400/25"
          title="Ver panel '¿Qué querés hacer?' y opciones de transporte"
        >
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30 group-hover:scale-110 transition-transform">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          <span>¿Qué querés hacer?</span>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            Mostrar Panel
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 pointer-events-auto">
      <div className="bg-[#0b0f1b]/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* Pull handle / Expand indicator */}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full pt-2.5 pb-1 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity group"
          title={isExpanded ? 'Contraer panel' : 'Expandir panel hacia arriba'}
        >
          <div className="w-12 h-1.5 bg-slate-600/70 group-hover:bg-slate-400 rounded-full transition-colors" />
        </button>

        {/* Header Greeting inspirado en Cabify con Botón de Minimizar */}
        <div className="px-3.5 sm:px-5 pt-1 pb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-400">
              ¡Hola, {userName || 'Pasajero'}!
            </p>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              <span>¿Qué querés hacer?</span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 px-2.5 py-1.5 rounded-xl border border-sky-400/20 transition-all cursor-pointer"
              title={isExpanded ? 'Contraer paradas' : 'Ver 62 Paradas'}
            >
              <span>{isExpanded ? 'Contraer' : '62 Paradas'}</span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {/* BOTÓN PARA MINIMIZAR Y VER EL MAPA COMPLETO */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 px-2.5 py-1.5 rounded-xl border border-white/20 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Minimizar panel para ver el mapa completo"
            >
              <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Minimizar</span>
            </button>
          </div>
        </div>

        {/* 3 Action Cards Inspiradas en la captura de Cabify:
            1. "Pedir Transporte Alternativo"
            2. "Taxi & Motos" con 3 puntitos para "Ranking de Prestadores"
            3. "Chat Comunitario"
        */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
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
                  Pedir Transporte Alternativo
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
                  Prestadores · 3 puntos
                </span>
              </button>
            </div>

            {/* Card 3: Chat Comunitario */}
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

        {/* Corredor Card: "B° Malvinas ↔ Zárate Terminal" 62 paradas
            y Telemetría: "Linea 228(Malvinas-Zarate) +18m 42 km/h · ETA 1m" */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="p-3 rounded-2xl bg-[#121829] border border-cyan-500/30 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30">
                  <Bus className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>Linea 228(Malvinas-Zarate)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    B° Malvinas ↔ Zárate Terminal · <strong className="text-cyan-300">62 paradas</strong>
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
                onClick={() => setIsExpanded((prev) => !prev)}
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>{isExpanded ? 'Ocultar listado' : 'Explorar las 62 paradas'}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Upward scrolling list of 62 stops (scrolling web hacia arriba) */}
        {isExpanded && (
          <div className="px-3.5 sm:px-5 pb-3 border-t border-white/10 pt-3 animate-in slide-in-from-bottom-2 duration-200">
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
          </div>
        )}
      </div>
    </div>
  );
};
