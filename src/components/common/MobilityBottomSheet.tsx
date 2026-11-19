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
  Activity,
  SlidersHorizontal,
  Users,
  TrendingUp,
  Sparkles,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LINEA_228_STOPS, Linea228Stop } from '../../data/linea228Stops';
import { LottieMicroIcon } from './LottieMicroIcon';
import { playMicroSound } from '../../utils/soundEffects';
import { MapEvent, MensajeChatFirestore } from '../../types';
import { calculateRealBusSpeed } from '../../utils/busSpeedEstimator';
import { getDistanceKm } from '../../utils/geolocation';
import {
  searchLinea228Stops,
  getPredictiveStopSuggestions,
  POPULAR_STREET_CHIPS,
} from '../../utils/stopSearchPredictor';

interface BusReportEventSummary {
  direction?: string;
  createdAtMs?: number;
  lat?: number;
  lng?: number;
  velocidadKmH?: number;
  streetAddress?: string;
}

interface MobilityBottomSheetProps {
  userName?: string;
  onOpenPedirTransporte: () => void;
  onOpenTaxis: () => void;
  onOpenPrestarServicio?: () => void;
  onOpenChat: () => void;
  onSelectStop?: (stop: Linea228Stop) => void;
  unreadChatCount?: number;
  busEvents?: BusReportEventSummary[];
  allEvents?: MapEvent[];
  recentChatMessages?: MensajeChatFirestore[];
  pendingRequestsCount?: number;
  userLocation?: { lat: number; lng: number } | null;
}

