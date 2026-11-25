import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  TrainFront,
  Search,
  Sparkles,
  CheckCircle2,
  XCircle,
  MapPin,
  CalendarDays,
  Compass,
  Repeat,
  X,
} from 'lucide-react';
import {
  ALL_MITRE_TRAIN_SERVICES,
  TRAIN_DAY_LABELS,
  TRAIN_DIRECTION_LABELS,
  TRAIN_STATIONS_ORDER_ASC,
  TrainDayType,
  TrainDirection,
  TrainServiceEntry,
  findNextTrainForStation,
  formatMinutesDelta,
  getDefaultTrainDayType,
  getRetiroComboSuggestion,
  getServiceStartHourHint,
  parseTrainMinutes,
} from '../../data/trenMitreData';

interface TrainScheduleSectionProps {
  initialStationId?: string;
  onBackToMap: () => void;
}

const CHART_MIN_MINS = 90; // 01:30
const CHART_MAX_MINS = 1520; // 01:20 (+1 día)

export const TrainScheduleSection: React.FC<TrainScheduleSectionProps> = ({
  initialStationId = 'campana',
  onBackToMap,
}) => {
  const [dayType, setDayType] = useState<TrainDayType>(() => getDefaultTrainDayType());
  const [direction, setDirection] = useState<TrainDirection>(() =>
    initialStationId === 'villa_ballester' ? 'hacia_zarate' : 'hacia_ballester'
  );
  const [focusedStationId, setFocusedStationId] = useState<string>(initialStationId);
  const [onlyRetiroCombo, setOnlyRetiroCombo] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [hoveredChartPoint, setHoveredChartPoint] = useState<{
    service: TrainServiceEntry;
    stationId: string;
    stationName: string;
    timeStr: string;
    xPct: number;
    yPct: number;
  } | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Actualizar reloj cada 10 segundos para la línea "Ahora" y el seguimiento titilante en vivo
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(id);
  }, []);

  // Sincronizar si el usuario abrió otra estación desde el mapa
  useEffect(() => {
    setFocusedStationId(initialStationId);
    setSelectedServiceId(null);
  }, [initialStationId]);

  const orderedStationsForTable = useMemo(
    () =>
      direction === 'hacia_zarate'
        ? TRAIN_STATIONS_ORDER_ASC
        : [...TRAIN_STATIONS_ORDER_ASC].reverse(),
    [direction]
  );

  // Todos los servicios para el día y sentido seleccionados
  const servicesForDayAndDir = useMemo(
    () => ALL_MITRE_TRAIN_SERVICES.filter((s) => s.dayType === dayType && s.direction === direction),
    [dayType, direction]
  );

  // Taxonomía Inteligente: filtrado multicriterio (Tren N°, Ciudad, Horario, Combinación Retiro)
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return servicesForDayAndDir.filter((s) => {
      if (onlyRetiroCombo && !s.retiroTime) return false;
      if (!q) return true;

      if (s.trainNo.toLowerCase().includes(q)) return true;
      if (s.retiroTime && (`retiro ${s.retiroTime}`).toLowerCase().includes(q)) return true;

      for (const st of TRAIN_STATIONS_ORDER_ASC) {
        const t = s.stops[st.id];
        if (!t) continue;
        if (t.toLowerCase().includes(q)) return true;
        if (st.name.toLowerCase().includes(q) && q.length >= 2) return true;
      }
      return false;
    });
  }, [servicesForDayAndDir, onlyRetiroCombo, searchQuery]);

  // Próximo servicio en cada sentido para la ciudad enfocada
  const nextHaciaBallester = useMemo(
    () => findNextTrainForStation(dayType, 'hacia_ballester', focusedStationId, now),
    [dayType, focusedStationId, now]
  );
  const nextHaciaZarate = useMemo(
    () => findNextTrainForStation(dayType, 'hacia_zarate', focusedStationId, now),
    [dayType, focusedStationId, now]
  );

  const activeUpcoming =
    direction === 'hacia_ballester' ? nextHaciaBallester : nextHaciaZarate;

  // Servicio actualmente seleccionado en el inspector
  const selectedService = useMemo(() => {
    if (selectedServiceId) {
      const found = filteredServices.find((s) => s.id === selectedServiceId);
      if (found) return found;
    }
    if (activeUpcoming && filteredServices.some((s) => s.id === activeUpcoming.service.id)) {
      return activeUpcoming.service;
    }
    return filteredServices[0] ?? null;
  }, [selectedServiceId, filteredServices, activeUpcoming]);

  const focusedStationMeta = useMemo(
    () =>
      TRAIN_STATIONS_ORDER_ASC.find((st) => st.id === focusedStationId) ??
      TRAIN_STATIONS_ORDER_ASC[8],
    [focusedStationId]
  );

  // Geometría del gráfico interactivo Time-Station (Marey)
  const SVG_W = 920;
  const SVG_H = 380;
  const PAD_L = 104;
  const PAD_R = 26;
  const PAD_T = 28;
  const PAD_B = 34;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;

  const minsToX = (mins: number) => {
    const clamped = Math.max(CHART_MIN_MINS, Math.min(CHART_MAX_MINS, mins));
    return PAD_L + ((clamped - CHART_MIN_MINS) / (CHART_MAX_MINS - CHART_MIN_MINS)) * PLOT_W;
  };

  // Y: Zárate (kmOrder 10) arriba, Villa Ballester (kmOrder 0) abajo
  const stationToY = (kmOrder: number) => {
    const ratio = (10 - kmOrder) / 10;
    return PAD_T + ratio * PLOT_H;
  };

  const nowMinsAdjusted = useMemo(() => {
    const m = now.getHours() * 60 + now.getMinutes();
    return m < 90 ? m + 1440 : m;
  }, [now]);

  const nowLineX =
    nowMinsAdjusted >= CHART_MIN_MINS && nowMinsAdjusted <= CHART_MAX_MINS
      ? minsToX(nowMinsAdjusted)
      : null;

  const hourTicks = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  const selectedCombo = selectedService ? getRetiroComboSuggestion(selectedService) : null;

  const comboCountInFilter = useMemo(
    () => servicesForDayAndDir.filter((s) => Boolean(s.retiroTime)).length,
    [servicesForDayAndDir]
  );

  // Seguimiento en tiempo real respecto a la hora actual
  const todayDayType = getDefaultTrainDayType(now);
  const isLiveTodaySchedule = dayType === todayDayType;

  const getStopDiffMinutes = (
    timeStr: string | null | undefined,
    serviceHintHour: number
  ): number | null => {
    if (!timeStr) return null;
    const stopMins = parseTrainMinutes(timeStr, serviceHintHour);
    if (stopMins === null) return null;
    const rawNowMins = now.getHours() * 60 + now.getMinutes();
    const effectiveNowMins =
      now.getHours() < 4 && serviceHintHour >= 18 ? rawNowMins + 1440 : rawNowMins;
    return stopMins - effectiveNowMins;
  };

  const getProximityTier = (diffMins: number | null) => {
    if (!isLiveTodaySchedule || diffMins === null) return 'idle' as const;
    if (diffMins >= -1 && diffMins <= 0) return 'arrived_now' as const; // Verde titilando (en estación)
    if (diffMins >= 1 && diffMins <= 5) return 'imminent' as const; // Amarillo titilando (1-5m)
    if (diffMins >= 6 && diffMins <= 15) return 'approaching' as const; // Naranja titilando (6-15m)
    if (diffMins >= 16 && diffMins <= 30) return 'upcoming' as const; // Celeste titilando (16-30m)
    if (diffMins < -1 && diffMins >= -120) return 'passed' as const; // Recién pasó
    return 'idle' as const;
  };

  const isServiceInTransitNow = (service: TrainServiceEntry): boolean => {
    if (!isLiveTodaySchedule) return false;
    const hint = getServiceStartHourHint(service);
    let minM: number | null = null;
    let maxM: number | null = null;
    for (const st of TRAIN_STATIONS_ORDER_ASC) {
      const t = service.stops[st.id];
      if (!t) continue;
      const m = parseTrainMinutes(t, hint);
      if (m === null) continue;
      if (minM === null || m < minM) minM = m;
      if (maxM === null || m > maxM) maxM = m;
    }
    if (minM === null || maxM === null) return false;
    const rawNow = now.getHours() * 60 + now.getMinutes();
    const effNow = now.getHours() < 4 && hint >= 18 ? rawNow + 1440 : rawNow;
    return effNow >= minM - 2 && effNow <= maxM + 2;
  };

  const activeInTransitServices = useMemo(
    () => filteredServices.filter((s) => isServiceInTransitNow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredServices, now, dayType]
  );

  return (
    <div className="min-h-full bg-[#101114] text-white pb-16">
      {/* Barra superior contextual (exclusiva al ingresar desde Estación Campana o Zárate) */}
      <div className="sticky top-0 z-30 bg-[#101114]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToMap}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#202329] hover:bg-[#2a2e36] border border-white/15 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-[#FFF19A]" />
              <span>Volver al Mapa</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase tracking-wider">
                  <TrainFront className="w-3 h-3" />
                  Línea Mitre · V. Ballester – Zárate
                </span>
                <span className="text-[11px] font-mono text-[#9299A5]">
                  Vigente desde 14/09/26
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-white truncate mt-0.5">
                Servicio Inteligente · Estación {focusedStationMeta.name}
              </h1>
            </div>
          </div>

          {/* Indicador hora actual + selector rápido Campana / Zárate */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#202329] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setFocusedStationId('campana')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  focusedStationId === 'campana'
                    ? 'bg-[#FFF19A] text-[#101114] shadow-sm'
                    : 'text-[#9299A5] hover:text-white'
                }`}
              >
                Est. Campana
              </button>
              <button
                type="button"
                onClick={() => setFocusedStationId('zarate')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  focusedStationId === 'zarate'
                    ? 'bg-[#FFF19A] text-[#101114] shadow-sm'
                    : 'text-[#9299A5] hover:text-white'
                }`}
              >
                Est. Zárate
              </button>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-[#202329] border border-white/10 font-mono tabular-nums text-xs font-bold text-[#B7F36B] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        {/* Resumen inteligente de Próximos Trenes desde la estación seleccionada */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {[
            {
              dir: 'hacia_ballester' as TrainDirection,
              title: `Desde ${focusedStationMeta.shortName} hacia Villa Ballester / Retiro`,
              match: nextHaciaBallester,
              accent: 'border-[#B7F36B]/40 bg-[#202329]',
              badgeClass: 'text-[#B7F36B] bg-[#B7F36B]/10 border-[#B7F36B]/30',
            },
            {
              dir: 'hacia_zarate' as TrainDirection,
              title: `Hacia Escobar / Campana / Zárate (por ${focusedStationMeta.shortName})`,
              match: nextHaciaZarate,
              accent: 'border-sky-400/40 bg-[#202329]',
              badgeClass: 'text-sky-300 bg-sky-500/10 border-sky-400/30',
            },
          ].map((card) => {
            const isCurrentDir = direction === card.dir;
            return (
              <div
                key={card.dir}
                onClick={() => {
                  setDirection(card.dir);
                  if (card.match) setSelectedServiceId(card.match.service.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setDirection(card.dir);
                    if (card.match) setSelectedServiceId(card.match.service.id);
                  }
                }}
                className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                  isCurrentDir
                    ? `${card.accent} ring-1 ring-[#FFF19A]/40 shadow-[0_8px_24px_rgba(0,0,0,0.45)]`
                    : 'bg-[#202329]/70 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${card.badgeClass}`}
                      >
                        {isCurrentDir ? '● Sentido Activo' : 'Cambiar sentido'}
                      </span>
                      <span className="text-[11px] font-semibold text-[#9299A5]">
                        {TRAIN_DAY_LABELS[dayType].label}
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white mt-1.5">
                      {card.title}
                    </h2>
                  </div>

                  {card.match && (
                    <div className="text-right shrink-0">
                      <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#FFF19A]">
                        {card.match.stationTime}
                      </div>
                      <div className="text-[11px] font-bold text-[#B7F36B]">
                        {formatMinutesDelta(card.match.minutesUntil)}
                      </div>
                    </div>
                  )}
                </div>

                {card.match ? (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-lg bg-[#101114] border border-white/15 font-mono font-black text-sky-300">
                        Tren N° {card.match.service.trainNo}
                      </span>
                      <span className="text-[#9299A5]">
                        {card.match.service.direction === 'hacia_ballester'
                          ? `Llega a V. Ballester ${card.match.service.stops.villa_ballester ?? '—'} hs`
                          : `Llega a Zárate ${card.match.service.stops.zarate ?? card.match.service.stops.escobar ?? '—'} hs`}
                      </span>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${
                        card.match.combo.hasCombo
                          ? 'bg-[#B7F36B]/15 border-[#B7F36B]/40 text-[#B7F36B]'
                          : 'bg-[#101114] border-white/10 text-[#9299A5]'
                      }`}
                    >
                      {card.match.combo.hasCombo ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{card.match.combo.summary}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#9299A5]">
                    Este servicio no realiza parada en {focusedStationMeta.name} en el cronograma seleccionado.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel de Taxonomía Inteligente */}
        <section className="rounded-2xl bg-[#202329] border border-white/10 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#101114] border border-[#FFF19A]/40 flex items-center justify-center text-[#FFF19A]">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white">
                  Taxonomía Inteligente del Servicio
                </h2>
                <p className="text-[11px] text-[#9299A5]">
                  Cruzá N° de Tren, Ciudad, Horario y Combinación sugerida a/desde Retiro
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-[#9299A5]">
              Mostrando{' '}
              <span className="text-[#FFF19A] font-black">{filteredServices.length}</span> de{' '}
              <span className="text-white font-bold">{servicesForDayAndDir.length}</span> servicios
            </div>
          </div>

          {/* Controles primarios: Día + Sentido + Búsqueda + Filtro Retiro */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Tipo de día */}
            <div className="md:col-span-4 flex items-center gap-1 bg-[#101114] p-1 rounded-xl border border-white/10">
              {(['lunes_viernes', 'sabados', 'domingos_feriados'] as TrainDayType[]).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDayType(dt)}
                  className={`flex-1 py-2 px-2 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    dayType === dt
                      ? 'bg-[#FFF19A] text-[#101114]'
                      : 'text-[#9299A5] hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
                  <span>{TRAIN_DAY_LABELS[dt].shortLabel}</span>
                </button>
              ))}
            </div>

            {/* Sentido */}
            <div className="md:col-span-4 flex items-center gap-1 bg-[#101114] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setDirection('hacia_ballester')}
                className={`flex-1 py-2 px-2 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  direction === 'hacia_ballester'
                    ? 'bg-[#B7F36B] text-[#101114]'
                    : 'text-[#9299A5] hover:text-white'
                }`}
              >
                <span>A V. Ballester / Retiro</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection('hacia_zarate')}
                className={`flex-1 py-2 px-2 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  direction === 'hacia_zarate'
                    ? 'bg-sky-400 text-[#101114]'
                    : 'text-[#9299A5] hover:text-white'
                }`}
              >
                <span>A Escobar / Zárate</span>
              </button>
            </div>

            {/* Buscador + Solo Combinación Retiro */}
            <div className="md:col-span-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="N° tren (ej 2512), hora (14:) o ciudad..."
                  className="w-full h-full min-h-[38px] pl-8 pr-7 rounded-xl bg-[#101114] border border-white/15 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOnlyRetiroCombo((v) => !v)}
                className={`min-h-[38px] px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  onlyRetiroCombo
                    ? 'bg-[#B7F36B]/20 border-[#B7F36B] text-[#B7F36B]'
                    : 'bg-[#101114] border-white/15 text-[#9299A5] hover:text-white'
                }`}
                title="Filtrar solo trenes que sugieren combinación con Retiro"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Retiro</span>
                <span className="font-mono text-[10px] opacity-80">({comboCountInFilter})</span>
              </button>
            </div>
          </div>

          {/* Selector de Ciudad / Estación en el corredor */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9299A5] mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#FFF19A]" />
              <span>Estación / Ciudad Enfocada (tocá una estación para ver sus horarios exactos)</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {orderedStationsForTable.map((st) => {
                const active = st.id === focusedStationId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setFocusedStationId(st.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A] font-black'
                        : st.id === 'campana' || st.id === 'zarate'
                        ? 'bg-[#101114] text-sky-300 border-sky-400/35 hover:border-sky-400'
                        : 'bg-[#101114] text-[#9299A5] border-white/10 hover:text-white'
                    }`}
                  >
                    {st.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* GRÁFICO INTERACTIVO: Diagrama Tiempo–Estación (Marey) del Ramal Mitre */}
        <section className="rounded-2xl bg-[#202329] border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFF19A]" />
                <h2 className="text-sm sm:text-base font-black text-white">
                  Gráfico Interactivo del Corredor · {TRAIN_DIRECTION_LABELS[direction].label}
                </h2>
              </div>
              <p className="text-[11px] text-[#9299A5] mt-0.5">
                Recorrido horario de cada tren desde las 02:00 hs hasta las 01:00 hs · Pasá el cursor o tocá cualquier línea/nodo para inspeccionar Tren N°, Ciudad y Combinación a Retiro
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-[#B7F36B]">
                <span className="w-3 h-0.5 bg-[#B7F36B] rounded-full inline-block" />
                Combina c/ Retiro
              </span>
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <span className="w-3 h-0.5 bg-sky-400 rounded-full inline-block" />
                Sin comb. Retiro
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#FFF19A]">
                <span className="w-3 h-1 bg-[#FFF19A] rounded-full inline-block" />
                Tren Seleccionado
              </span>
            </div>
          </div>

          <div className="relative rounded-xl bg-[#101114] border border-white/10 overflow-x-auto">
            <div className="min-w-[740px] relative">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full h-auto select-none"
                role="img"
                aria-label="Gráfico interactivo horario de trenes Villa Ballester a Zárate"
              >
                {/* Franja destacada para la estación enfocada */}
                <rect
                  x={PAD_L}
                  y={stationToY(focusedStationMeta.kmOrder) - 12}
                  width={PLOT_W}
                  height={24}
                  fill="rgba(255, 241, 154, 0.08)"
                />

                {/* Guías horizontales por estación */}
                {TRAIN_STATIONS_ORDER_ASC.map((st) => {
                  const y = stationToY(st.kmOrder);
                  const isFocused = st.id === focusedStationId;
                  const isKeyHub = st.id === 'campana' || st.id === 'zarate' || st.id === 'villa_ballester';
                  return (
                    <g key={st.id}>
                      <line
                        x1={PAD_L}
                        y1={y}
                        x2={SVG_W - PAD_R}
                        y2={y}
                        stroke={isFocused ? 'rgba(255,241,154,0.45)' : 'rgba(255,255,255,0.07)'}
                        strokeWidth={isFocused ? 1.3 : 1}
                      />
                      <text
                        x={PAD_L - 10}
                        y={y + 4}
                        textAnchor="end"
                        fill={isFocused ? '#FFF19A' : isKeyHub ? '#E2E8F0' : '#9299A5'}
                        fontSize={isFocused ? '11.5' : '10.5'}
                        fontWeight={isFocused ? '800' : isKeyHub ? '700' : '500'}
                        className="cursor-pointer"
                        onClick={() => setFocusedStationId(st.id)}
                      >
                        {st.shortName}
                      </text>
                    </g>
                  );
                })}

                {/* Marcas horarias eje X */}
                {hourTicks.map((hr) => {
                  const x = minsToX(hr * 60);
                  const label = hr === 24 ? '00h' : `${String(hr).padStart(2, '0')}h`;
                  return (
                    <g key={hr}>
                      <line
                        x1={x}
                        y1={PAD_T}
                        x2={x}
                        y2={SVG_H - PAD_B}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={SVG_H - 12}
                        textAnchor="middle"
                        fill="#9299A5"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Línea de hora actual ("Ahora") */}
                {nowLineX !== null && (
                  <g>
                    <line
                      x1={nowLineX}
                      y1={PAD_T - 6}
                      x2={nowLineX}
                      y2={SVG_H - PAD_B}
                      stroke="#FFF19A"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <rect
                      x={nowLineX - 22}
                      y={4}
                      width={44}
                      height={16}
                      rx={4}
                      fill="#FFF19A"
                    />
                    <text
                      x={nowLineX}
                      y={15}
                      textAnchor="middle"
                      fill="#101114"
                      fontSize="9"
                      fontWeight="900"
                    >
                      AHORA
                    </text>
                  </g>
                )}

                {/* Curvas de cada Tren */}
                {filteredServices.map((service) => {
                  const hint = getServiceStartHourHint(service);
                  const ordered =
                    service.direction === 'hacia_zarate'
                      ? TRAIN_STATIONS_ORDER_ASC
                      : [...TRAIN_STATIONS_ORDER_ASC].reverse();

                  const points: {
                    x: number;
                    y: number;
                    stationId: string;
                    stationName: string;
                    timeStr: string;
                  }[] = [];

                  ordered.forEach((st) => {
                    const t = service.stops[st.id];
                    if (!t) return;
                    const m = parseTrainMinutes(t, hint);
                    if (m === null) return;
                    points.push({
                      x: minsToX(m),
                      y: stationToY(st.kmOrder),
                      stationId: st.id,
                      stationName: st.name,
                      timeStr: t,
                    });
                  });

                  if (points.length < 2) return null;

                  const polylineStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                  const isSelected = selectedService?.id === service.id;
                  const isHovered = hoveredChartPoint?.service.id === service.id;
                  const hasCombo = Boolean(service.retiroTime);

                  const strokeColor = isSelected
                    ? '#FFF19A'
                    : isHovered
                    ? '#FFFFFF'
                    : hasCombo
                    ? '#B7F36B'
                    : '#38BDF8';

                  const topPoint = points[0];

                  return (
                    <g
                      key={service.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedServiceId(service.id)}
                    >
                      {/* Área táctil invisible más ancha */}
                      <polyline
                        points={polylineStr}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        onMouseEnter={() => {
                          const focusPt =
                            points.find((p) => p.stationId === focusedStationId) ?? topPoint;
                          setHoveredChartPoint({
                            service,
                            stationId: focusPt.stationId,
                            stationName: focusPt.stationName,
                            timeStr: focusPt.timeStr,
                            xPct: (focusPt.x / SVG_W) * 100,
                            yPct: (focusPt.y / SVG_H) * 100,
                          });
                        }}
                        onMouseLeave={() => setHoveredChartPoint(null)}
                      />
                      <polyline
                        points={polylineStr}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 3 : isHovered ? 2.6 : 1.75}
                        strokeOpacity={isSelected || isHovered ? 1 : 0.72}
                        strokeDasharray={service.isPartialEscobar ? '5 3' : undefined}
                      />

                      {/* Etiqueta superior con N° de Tren */}
                      <text
                        x={topPoint.x}
                        y={topPoint.y - 7}
                        textAnchor="middle"
                        fill={strokeColor}
                        fontSize={isSelected || isHovered ? '10' : '8.5'}
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        {service.trainNo}
                      </text>

                      {/* Nodos por estación */}
                      {points.map((pt) => {
                        const isFocusNode = pt.stationId === focusedStationId;
                        const isPtHovered =
                          isHovered && hoveredChartPoint?.stationId === pt.stationId;
                        const ptDiff = getStopDiffMinutes(pt.timeStr, hint);
                        const ptTier = getProximityTier(ptDiff);
                        const hasLivePulse =
                          ptTier === 'arrived_now' ||
                          ptTier === 'imminent' ||
                          ptTier === 'approaching';
                        const liveColor =
                          ptTier === 'arrived_now'
                            ? '#22C55E'
                            : ptTier === 'imminent'
                            ? '#FFF19A'
                            : '#FB923C';
                        return (
                          <g key={`${service.id}-${pt.stationId}`}>
                            {hasLivePulse && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={ptTier === 'arrived_now' ? 8.5 : 6.5}
                                fill="none"
                                stroke={liveColor}
                                strokeWidth={ptTier === 'arrived_now' ? 2 : 1.5}
                                className="animate-pulse"
                              />
                            )}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={
                                ptTier === 'arrived_now'
                                  ? 5
                                  : isPtHovered
                                  ? 5.5
                                  : isSelected && isFocusNode
                                  ? 5
                                  : isFocusNode
                                  ? 3.5
                                  : 2.3
                              }
                              fill={
                                ptTier === 'arrived_now'
                                  ? '#22C55E'
                                  : ptTier === 'imminent'
                                  ? '#FFF19A'
                                  : isFocusNode || isSelected
                                  ? '#FFF19A'
                                  : strokeColor
                              }
                              stroke="#101114"
                              strokeWidth={1}
                              onMouseEnter={() =>
                                setHoveredChartPoint({
                                  service,
                                  stationId: pt.stationId,
                                  stationName: pt.stationName,
                                  timeStr: pt.timeStr,
                                  xPct: (pt.x / SVG_W) * 100,
                                  yPct: (pt.y / SVG_H) * 100,
                                })
                              }
                              onMouseLeave={() => setHoveredChartPoint(null)}
                            />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip flotante analítico al hacer hover en el gráfico */}
              {hoveredChartPoint && (
                <div
                  className="pointer-events-none absolute z-20 px-3 py-2 rounded-xl bg-[#202329]/95 border border-[#FFF19A]/70 shadow-xl text-xs max-w-[260px]"
                  style={{
                    left: `${Math.min(72, Math.max(14, hoveredChartPoint.xPct))}%`,
                    top: `${Math.max(8, hoveredChartPoint.yPct - 18)}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-[#FFF19A]">
                      Tren N° {hoveredChartPoint.service.trainNo}
                    </span>
                    <span className="font-mono font-black text-white">
                      {hoveredChartPoint.timeStr} hs
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-sky-300 mt-0.5">
                    Estación: {hoveredChartPoint.stationName}
                  </div>
                  <div className="text-[10.5px] text-[#B7F36B] font-semibold mt-1">
                    {getRetiroComboSuggestion(hoveredChartPoint.service).summary}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Inspector Detallado del Tren Seleccionado + Combinación a Retiro */}
        {selectedService && selectedCombo && (
          <section className="rounded-2xl bg-[#202329] border border-[#FFF19A]/35 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-[#FFF19A] text-[#101114] font-mono font-black text-xs">
                    Tren N° {selectedService.trainNo}
                  </span>
                  <span className="text-xs font-bold text-sky-300">
                    {TRAIN_DAY_LABELS[selectedService.dayType].label} ·{' '}
                    {TRAIN_DIRECTION_LABELS[selectedService.direction].routeSubtitle}
                  </span>
                  {selectedService.isPartialEscobar && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[10px] font-extrabold">
                      Servicio Corto (tramo Villa Ballester ↔ Escobar)
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9299A5] mt-1.5">
                  Horarios parada por parada y estado de combinación ferroviaria en Villa Ballester
                </p>
              </div>

              {/* Tarjeta inteligente de Combinación con Retiro */}
              <div
                className={`rounded-xl border px-3.5 py-2.5 max-w-md ${
                  selectedCombo.hasCombo
                    ? 'bg-[#B7F36B]/10 border-[#B7F36B]/50 text-[#B7F36B]'
                    : 'bg-[#101114] border-white/10 text-[#9299A5]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-black">
                  {selectedCombo.hasCombo ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{selectedCombo.summary}</span>
                </div>
                <p className="text-[11px] opacity-90 mt-1 leading-snug text-white/90">
                  {selectedCombo.detail}
                </p>
              </div>
            </div>

            {/* Línea de ruta horizontal de las 11 ciudades con seguimiento horario en vivo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
              {orderedStationsForTable.map((st, idx) => {
                const t = selectedService.stops[st.id];
                const isFocused = st.id === focusedStationId;
                const hint = getServiceStartHourHint(selectedService);
                const diffMins = getStopDiffMinutes(t, hint);
                const tier = getProximityTier(diffMins);

                const cardColorClass =
                  tier === 'arrived_now'
                    ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/70 animate-pulse shadow-[0_0_16px_rgba(34,197,94,0.45)]'
                    : tier === 'imminent'
                    ? 'bg-[#FFF19A]/20 border-[#FFF19A] ring-1 ring-[#FFF19A]/70 animate-pulse'
                    : tier === 'approaching'
                    ? 'bg-orange-500/20 border-orange-400/70 animate-pulse'
                    : tier === 'upcoming'
                    ? 'bg-sky-500/15 border-sky-400/60'
                    : isFocused
                    ? 'bg-[#FFF19A]/15 border-[#FFF19A] ring-1 ring-[#FFF19A]/40'
                    : t
                    ? 'bg-[#101114] border-white/10 hover:border-white/25'
                    : 'bg-[#101114]/40 border-white/5 opacity-50';

                const timeTextClass =
                  tier === 'arrived_now'
                    ? 'text-emerald-300'
                    : tier === 'imminent'
                    ? 'text-[#FFF19A]'
                    : tier === 'approaching'
                    ? 'text-orange-300'
                    : tier === 'upcoming'
                    ? 'text-sky-300'
                    : t
                    ? isFocused
                      ? 'text-[#B7F36B]'
                      : 'text-sky-300'
                    : 'text-[#9299A5]';

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setFocusedStationId(st.id)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${cardColorClass}`}
                  >
                    <div className="flex items-center justify-between text-[9.5px] font-mono text-[#9299A5]">
                      <span>#{idx + 1}</span>
                      {tier === 'arrived_now' ? (
                        <span className="text-[9px] font-black text-emerald-300">● AHORA</span>
                      ) : tier === 'imminent' || tier === 'approaching' || tier === 'upcoming' ? (
                        <span
                          className={`text-[9px] font-black ${
                            tier === 'imminent'
                              ? 'text-[#FFF19A]'
                              : tier === 'approaching'
                              ? 'text-orange-300'
                              : 'text-sky-300'
                          }`}
                        >
                          {diffMins}m
                        </span>
                      ) : idx < orderedStationsForTable.length - 1 ? (
                        <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                      ) : null}
                    </div>
                    <div
                      className={`text-[11px] font-extrabold truncate mt-0.5 ${
                        tier === 'arrived_now'
                          ? 'text-emerald-200'
                          : isFocused
                          ? 'text-[#FFF19A]'
                          : 'text-white'
                      }`}
                    >
                      {st.shortName}
                    </div>
                    <div className={`text-sm font-mono tabular-nums font-black mt-0.5 ${timeTextClass}`}>
                      {t ?? '----'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tabla Completa Interactiva (Transcripción oficial fiel + Seguimiento Titilante por Hora Actual) */}
        <section className="rounded-2xl bg-[#202329] border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-black text-white">
                    Grilla Horaria Completa · {TRAIN_DAY_LABELS[dayType].label} ·{' '}
                    {TRAIN_DIRECTION_LABELS[direction].label}
                  </h2>
                  {isLiveTodaySchedule ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[10px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      SEGUIMIENTO EN VIVO · {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-[#101114] border border-white/15 text-[#9299A5] text-[10px] font-bold">
                      Referencia ({TRAIN_DAY_LABELS[dayType].shortLabel}) · Hoy es {TRAIN_DAY_LABELS[todayDayType].shortLabel}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#9299A5] mt-0.5">
                  Los horarios titilan según cercanía a la hora actual hasta ponerse en <strong className="text-emerald-400">VERDE</strong> al coincidir con la estación donde va el tren
                </p>
              </div>
            </div>

            {/* Leyenda de colores titilantes por cercanía horaria */}
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/60 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Verde titilando: En estación ahora
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#FFF19A]/15 border border-[#FFF19A]/60 text-[#FFF19A]">
                <span className="w-2 h-2 rounded-full bg-[#FFF19A] animate-pulse" />
                Amarillo titilando: 1–5 min
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/15 border border-orange-400/60 text-orange-300">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                Naranja titilando: 6–15 min
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-400/50 text-sky-300">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Celeste: 16–30 min
              </span>
            </div>

            {isLiveTodaySchedule && activeInTransitServices.length > 0 && (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/40 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-black text-emerald-300 flex items-center gap-1.5">
                  <TrainFront className="w-3.5 h-3.5" />
                  Trenes circulando ahora en este sentido:
                </span>
                {activeInTransitServices.map((srv) => {
                  const hint = getServiceStartHourHint(srv);
                  const currentOrNextStop = orderedStationsForTable.find((st) => {
                    const diff = getStopDiffMinutes(srv.stops[st.id], hint);
                    return diff !== null && diff >= -1;
                  });
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedServiceId(srv.id)}
                      className="px-2 py-0.5 rounded-lg bg-[#101114] border border-emerald-400/60 text-emerald-200 font-mono font-bold text-[11px] hover:bg-emerald-500/20 cursor-pointer transition-colors"
                    >
                      Tren {srv.trainNo}
                      {currentOrNextStop
                        ? ` → ${currentOrNextStop.shortName} (${srv.stops[currentOrNextStop.id]})`
                        : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#101114] border-b border-white/10 text-[10.5px] uppercase tracking-wider text-[#9299A5]">
                  {direction === 'hacia_zarate' && (
                    <th className="py-2.5 px-3 font-black text-[#B7F36B] whitespace-nowrap">
                      Desde Retiro
                    </th>
                  )}
                  <th className="py-2.5 px-3 font-black text-sky-300 whitespace-nowrap sticky left-0 bg-[#101114] z-10 border-r border-white/10">
                    Tren N°
                  </th>
                  {orderedStationsForTable.map((st) => {
                    const isFocused = st.id === focusedStationId;
                    return (
                      <th
                        key={st.id}
                        onClick={() => setFocusedStationId(st.id)}
                        className={`py-2.5 px-2.5 font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                          isFocused
                            ? 'text-[#FFF19A] bg-[#FFF19A]/10'
                            : st.id === 'campana' || st.id === 'zarate'
                            ? 'text-white'
                            : 'text-[#9299A5] hover:text-white'
                        }`}
                      >
                        {st.shortName}
                      </th>
                    );
                  })}
                  {direction === 'hacia_ballester' && (
                    <th className="py-2.5 px-3 font-black text-[#B7F36B] whitespace-nowrap">
                      Comb. a Retiro
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={orderedStationsForTable.length + 2}
                      className="py-8 text-center text-[#9299A5] font-sans"
                    >
                      No hay trenes que coincidan con "{searchQuery}" en este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((s) => {
                    const isSelected = selectedService?.id === s.id;
                    const hint = getServiceStartHourHint(s);
                    const inTransit = isServiceInTransitNow(s);
                    const retiroDiff = getStopDiffMinutes(s.retiroTime, hint);
                    const retiroTier = getProximityTier(retiroDiff);

                    const renderTimeBadge = (
                      timeStr: string | null | undefined,
                      tier: ReturnType<typeof getProximityTier>,
                      diffMins: number | null,
                      isFocusedCol: boolean,
                      isRetiroCol = false
                    ) => {
                      if (!timeStr) {
                        return <span className="text-[#9299A5]/50">----</span>;
                      }
                      if (tier === 'arrived_now') {
                        return (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400 text-emerald-200 font-black animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                            <span>{timeStr}</span>
                          </span>
                        );
                      }
                      if (tier === 'imminent') {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFF19A]/25 border border-[#FFF19A] text-[#FFF19A] font-black animate-pulse shadow-[0_0_10px_rgba(255,241,154,0.4)]"
                            title={`Llega en ${diffMins} min`}
                          >
                            <span>{timeStr}</span>
                            <span className="text-[9px] opacity-90">{diffMins}m</span>
                          </span>
                        );
                      }
                      if (tier === 'approaching') {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-400/75 text-orange-200 font-black animate-pulse"
                            title={`Llega en ${diffMins} min`}
                          >
                            <span>{timeStr}</span>
                            <span className="text-[9px] opacity-90">{diffMins}m</span>
                          </span>
                        );
                      }
                      if (tier === 'upcoming') {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/60 text-sky-200 font-extrabold animate-pulse"
                            title={`Llega en ${diffMins} min`}
                          >
                            <span>{timeStr}</span>
                            <span className="text-[9px] opacity-85">{diffMins}m</span>
                          </span>
                        );
                      }
                      if (isRetiroCol) {
                        return <span className="text-[#B7F36B]">{timeStr}</span>;
                      }
                      if (isFocusedCol) {
                        return <span className="font-black text-[#FFF19A]">{timeStr}</span>;
                      }
                      return <span className="font-semibold">{timeStr}</span>;
                    };

                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedServiceId(s.id)}
                        className={`cursor-pointer transition-colors ${
                          inTransit
                            ? 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] text-white'
                            : isSelected
                            ? 'bg-[#FFF19A]/15 text-white'
                            : 'hover:bg-white/[0.04] text-slate-200'
                        }`}
                      >
                        {direction === 'hacia_zarate' && (
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {renderTimeBadge(s.retiroTime, retiroTier, retiroDiff, false, true)}
                          </td>
                        )}
                        <td
                          className={`py-2.5 px-3 font-black whitespace-nowrap sticky left-0 z-10 border-r border-white/10 ${
                            inTransit
                              ? 'bg-[#13251d] text-emerald-300'
                              : isSelected
                              ? 'bg-[#2a2c24] text-[#FFF19A]'
                              : 'bg-[#191c21] text-sky-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {inTransit && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"
                                title="Tren en circulación ahora"
                              />
                            )}
                            <span>{s.trainNo}</span>
                          </div>
                        </td>
                        {orderedStationsForTable.map((st) => {
                          const t = s.stops[st.id];
                          const isFocused = st.id === focusedStationId;
                          const stopDiff = getStopDiffMinutes(t, hint);
                          const stopTier = getProximityTier(stopDiff);
                          return (
                            <td
                              key={st.id}
                              className={`py-2 px-2 whitespace-nowrap ${
                                isFocused ? 'bg-[#FFF19A]/10' : ''
                              }`}
                            >
                              {renderTimeBadge(t, stopTier, stopDiff, isFocused, false)}
                            </td>
                          );
                        })}
                        {direction === 'hacia_ballester' && (
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {renderTimeBadge(s.retiroTime, retiroTier, retiroDiff, false, true)}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