export const MobilityBottomSheet: React.FC<MobilityBottomSheetProps> = ({
  userName = 'Pasajero',
  onOpenPedirTransporte,
  onOpenTaxis,
  onOpenPrestarServicio,
  onOpenChat,
  onSelectStop,
  unreadChatCount = 0,
  busEvents = [],
  allEvents = [],
  recentChatMessages = [],
  pendingRequestsCount = 0,
  userLocation = null,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isMapFreeMode, setIsMapFreeMode] = useState(false);
  const [hoveredJoystickBtn, setHoveredJoystickBtn] = useState<'zarate' | 'malvinas' | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    const handleVisibility = (e: Event) => {
      const custom = e as CustomEvent<{ visible: boolean }>;
      const visible = Boolean(custom.detail?.visible);
      setIsMapFreeMode(!visible);
      if (!visible) {
        setHoveredJoystickBtn(null);
      }
    };
    window.addEventListener('uppa-map-cards-visibility', handleVisibility);
    return () => window.removeEventListener('uppa-map-cards-visibility', handleVisibility);
  }, []);

  useEffect(() => {
    if (!busEvents || busEvents.length === 0) return;
    setNowTs(Date.now());
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 2000);
    return () => clearInterval(timer);
  }, [busEvents]);

  const activeZarateCount = useMemo(
    () =>
      busEvents.filter(
        (e) => e.direction === 'hacia_zarate' && nowTs - (e.createdAtMs || 0) < 60000
      ).length,
    [busEvents, nowTs]
  );

  const activeMalvinasCount = useMemo(
    () =>
      busEvents.filter(
        (e) => e.direction === 'hacia_malvinas' && nowTs - (e.createdAtMs || 0) < 60000
      ).length,
    [busEvents, nowTs]
  );

  // IA Comunitaria en tiempo real: transforma reportes, GPS y chat en 5 KPIs amigables
  const corridorAiMetrics = useMemo(() => {
    const recentWindowMs = 35 * 60 * 1000;
    const recentEvents = allEvents.filter(
      (ev) => !ev.createdAtMs || nowTs - ev.createdAtMs <= recentWindowMs
    );
    const recentChat = recentChatMessages.slice(-20);

    // 1. Demora estimada actual
    let delayMinutes = 0;
    let incidentCount = 0;
    let positiveMovingCount = 0;

    recentEvents.forEach((ev) => {
      const weight = 1 + Math.min(ev.confirmations || 0, 5) * 0.18;
      if (ev.type === 'breakdown' || ev.type === 'accident' || ev.type === 'danger') {
        delayMinutes += Math.round(14 * weight);
        incidentCount++;
      } else if (ev.type === 'late' || ev.type === 'missed') {
        delayMinutes += Math.round(9 * weight);
        incidentCount++;
      } else if (ev.type === 'traffic' || ev.type === 'control') {
        delayMinutes += Math.round(6 * weight);
      } else if (ev.type === 'moving' || ev.type === 'bus_location') {
        positiveMovingCount++;
      }
    });

    const delayKeywords = ['tarde', 'demora', 'no pasó', 'no pasa', 'esperando', 'cortado', 'averiado', 'lento', 'trancado'];
    const smoothKeywords = ['pasó', 'llegó', 'rápido', 'libre', 'circula', 'normal', 'buen ritmo'];
    let chatDelayHits = 0;
    let chatSmoothHits = 0;
    let chatFullHits = 0;
    let chatEmptyHits = 0;

    const fullKeywords = ['lleno', 'hasta las manos', 'repleto', 'mucha gente', 'no para', 'parado', 'cargado'];
    const emptyKeywords = ['vacío', 'vacio', 'asientos', 'tranquilo', 'lugar', 'libre'];

    recentChat.forEach((msg) => {
      const txt = (msg.texto || '').toLowerCase();
      if (delayKeywords.some((k) => txt.includes(k))) chatDelayHits++;
      if (smoothKeywords.some((k) => txt.includes(k))) chatSmoothHits++;
      if (fullKeywords.some((k) => txt.includes(k))) chatFullHits++;
      if (emptyKeywords.some((k) => txt.includes(k))) chatEmptyHits++;
    });

    delayMinutes = Math.max(0, Math.min(45, delayMinutes + chatDelayHits * 4 - Math.min(positiveMovingCount + chatSmoothHits, 4) * 2));
    if (delayMinutes === 0 && incidentCount === 0 && chatDelayHits === 0) {
      delayMinutes = 0;
    }

    const delayLabel = delayMinutes === 0 ? 'Sin demora' : `+${delayMinutes}m`;
    const delayHover =
      delayMinutes === 0
        ? 'Demora estimada actual: Sin demoras registradas. La comunidad reporta circulación habitual en el corredor Línea 228.'
        : `Demora estimada actual: +${delayMinutes} min sobre el horario base. Calculado por IA a partir de ${incidentCount} alerta(s) viales y ${chatDelayHits} mención(es) en el chat comunitario.`;

    // 2. Velocidad promedio real
    const recentBusEvents = busEvents
      .filter((b) => !b.createdAtMs || nowTs - b.createdAtMs <= 25 * 60 * 1000)
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    const speedWithExplicitValues = recentBusEvents
      .map((b) => b.velocidadKmH)
      .filter((v): v is number => typeof v === 'number' && v >= 8 && v <= 90);

    let avgSpeedKmH: number;
    let speedMethodDesc: string;

    if (speedWithExplicitValues.length > 0) {
      avgSpeedKmH = Math.round(
        speedWithExplicitValues.reduce((acc, v) => acc + v, 0) / speedWithExplicitValues.length
      );
      speedMethodDesc = `promedio de ${speedWithExplicitValues.length} unidad(es) reportada(s) en vivo`;
    } else {
      const newestBus = recentBusEvents[0];
      const prevBus = recentBusEvents[1];
      const realCalc = calculateRealBusSpeed(
        newestBus?.lat,
        newestBus?.lng,
        prevBus && prevBus.lat && prevBus.lng
          ? { lat: prevBus.lat, lng: prevBus.lng, createdAtMs: prevBus.createdAtMs }
          : null
      );
      avgSpeedKmH = realCalc.speedKmH;
      speedMethodDesc = realCalc.description;
    }

    if (delayMinutes >= 20) {
      avgSpeedKmH = Math.max(16, Math.round(avgSpeedKmH * 0.72));
    } else if (delayMinutes >= 8) {
      avgSpeedKmH = Math.max(22, Math.round(avgSpeedKmH * 0.86));
    }

    const speedHover = `Velocidad promedio: ${avgSpeedKmH} km/h (${speedMethodDesc}). Ajustada en tiempo real según alertas de tránsito en Ruta 6 y Colectora.`;

    // 3. Próximo arribo (ETA)
    let etaMinutes = 8;
    let etaPrefix = 'ETA ~';
    let etaSourceNote = 'estimado por frecuencia habitual del corredor';

    const latestBusWithCoords = recentBusEvents.find(
      (b) => typeof b.lat === 'number' && typeof b.lng === 'number'
    );

    if (latestBusWithCoords && typeof latestBusWithCoords.lat === 'number' && typeof latestBusWithCoords.lng === 'number') {
      const refLat = userLocation?.lat ?? -34.185;
      const refLng = userLocation?.lng ?? -58.952;
      const distKm = getDistanceKm(refLat, refLng, latestBusWithCoords.lat, latestBusWithCoords.lng);
      const elapsedMins = latestBusWithCoords.createdAtMs
        ? Math.max(0, (nowTs - latestBusWithCoords.createdAtMs) / 60000)
        : 1;
      const travelMins = (distKm / Math.max(15, avgSpeedKmH)) * 60;
      const remaining = Math.max(1, Math.round(travelMins - elapsedMins * 0.55));
      etaMinutes = Math.min(35, remaining);
      etaPrefix = 'ETA ';
      etaSourceNote = latestBusWithCoords.streetAddress
        ? `unidad avistada cerca de ${latestBusWithCoords.streetAddress} (${distKm.toFixed(1)} km)`
        : `unidad geolocalizada por la comunidad a ${distKm.toFixed(1)} km`;
    } else {
      const hour = new Date(nowTs).getHours();
      const baseHeadway = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20) ? 7 : 12;
      etaMinutes = Math.max(2, Math.min(30, Math.round(baseHeadway * 0.6 + delayMinutes * 0.35)));
    }

    const etaLabel = `${etaPrefix}${etaMinutes}m`;
    const etaHover = `Próximo arribo estimado: en ${etaMinutes} minuto(s) (${etaSourceNote}). Se actualiza automáticamente con cada reporte de colectivo en el mapa.`;

    // 4. Nivel de ocupación
    const currentDate = new Date(nowTs);
    const hourFloat = currentDate.getHours() + currentDate.getMinutes() / 60;
    const isWeekday = currentDate.getDay() >= 1 && currentDate.getDay() <= 5;
    const isPeakHour =
      (hourFloat >= 6.5 && hourFloat <= 9.0) ||
      (hourFloat >= 12.0 && hourFloat <= 14.0) ||
      (hourFloat >= 17.0 && hourFloat <= 20.0);

    let occupancyScore = isPeakHour ? (isWeekday ? 62 : 48) : 30;
    occupancyScore += chatFullHits * 15 - chatEmptyHits * 14;
    occupancyScore += Math.min(delayMinutes, 25);
    occupancyScore += Math.min(pendingRequestsCount * 4, 16);
    occupancyScore = Math.max(10, Math.min(98, occupancyScore));

    let occupancyLabel: 'Baja' | 'Media' | 'Alta' | 'Muy alta' = 'Media';
    let occupancyTone = 'border-[#FFF19A]/40 hover:border-[#FFF19A]';
    let occupancyIconTone = 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45';
    let occupancyTextTone = 'text-[#FFF19A]';
    if (occupancyScore < 36) {
      occupancyLabel = 'Baja';
      occupancyTone = 'border-[#B7F36B]/45 hover:border-[#B7F36B]';
      occupancyIconTone = 'bg-[#B7F36B]/20 text-[#B7F36B] border border-[#B7F36B]/45';
      occupancyTextTone = 'text-[#B7F36B]';
    } else if (occupancyScore < 64) {
      occupancyLabel = 'Media';
      occupancyTone = 'border-[#FFF19A]/40 hover:border-[#FFF19A]';
      occupancyIconTone = 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45';
      occupancyTextTone = 'text-[#FFF19A]';
    } else if (occupancyScore < 82) {
      occupancyLabel = 'Alta';
      occupancyTone = 'border-amber-400/50 hover:border-amber-400';
      occupancyIconTone = 'bg-amber-500/20 text-amber-300 border border-amber-400/50';
      occupancyTextTone = 'text-amber-300';
    } else {
      occupancyLabel = 'Muy alta';
      occupancyTone = 'border-rose-400/55 hover:border-rose-400';
      occupancyIconTone = 'bg-rose-500/20 text-rose-300 border border-rose-400/50';
      occupancyTextTone = 'text-rose-300';
    }

    const occupancyHover = `Nivel de ocupación estimado: ${occupancyLabel} (${occupancyScore}% de capacidad estimada). La IA combina comentarios del chat sobre asientos/pasajeros, demoras acumuladas y franja horaria.`;

    // 5. Predicción de demanda
    let demandScore = isPeakHour ? (isWeekday ? 65 : 50) : 28;
    demandScore += pendingRequestsCount * 10;
    demandScore += recentChat.length >= 6 ? 12 : recentChat.length * 2;
    demandScore += incidentCount * 8;
    demandScore = Math.max(12, Math.min(99, demandScore));

    let demandLabel: 'Tranquila' | 'Moderada' | 'Alta' | 'Pico' = 'Moderada';
    let demandCompact: string = 'Mod.';
    let demandTone = 'border-[#FFF19A]/40 hover:border-[#FFF19A]';
    let demandIconTone = 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45';
    let demandTextTone = 'text-[#FFF19A]';
    if (demandScore < 35) {
      demandLabel = 'Tranquila';
      demandCompact = 'Baja';
      demandTone = 'border-[#B7F36B]/45 hover:border-[#B7F36B]';
      demandIconTone = 'bg-[#B7F36B]/20 text-[#B7F36B] border border-[#B7F36B]/45';
      demandTextTone = 'text-[#B7F36B]';
    } else if (demandScore < 62) {
      demandLabel = 'Moderada';
      demandCompact = 'Mod.';
      demandTone = 'border-[#FFF19A]/40 hover:border-[#FFF19A]';
      demandIconTone = 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45';
      demandTextTone = 'text-[#FFF19A]';
    } else if (demandScore < 82) {
      demandLabel = 'Alta';
      demandCompact = 'Alta';
      demandTone = 'border-amber-400/50 hover:border-amber-400';
      demandIconTone = 'bg-amber-500/20 text-amber-300 border border-amber-400/50';
      demandTextTone = 'text-amber-300';
    } else {
      demandLabel = 'Pico';
      demandCompact = 'Pico';
      demandTone = 'border-rose-400/55 hover:border-rose-400';
      demandIconTone = 'bg-rose-500/20 text-rose-300 border border-rose-400/50';
      demandTextTone = 'text-rose-300';
    }

    const demandHover = `Predicción de demanda: ${demandLabel} (${demandScore}% de intensidad). Proyectada con ${pendingRequestsCount} pedido(s) activo(s) de transporte alternativo, reportes en paradas y ritmo horario Zárate–Campana.`;

    const communitySignalsCount = recentEvents.length + recentChat.length + pendingRequestsCount;
    const friendlySummary =
      delayMinutes >= 15
        ? `Corredor con demoras (+${delayMinutes}m) y ocupación ${occupancyLabel.toLowerCase()}. Conviene anticipar tu salida o evaluar transporte alternativo.`
        : occupancyLabel === 'Alta' || occupancyLabel === 'Muy alta'
        ? `Unidades circulando a ${avgSpeedKmH} km/h con ocupación ${occupancyLabel.toLowerCase()} y demanda ${demandLabel.toLowerCase()}.`
        : `Corredor estable a ${avgSpeedKmH} km/h · Demanda ${demandLabel.toLowerCase()} y ocupación ${occupancyLabel.toLowerCase()}.`;

    return {
      delayLabel,
      delayCompact: delayMinutes === 0 ? '0 min' : `+${delayMinutes} min`,
      delayHover,
      delayMinutes,
      avgSpeedKmH,
      speedHover,
      etaLabel,
      etaCompact: etaPrefix === 'ETA ' ? `${etaMinutes} min` : `~${etaMinutes} min`,
      etaHover,
      occupancyLabel,
      occupancyCompact: occupancyLabel === 'Muy alta' ? 'Máx.' : occupancyLabel,
      occupancyTone,
      occupancyIconTone,
      occupancyTextTone,
      occupancyHover,
      demandLabel,
      demandCompact,
      demandTone,
      demandIconTone,
      demandTextTone,
      demandHover,
      communitySignalsCount,
      friendlySummary,
    };
  }, [allEvents, busEvents, recentChatMessages, pendingRequestsCount, userLocation, nowTs]);

  const triggerJoystickBusReport = (direction: 'hacia_zarate' | 'hacia_malvinas') => {
    playMicroSound('ui_tap');
    setHoveredJoystickBtn(null);
    window.dispatchEvent(
      new CustomEvent('uppa-map-hover-controls', { detail: { hovering: false } })
    );
    window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
    window.dispatchEvent(
      new CustomEvent('uppa-report-bus-direction', { detail: { direction } })
    );
  };

  const setJoystickHover = (btn: 'zarate' | 'malvinas' | null) => {
    setHoveredJoystickBtn(btn);
    window.dispatchEvent(
      new CustomEvent('uppa-map-hover-controls', { detail: { hovering: btn !== null } })
    );
  };

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
      window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
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

  // Búsqueda predictiva por calle, frase, número de parada y "entre qué calles"
  const stopSearchResults = useMemo(
    () => searchLinea228Stops(searchQuery, selectedZone),
    [searchQuery, selectedZone]
  );

  const predictiveSuggestions = useMemo(
    () => getPredictiveStopSuggestions(searchQuery),
    [searchQuery]
  );

  const zones = useMemo(() => {
    const list: string[] = [];
    LINEA_228_STOPS.forEach((s) => {
      if (!list.includes(s.zone)) list.push(s.zone);
    });
    return list;
  }, []);

  if (isMinimized) {
    return (
      <div
        onTouchStart={() => window.dispatchEvent(new CustomEvent('uppa-map-show-controls'))}
        className="relative w-full max-w-lg mx-auto px-2 sm:px-4 pointer-events-none flex flex-col items-center pb-1 uppa-card-enter"
      >
        {/* Hover informativo inteligente sobre los joysticks de colectivo */}
        <AnimatePresence>
          {!isMapFreeMode && hoveredJoystickBtn && (
            <motion.div
              key={hoveredJoystickBtn}
              role="tooltip"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-none mb-2.5 w-full max-w-xs px-3.5 py-2.5 rounded-2xl bg-[#101114]/95 backdrop-blur-md border-2 shadow-[0_10px_28px_rgba(0,0,0,0.82)] text-left ${
                hoveredJoystickBtn === 'zarate' ? 'border-[#FFF19A]/85' : 'border-[#B7F36B]/85'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-black">
                <div className="flex items-center gap-1.5">
                  <span>{hoveredJoystickBtn === 'zarate' ? '📍 ➡️' : '📍 ⬅️'}</span>
                  <span
                    className={
                      hoveredJoystickBtn === 'zarate' ? 'text-[#FFF19A]' : 'text-[#B7F36B]'
                    }
                  >
                    {hoveredJoystickBtn === 'zarate'
                      ? 'Reportar colectivo hacia Zárate'
                      : 'Reportar colectivo hacia Malvinas'}
                  </span>
                </div>
                {(hoveredJoystickBtn === 'zarate' ? activeZarateCount : activeMalvinasCount) >
                  0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 font-mono text-[9px]">
                    {hoveredJoystickBtn === 'zarate' ? activeZarateCount : activeMalvinasCount}{' '}
                    activo(s)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/90 leading-snug mt-1">
                {hoveredJoystickBtn === 'zarate'
                  ? 'Marca en vivo tu ubicación GPS como colectivo rumbo a Zárate Centro / Terminal durante 1 minuto, detecta la calle exacta y avisa al Chat Comunitario.'
                  : 'Marca en vivo tu ubicación GPS como colectivo rumbo a Barrio Malvinas (Campana) durante 1 minuto, detecta la calle exacta y avisa al Chat Comunitario.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Consola estilo Joystick: aparecen suavemente al tocar y desaparecen sin actividad */}
        <div
          onPointerDown={() => window.dispatchEvent(new CustomEvent('uppa-map-show-controls'))}
          className="pointer-events-auto inline-flex items-center justify-center gap-2 sm:gap-2.5"
        >
          <AnimatePresence>
            {!isMapFreeMode && (
              <motion.button
                key="joystick-zarate"
                type="button"
                aria-label="Reportar colectivo hacia Zárate"
                initial={{ opacity: 0, scale: 0.68, x: 14 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.68, x: 14 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.91, y: 2 }}
                onClick={() => triggerJoystickBusReport('hacia_zarate')}
                onMouseEnter={() => setJoystickHover('zarate')}
                onMouseLeave={() => setJoystickHover(null)}
                onFocus={() => setJoystickHover('zarate')}
                onBlur={() => setJoystickHover(null)}
                className="relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full bg-gradient-to-b from-[#FFF5AD] to-[#F2D94E] text-[#101114] border-[3px] border-[#101114] ring-2 ring-[#FFF19A]/45 shadow-[0_5px_0_#0A0B0D,0_8px_20px_rgba(255,241,154,0.34)] flex items-center justify-center cursor-pointer shrink-0"
              >
                <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-[#101114]/25 bg-white/25 flex items-center justify-center gap-0.5 pointer-events-none">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M8 6v6" />
                    <path d="M15 6v6" />
                    <path d="M2 12h19.6" />
                    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
                    <circle cx="7" cy="18" r="2" />
                    <path d="M9 18h5" />
                    <circle cx="16" cy="18" r="2" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
                {activeZarateCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-[#101114] animate-pulse" />
                )}
              </motion.button>
            )}
          </AnimatePresence>

          <div className="inline-flex items-center justify-center gap-2 px-2 py-1.5 rounded-2xl bg-[#101114]/75 backdrop-blur-md border border-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
            <motion.button
              type="button"
              whileHover={{ scale: 1.08, y: -1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 450, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                setHoveredJoystickBtn(null);
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
          </div>

          <AnimatePresence>
            {!isMapFreeMode && (
              <motion.button
                key="joystick-malvinas"
                type="button"
                aria-label="Reportar colectivo hacia Malvinas"
                initial={{ opacity: 0, scale: 0.68, x: -14 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.68, x: -14 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.91, y: 2 }}
                onClick={() => triggerJoystickBusReport('hacia_malvinas')}
                onMouseEnter={() => setJoystickHover('malvinas')}
                onMouseLeave={() => setJoystickHover(null)}
                onFocus={() => setJoystickHover('malvinas')}
                onBlur={() => setJoystickHover(null)}
                className="relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full bg-gradient-to-b from-[#CBF989] to-[#9EE149] text-[#101114] border-[3px] border-[#101114] ring-2 ring-[#B7F36B]/45 shadow-[0_5px_0_#0A0B0D,0_8px_20px_rgba(183,243,107,0.34)] flex items-center justify-center cursor-pointer shrink-0"
              >
                <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-[#101114]/25 bg-white/25 flex items-center justify-center gap-0.5 pointer-events-none">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5" />
                    <path d="m12 19-7-7 7-7" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M8 6v6" />
                    <path d="M15 6v6" />
                    <path d="M2 12h19.6" />
                    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
                    <circle cx="7" cy="18" r="2" />
                    <path d="M9 18h5" />
                    <circle cx="16" cy="18" r="2" />
                  </svg>
                </span>
                {activeMalvinasCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-[#101114] animate-pulse" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
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

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                playMicroSound('ui_tap');
                setIsExpanded(false);
                setIsMinimized(true);
                window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
              }}
              className="w-9 h-9 rounded-xl bg-[#101114] hover:border-rose-400 text-[#9299A5] hover:text-rose-300 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              title="Minimizar panel de opciones (x)"
              aria-label="Minimizar panel"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </motion.button>
          </div>
        </div>

        {/* 4 Action Cards (Solo iconos con funcionalidad completa y hover informativo) */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {/* Botón 1: Pedir Transporte Alternativo */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenPedirTransporte();
              }}
              title="Pedir Transporte Alternativo: emití una solicitud rápida de Moto Taxi o Auto Taxi y consultá el ranking de prestadores"
              aria-label="Pedir Transporte Alternativo"
              className="min-h-[56px] p-2 rounded-2xl bg-[#101114] hover:border-[#FFF19A] border-2 border-[#FFF19A]/45 transition-colors group cursor-pointer flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF19A] text-[#101114] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 fill-[#101114]" />
              </div>
            </motion.button>

            {/* Botón 2: Taxi & Motos */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenTaxis();
              }}
              title="Taxis & Motos: ver prestadores disponibles en vivo y seguir viajes"
              aria-label="Taxis y Motos"
              className="min-h-[56px] p-2 rounded-2xl bg-[#101114] hover:border-[#B7F36B] border-2 border-[#B7F36B]/45 transition-colors group cursor-pointer flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <div className="flex items-center -space-x-1">
                  <Bike className="w-4 h-4" />
                  <Car className="w-4 h-4" />
                </div>
              </div>
            </motion.button>

            {/* Botón 3: Prestar Servicio (Choferes - Icono de Volante) */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                if (onOpenPrestarServicio) {
                  onOpenPrestarServicio();
                } else {
                  onOpenTaxis();
                }
              }}
              title="Choferes / Prestar Servicio: habilitá tu Auto o Moto para tomar viajes de la comunidad"
              aria-label="Choferes - Prestar Servicio"
              className="min-h-[56px] p-2 rounded-2xl bg-[#101114] hover:border-[#FFF19A] border-2 border-white/20 transition-colors group cursor-pointer flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-xl bg-[#202329] text-[#FFF19A] border border-white/20 group-hover:border-[#FFF19A]/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                {/* Icono de Volante para identificar rápidamente a choferes */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="2.2" />
                  <path d="M12 14.2V21" />
                  <path d="M3.4 9.8C6.2 10.7 9 11.1 12 11.1s5.8-.4 8.6-1.3" />
                </svg>
              </div>
            </motion.button>

            {/* Botón 4: Chat Comunitario */}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => {
                playMicroSound('ui_tap');
                onOpenChat();
              }}
              title={
                unreadChatCount > 0
                  ? `Chat Comunitario: abrir alertas y mensajes en vivo (${unreadChatCount} mensaje(s) reciente(s))`
                  : 'Chat Comunitario: alertas de pasajeros y choferes en directo'
              }
              aria-label="Chat Comunitario"
              className="relative min-h-[56px] p-2 rounded-2xl bg-[#101114] hover:border-white/60 border-2 border-white/20 transition-colors group cursor-pointer flex items-center justify-center"
            >
              <div className="w-10 h-10 rounded-xl bg-[#202329] text-white border border-white/20 group-hover:text-[#FFF19A] group-hover:border-[#FFF19A]/50 flex items-center justify-center group-hover:scale-105 transition-all">
                <MessageSquare className="w-5 h-5" />
              </div>
            </motion.button>
          </div>
        </div>

        {/* Corredor Card Línea 228 — Limpio, Icon-Only KPIs, Micro-Banner IA en movimiento y Botón Paradas arriba a la derecha */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-2 min-w-0"
                title={`Corredor Línea 228 en vivo: ${LINEA_228_STOPS.length} paradas geolocalizadas entre Barrio Malvinas, Campana y Zárate · ${corridorAiMetrics.communitySignalsCount} señal(es) comunitaria(s) activa(s)`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#202329] text-[#FFF19A] flex items-center justify-center border border-white/15 shrink-0">
                  <Bus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>Línea 228</span>
                    <LottieMicroIcon variant="radar" size={16} />
                  </h3>
                  <p className="text-[10px] text-[#9299A5] font-medium truncate">
                    Corredor en vivo · <strong className="text-white">{LINEA_228_STOPS.length} paradas</strong>
                  </p>
                </div>
              </div>

              {/* Botón de "Ver 66 paradas de Línea 228" arriba a la derecha, solo icono de parada con el mismo diseño de los demás botones */}
              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                onClick={() => {
                  playMicroSound('ui_tap');
                  setIsExpanded((prev) => !prev);
                }}
                aria-label={
                  isExpanded
                    ? `Ocultar listado de ${LINEA_228_STOPS.length} paradas de Línea 228`
                    : `Ver ${LINEA_228_STOPS.length} paradas de Línea 228`
                }
                title={
                  isExpanded
                    ? `Ocultar listado de ${LINEA_228_STOPS.length} paradas de Línea 228`
                    : `Ver las ${LINEA_228_STOPS.length} paradas de Línea 228 con buscador predictivo y guía GPS directa a Google Maps`
                }
                className={`min-h-[46px] min-w-[46px] p-1.5 rounded-2xl border-2 transition-colors group cursor-pointer flex items-center justify-center shrink-0 ${
                  isExpanded
                    ? 'bg-[#181B20] border-[#FFF19A] shadow-[0_0_12px_rgba(255,241,154,0.28)]'
                    : 'bg-[#181B20] border-[#FFF19A]/45 hover:border-[#FFF19A]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform ${
                    isExpanded
                      ? 'bg-[#B7F36B] text-[#101114]'
                      : 'bg-[#FFF19A] text-[#101114]'
                  }`}
                >
                  {/* Icono representativo de parada de colectivo (poste + cartel de parada) */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[18px] h-[18px]"
                    aria-hidden="true"
                  >
                    <path d="M7 21V4" />
                    <path d="M4 21h6" />
                    <rect x="7" y="4" width="12" height="9" rx="2" />
                    <path d="M10 8h6" />
                    <path d="M10 10.5h3.5" />
                    <circle cx="17" cy="18.5" r="2.2" />
                  </svg>
                </div>
              </motion.button>
            </div>

            {/* 5 KPIs en tiempo real — Diseño limpio solo íconos (mismo lenguaje que los 4 botones superiores) + hover informativo */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {/* KPI 1: Demora estimada actual */}
              <div
                className={`min-h-[48px] sm:min-h-[52px] p-1.5 rounded-2xl bg-[#181B20] border-2 transition-colors flex items-center justify-center cursor-help ${
                  corridorAiMetrics.delayMinutes >= 15
                    ? 'border-amber-400/50 hover:border-amber-300'
                    : 'border-[#FFF19A]/40 hover:border-[#FFF19A]'
                }`}
                title={corridorAiMetrics.delayHover}
                aria-label={corridorAiMetrics.delayHover}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
                    corridorAiMetrics.delayMinutes >= 15
                      ? 'bg-amber-400 text-[#101114]'
                      : 'bg-[#FFF19A] text-[#101114]'
                  }`}
                >
                  <Clock className="w-[18px] h-[18px] stroke-[2.4]" />
                </div>
              </div>

              {/* KPI 2: Velocidad promedio */}
              <div
                className="min-h-[48px] sm:min-h-[52px] p-1.5 rounded-2xl bg-[#181B20] border-2 border-white/15 hover:border-[#FFF19A]/65 transition-colors flex items-center justify-center cursor-help"
                title={corridorAiMetrics.speedHover}
                aria-label={corridorAiMetrics.speedHover}
              >
                <div className="w-9 h-9 rounded-xl bg-[#202329] text-[#FFF19A] border border-white/20 flex items-center justify-center shadow-sm">
                  <Gauge className="w-[18px] h-[18px] stroke-[2.2]" />
                </div>
              </div>

              {/* KPI 3: Próximo arribo (ETA) */}
              <div
                className="min-h-[48px] sm:min-h-[52px] p-1.5 rounded-2xl bg-[#181B20] border-2 border-[#B7F36B]/45 hover:border-[#B7F36B] transition-colors flex items-center justify-center cursor-help"
                title={corridorAiMetrics.etaHover}
                aria-label={corridorAiMetrics.etaHover}
              >
                <div className="w-9 h-9 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center shadow-sm">
                  <Activity className="w-[18px] h-[18px] stroke-[2.5]" />
                </div>
              </div>

              {/* KPI 4: Nivel de ocupación */}
              <div
                className={`min-h-[48px] sm:min-h-[52px] p-1.5 rounded-2xl bg-[#181B20] border-2 transition-colors flex items-center justify-center cursor-help ${corridorAiMetrics.occupancyTone}`}
                title={corridorAiMetrics.occupancyHover}
                aria-label={corridorAiMetrics.occupancyHover}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${corridorAiMetrics.occupancyIconTone}`}
                >
                  <Users className="w-[18px] h-[18px] stroke-[2.2]" />
                </div>
              </div>

              {/* KPI 5: Predicción de demanda */}
              <div
                className={`min-h-[48px] sm:min-h-[52px] p-1.5 rounded-2xl bg-[#181B20] border-2 transition-colors flex items-center justify-center cursor-help ${corridorAiMetrics.demandTone}`}
                title={corridorAiMetrics.demandHover}
                aria-label={corridorAiMetrics.demandHover}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${corridorAiMetrics.demandIconTone}`}
                >
                  <TrendingUp className="w-[18px] h-[18px] stroke-[2.2]" />
                </div>
              </div>
            </div>

            {/* Micro-Banner en movimiento con Lectura IA y métricas en tiempo real */}
            <div
              className="px-2.5 py-2 rounded-xl bg-[#181B20] border border-white/10 flex items-center gap-2 overflow-hidden cursor-help group"
              title={`IA Comunitaria en vivo (${corridorAiMetrics.communitySignalsCount} señal(es)): ${corridorAiMetrics.friendlySummary} · Demora: ${corridorAiMetrics.delayLabel} · Velocidad: ${corridorAiMetrics.avgSpeedKmH} km/h · Próximo arribo: ${corridorAiMetrics.etaCompact} · Ocupación: ${corridorAiMetrics.occupancyLabel} · Demanda: ${corridorAiMetrics.demandLabel}`}
            >
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#202329] border border-[#B7F36B]/40 text-[9.5px] font-black text-[#B7F36B] shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-[#FFF19A]" />
                <span>IA</span>
              </span>

              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="animate-ai-micro-banner text-[10.5px] font-semibold text-white/95 whitespace-nowrap">
                  <span className="pr-8">
                    <strong className="text-[#B7F36B]">Lectura IA:</strong>{' '}
                    {corridorAiMetrics.friendlySummary} ·{' '}
                    <span className="text-[#FFF19A] font-bold">
                      Demora {corridorAiMetrics.delayCompact}
                    </span>{' '}
                    · {corridorAiMetrics.avgSpeedKmH} km/h ·{' '}
                    <span className="text-[#B7F36B] font-bold">
                      Arribo {corridorAiMetrics.etaCompact}
                    </span>{' '}
                    · Ocupación {corridorAiMetrics.occupancyLabel} · Demanda{' '}
                    {corridorAiMetrics.demandLabel}
                  </span>
                  <span className="pr-8" aria-hidden="true">
                    <strong className="text-[#B7F36B]">Lectura IA:</strong>{' '}
                    {corridorAiMetrics.friendlySummary} ·{' '}
                    <span className="text-[#FFF19A] font-bold">
                      Demora {corridorAiMetrics.delayCompact}
                    </span>{' '}
                    · {corridorAiMetrics.avgSpeedKmH} km/h ·{' '}
                    <span className="text-[#B7F36B] font-bold">
                      Arribo {corridorAiMetrics.etaCompact}
                    </span>{' '}
                    · Ocupación {corridorAiMetrics.occupancyLabel} · Demanda{' '}
                    {corridorAiMetrics.demandLabel}
                  </span>
                </div>
              </div>
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
                  {LINEA_228_STOPS.length} Paradas de Línea 228
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#101114] text-[#FFF19A] border border-white/15">
                  {stopSearchResults.length}
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

            {/* Buscador inteligente y predictivo por calle, frase, parada o entre qué calles */}
            <div className="space-y-2 mb-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#FFF19A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsSearchFocused(false), 180);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedZone !== 'all' && e.target.value.trim().length > 0) {
                      setSelectedZone('all');
                    }
                  }}
                  placeholder="Escribí calle, frase, parada o 'entre Alberdi y Mitre'..."
                  title="Buscador predictivo: busca por nombre de calle, frase, número de parada (#14) o cruce entre calles (ej: entre Salmini y Bertolini)"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 focus:border-[#FFF19A] rounded-xl pl-8 pr-9 py-1.5 text-xs text-white placeholder-[#9299A5] focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-[#202329] hover:bg-[#FFF19A] text-[#9299A5] hover:text-[#101114] flex items-center justify-center transition-colors cursor-pointer"
                    title="Limpiar búsqueda"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Sugerencias predictivas en tiempo real al escribir */}
                {isSearchFocused && searchQuery.trim().length > 0 && predictiveSuggestions.length > 0 && (
                  <div className="mt-1.5 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/45 shadow-[0_12px_28px_rgba(0,0,0,0.8)] overflow-hidden divide-y divide-white/10">
                    <div className="px-3 py-1.5 bg-[#181B20] flex items-center justify-between text-[9.5px] font-bold text-[#FFF19A]">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Predicciones rápidas de parada / calle</span>
                      </span>
                      <span className="text-[#9299A5] font-mono">{predictiveSuggestions.length} sugerencias</span>
                    </div>
                    {predictiveSuggestions.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 hover:bg-[#202329] flex items-center justify-between gap-2 transition-colors"
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            playMicroSound('ui_tap');
                            setSelectedZone('all');
                            setSearchQuery(s.query);
                            setIsSearchFocused(false);
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                          title={`Filtrar por ${s.label}`}
                        >
                          <p className="text-[11px] font-bold text-white truncate flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 ${
                                s.kind === 'street'
                                  ? 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/35'
                                  : s.kind === 'between'
                                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                                  : 'bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/35'
                              }`}
                            >
                              {s.kind === 'street' ? 'Calle' : s.kind === 'between' ? 'Entre' : 'Parada'}
                            </span>
                            <span className="truncate">{s.label}</span>
                          </p>
                          <p className="text-[9.5px] text-[#9299A5] truncate mt-0.5">
                            {s.subtitle}
                          </p>
                        </button>

                        {s.stop && onSelectStop && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              playMicroSound('ui_tap');
                              setIsExpanded(false);
                              setIsMinimized(true);
                              window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
                              onSelectStop(s.stop!);
                            }}
                            className="px-2 py-1 rounded-lg bg-[#FFF19A] text-[#101114] font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer hover:brightness-95"
                            title={`Ir directo a ${s.stop.name} en el mapa y abrir guía GPS`}
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Accesos predictivos por calle cuando la búsqueda está vacía */}
              {!searchQuery.trim() && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] scrollbar-none">
                  <span className="text-[9.5px] font-extrabold text-[#FFF19A] shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Calles rápidas:</span>
                  </span>
                  {POPULAR_STREET_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        playMicroSound('ui_tap');
                        setSelectedZone('all');
                        setSearchQuery(chip.query);
                      }}
                      title={`Buscar paradas sobre ${chip.label}`}
                      className="px-2 py-1 rounded-lg bg-[#181B20] hover:bg-[#FFF19A] text-white/90 hover:text-[#101114] border border-white/15 font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

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
                  Todas ({LINEA_228_STOPS.length})
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

            {/* Scrollable container with all 66 stops */}
            <div className="max-h-60 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {stopSearchResults.map(({ stop, betweenLabel }) => (
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
                        {stop.sequence === LINEA_228_STOPS.length && (
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
                      {betweenLabel && (
                        <p className="text-[9.5px] text-[#9299A5]/90 truncate mt-0.5">
                          {betweenLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  {onSelectStop && (
                    <button
                      type="button"
                      onClick={() => {
                        playMicroSound('ui_tap');
                        setIsExpanded(false);
                        setIsMinimized(true);
                        window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
                        onSelectStop(stop);
                      }}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#202329] hover:bg-[#FFF19A] hover:text-[#101114] border border-white/15 text-white font-bold text-[10.5px] flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-all"
                      title={`Centrar parada ${stop.name} en el mapa y abrir guía GPS`}
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Ver</span>
                    </button>
                  )}
                </div>
              ))}

              {stopSearchResults.length === 0 && (
                <div className="text-center py-6 space-y-2 text-[#9299A5] text-xs">
                  <p>No encontramos paradas exactas con "{searchQuery}".</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 rounded-xl bg-[#202329] hover:bg-[#FFF19A] text-white hover:text-[#101114] border border-white/15 font-bold text-[11px] cursor-pointer transition-colors"
                  >
                    Ver las {LINEA_228_STOPS.length} paradas
                  </button>
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
                    window.dispatchEvent(new CustomEvent('uppa-map-show-controls'));
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
