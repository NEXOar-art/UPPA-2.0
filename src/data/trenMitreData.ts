export type TrainDayType = 'lunes_viernes' | 'sabados' | 'domingos_feriados';
export type TrainDirection = 'hacia_zarate' | 'hacia_ballester';

export interface TrainStationMeta {
  id: string;
  name: string;
  shortName: string;
  kmOrder: number; // 0 (Villa Ballester) -> 10 (Zárate)
  isHighlightedCity?: boolean;
  zoneLabel: string;
}

export const TRAIN_STATIONS_ORDER_ASC: TrainStationMeta[] = [
  { id: 'villa_ballester', name: 'Villa Ballester', shortName: 'V. Ballester', kmOrder: 0, zoneLabel: 'Combinación a Retiro' },
  { id: 'bancalari', name: 'Bancalari', shortName: 'Bancalari', kmOrder: 1, zoneLabel: 'GBA Norte' },
  { id: 'pacheco', name: 'Pacheco', shortName: 'Pacheco', kmOrder: 2, zoneLabel: 'Tigre' },
  { id: 'benavidez', name: 'Benavídez', shortName: 'Benavídez', kmOrder: 3, zoneLabel: 'Tigre' },
  { id: 'maschwitz', name: 'Maschwitz', shortName: 'Maschwitz', kmOrder: 4, zoneLabel: 'Escobar' },
  { id: 'escobar', name: 'Escobar', shortName: 'Escobar', kmOrder: 5, isHighlightedCity: true, zoneLabel: 'Cabecera Intermedia' },
  { id: 'rio_lujan', name: 'Río Luján', shortName: 'Río Luján', kmOrder: 6, zoneLabel: 'Campana Sur' },
  { id: 'otamendi', name: 'Otamendi', shortName: 'Otamendi', kmOrder: 7, zoneLabel: 'Campana' },
  { id: 'campana', name: 'Campana', shortName: 'Campana', kmOrder: 8, isHighlightedCity: true, zoneLabel: 'Estación Campana' },
  { id: 'km83', name: 'Km. 83', shortName: 'Km. 83', kmOrder: 9, zoneLabel: 'Zárate Acceso' },
  { id: 'zarate', name: 'Zárate', shortName: 'Zárate', kmOrder: 10, isHighlightedCity: true, zoneLabel: 'Terminal Zárate' },
];

export const TRAIN_DAY_LABELS: Record<TrainDayType, { label: string; shortLabel: string }> = {
  lunes_viernes: { label: 'Lunes a viernes', shortLabel: 'Lun a Vie' },
  sabados: { label: 'Sábados', shortLabel: 'Sábados' },
  domingos_feriados: { label: 'Domingos y feriados', shortLabel: 'Dom y Fer.' },
};

export const TRAIN_DIRECTION_LABELS: Record<
  TrainDirection,
  { label: string; routeSubtitle: string; retiroActionLabel: string }
> = {
  hacia_zarate: {
    label: 'Trenes a Escobar / Zárate',
    routeSubtitle: 'Villa Ballester → Campana → Zárate',
    retiroActionLabel: 'Sale de Retiro para combinar en V. Ballester',
  },
  hacia_ballester: {
    label: 'Trenes a Villa Ballester',
    routeSubtitle: 'Zárate → Campana → Villa Ballester',
    retiroActionLabel: 'Combinación en V. Ballester hacia Retiro',
  },
};

export interface TrainServiceEntry {
  id: string;
  trainNo: string;
  dayType: TrainDayType;
  direction: TrainDirection;
  retiroTime: string | null; // "Desde Retiro" (hacia_zarate) o "a Retiro" (hacia_ballester)
  stops: Record<string, string | null>; // stationId -> "HH:MM" | null
  isPartialEscobar: boolean;
}

type RawRowAsc = [
  retiroTime: string | null,
  trainNo: string,
  villa_ballester: string | null,
  bancalari: string | null,
  pacheco: string | null,
  benavidez: string | null,
  maschwitz: string | null,
  escobar: string | null,
  rio_lujan: string | null,
  otamendi: string | null,
  campana: string | null,
  km83: string | null,
  zarate: string | null
];

type RawRowDesc = [
  trainNo: string,
  zarate: string | null,
  km83: string | null,
  campana: string | null,
  otamendi: string | null,
  rio_lujan: string | null,
  escobar: string | null,
  maschwitz: string | null,
  benavidez: string | null,
  pacheco: string | null,
  bancalari: string | null,
  villa_ballester: string | null,
  retiroTime: string | null
];

function buildAscEntries(dayType: TrainDayType, rows: RawRowAsc[]): TrainServiceEntry[] {
  return rows.map((r) => {
    const [
      retiroTime,
      trainNo,
      villa_ballester,
      bancalari,
      pacheco,
      benavidez,
      maschwitz,
      escobar,
      rio_lujan,
      otamendi,
      campana,
      km83,
      zarate,
    ] = r;
    const isPartialEscobar = zarate === null || campana === null;
    return {
      id: `${dayType}-hacia_zarate-${trainNo}`,
      trainNo,
      dayType,
      direction: 'hacia_zarate',
      retiroTime,
      isPartialEscobar,
      stops: {
        villa_ballester,
        bancalari,
        pacheco,
        benavidez,
        maschwitz,
        escobar,
        rio_lujan,
        otamendi,
        campana,
        km83,
        zarate,
      },
    };
  });
}

function buildDescEntries(dayType: TrainDayType, rows: RawRowDesc[]): TrainServiceEntry[] {
  return rows.map((r) => {
    const [
      trainNo,
      zarate,
      km83,
      campana,
      otamendi,
      rio_lujan,
      escobar,
      maschwitz,
      benavidez,
      pacheco,
      bancalari,
      villa_ballester,
      retiroTime,
    ] = r;
    const isPartialEscobar = zarate === null || campana === null;
    return {
      id: `${dayType}-hacia_ballester-${trainNo}`,
      trainNo,
      dayType,
      direction: 'hacia_ballester',
      retiroTime,
      isPartialEscobar,
      stops: {
        villa_ballester,
        bancalari,
        pacheco,
        benavidez,
        maschwitz,
        escobar,
        rio_lujan,
        otamendi,
        campana,
        km83,
        zarate,
      },
    };
  });
}

// ============================================================================
// DATOS TRANSCRITOS EXACTOS · SERVICIO VILLA BALLESTER - ZÁRATE (14/09/26)
// ============================================================================

const LUNES_VIERNES_HACIA_ZARATE: RawRowAsc[] = [
  [null, '2501', '02:00', '02:12', '02:17', '02:26', '02:33', '02:46', '03:01', '03:09', '03:20', '03:26', '03:38'],
  [null, '2505', '04:05', '04:17', '04:22', '04:31', '04:38', '04:51', '05:06', '05:14', '05:25', '05:31', '05:43'],
  [null, '2509', '05:55', '06:07', '06:12', '06:21', '06:28', '06:41', '06:56', '07:04', '07:15', '07:21', '07:33'],
  ['07:25', '2513', '08:16', '08:28', '08:33', '08:42', '08:49', '09:02', '09:17', '09:25', '09:36', '09:42', '09:54'],
  ['09:13', '2517', '10:05', '10:17', '10:22', '10:31', '10:38', '10:51', '11:06', '11:14', '11:25', '11:31', '11:43'],
  ['11:37', '2521', '12:29', '12:41', '12:46', '12:55', '13:02', '13:15', '13:30', '13:38', '13:49', '13:55', '14:07'],
  ['13:25', '2523', '14:17', '14:29', '14:34', '14:43', '14:50', '15:03', '15:18', '15:26', '15:37', '15:43', '15:55'],
  ['15:49', '2527', '16:40', '16:52', '16:57', '17:06', '17:13', '17:26', '17:41', '17:49', '18:00', '18:06', '18:18'],
  ['17:55', '2531', '18:46', '18:58', '19:03', '19:12', '19:19', '19:32', '19:47', '19:55', '20:06', '20:12', '20:24'],
  ['20:19', '2535', '21:10', '21:22', '21:27', '21:36', '21:43', '21:56', '22:11', '22:19', '22:30', '22:36', '22:48'],
];

const LUNES_VIERNES_HACIA_BALLESTER: RawRowDesc[] = [
  ['2504', '03:54', '04:06', '04:12', '04:23', '04:31', '04:44', '04:57', '05:05', '05:15', '05:20', '05:32', '05:42'],
  ['2508', '06:06', '06:18', '06:24', '06:35', '06:43', '06:56', '07:09', '07:17', '07:27', '07:32', '07:44', '07:52'],
  ['2512', '08:12', '08:24', '08:30', '08:41', '08:49', '09:02', '09:15', '09:23', '09:33', '09:38', '09:50', '09:58'],
  ['2516', '10:36', '10:48', '10:54', '11:05', '11:13', '11:26', '11:39', '11:47', '11:57', '12:02', '12:14', '12:22'],
  ['2518', '12:06', '12:18', '12:24', '12:35', '12:43', '12:56', '13:09', '13:17', '13:27', '13:32', '13:44', '13:52'],
  ['2522', '14:30', '14:42', '14:48', '14:59', '15:07', '15:20', '15:33', '15:41', '15:51', '15:56', '16:08', '16:16'],
  ['2526', '16:36', '16:48', '16:54', '17:05', '17:13', '17:26', '17:39', '17:47', '17:57', '18:02', '18:14', '18:22'],
  ['2530', '18:42', '18:54', '19:00', '19:11', '19:19', '19:32', '19:45', '19:53', '20:03', '20:08', '20:20', '20:28'],
  ['2534', '20:55', '21:07', '21:13', '21:24', '21:32', '21:45', '21:58', '22:06', '22:16', '22:21', '22:33', null],
  ['2538', '23:10', '23:22', '23:28', '23:39', '23:47', '00:00', '00:13', '00:21', '00:31', '00:36', '00:48', null],
];

const SABADOS_HACIA_ZARATE: RawRowAsc[] = [
  [null, '2501', '02:05', '02:17', '02:22', '02:31', '02:38', '02:51', '03:06', '03:14', '03:25', '03:31', '03:43'],
  [null, '2503', '04:05', '04:17', '04:22', '04:31', '04:38', '04:51', '05:06', '05:14', '05:25', '05:31', '05:43'],
  [null, '2507', '06:15', '06:27', '06:32', '06:41', '06:48', '07:01', '07:16', '07:24', '07:35', '07:41', '07:53'],
  ['07:30', '2511', '08:23', '08:35', '08:40', '08:49', '08:56', '09:09', '09:24', '09:32', '09:43', '09:49', '10:01'],
  ['09:34', '2513', '10:30', '10:42', '10:47', '10:56', '11:03', '11:16', '11:31', '11:39', '11:50', '11:56', '12:08'],
  ['11:36', '2515', '12:45', '12:57', '13:02', '13:11', '13:18', '13:31', '13:46', '13:54', '14:05', '14:11', '14:23'],
  ['14:10', '2517', '15:01', '15:13', '15:18', '15:27', '15:34', '15:47', '16:02', '16:10', '16:21', '16:27', '16:39'],
  ['16:10', '2519', '17:01', '17:13', '17:18', '17:27', '17:34', '17:47', '18:02', '18:10', '18:21', '18:27', '18:39'],
  ['18:22', '2523', '19:13', '19:25', '19:30', '19:39', '19:46', '19:59', '20:14', '20:22', '20:33', '20:39', '20:51'],
  ['20:00', '2525', '21:05', '21:17', '21:22', '21:31', '21:38', '21:51', '22:06', '22:14', '22:25', '22:31', '22:43'],
];

const SABADOS_HACIA_BALLESTER: RawRowDesc[] = [
  ['2502', '04:00', '04:12', '04:18', '04:29', '04:37', '04:50', '05:03', '05:11', '05:21', '05:26', '05:38', null],
  ['2506', '06:00', '06:12', '06:18', '06:29', '06:37', '06:50', '07:03', '07:11', '07:21', '07:26', '07:38', '07:46'],
  ['2510', '08:28', '08:40', '08:46', '08:57', '09:05', '09:18', '09:31', '09:39', '09:49', '09:54', '10:06', '10:16'],
  ['2512', '10:32', '10:44', '10:50', '11:01', '11:09', '11:22', '11:35', '11:43', '11:53', '11:58', '12:10', '12:21'],
  ['2514', '12:45', '12:57', '13:03', '13:14', '13:22', '13:35', '13:48', '13:56', '14:06', '14:11', '14:23', '14:33'],
  ['2516', '14:46', '14:58', '15:04', '15:15', '15:23', '15:36', '15:49', '15:57', '16:07', '16:12', '16:24', '16:35'],
  ['2518', '17:13', '17:25', '17:31', '17:42', '17:50', '18:03', '18:16', '18:24', '18:34', '18:39', '18:51', '19:00'],
  ['2522', '18:58', '19:10', '19:16', '19:27', '19:35', '19:48', '20:01', '20:09', '20:19', '20:24', '20:36', '20:46'],
  ['2524', '21:17', '21:29', '21:35', '21:46', '21:54', '22:07', '22:20', '22:28', '22:38', '22:43', '22:55', null],
  ['2528', '23:10', '23:22', '23:28', '23:39', '23:47', '00:00', '00:13', '00:21', '00:31', '00:36', '00:48', null],
];

const DOMINGOS_HACIA_ZARATE: RawRowAsc[] = [
  [null, '2501', '02:05', '02:17', '02:22', '02:31', '02:38', '02:51', '03:06', '03:14', '03:25', '03:31', '03:43'],
  [null, '2503', '04:10', '04:22', '04:27', '04:36', '04:43', '04:56', '05:11', '05:19', '05:30', '05:36', '05:48'],
  [null, '2505', '06:15', '06:27', '06:32', '06:41', '06:48', '07:01', '07:16', '07:24', '07:35', '07:41', '07:53'],
  ['07:30', '2507', '08:22', '08:34', '08:39', '08:48', '08:55', '09:08', '09:23', '09:31', '09:42', '09:48', '10:00'],
  ['09:34', '2509', '10:27', '10:39', '10:44', '10:53', '11:00', '11:13', '11:28', '11:36', '11:47', '11:53', '12:05'],
  ['11:42', '2511', '12:33', '12:45', '12:50', '12:59', '13:06', '13:19', '13:34', '13:42', '13:53', '13:59', '14:11'],
  ['13:46', '2513', '14:38', '14:50', '14:55', '15:04', '15:11', '15:24', '15:39', '15:47', '15:58', '16:04', '16:16'],
  ['15:50', '2515', '16:42', '16:54', '16:59', '17:08', '17:15', '17:28', '17:43', '17:51', '18:02', '18:08', '18:20'],
  ['17:55', '2517', '18:47', '18:59', '19:04', '19:13', '19:20', '19:33', '19:48', '19:56', '20:07', '20:13', '20:25'],
  ['20:26', '2519', '21:17', '21:29', '21:34', '21:43', '21:50', '22:03', '22:18', '22:26', '22:37', '22:43', '22:55'],
  ['21:38', '2721', '22:40', '22:52', '22:57', '23:06', '23:13', '23:25', null, null, null, null, null],
];

const DOMINGOS_HACIA_BALLESTER: RawRowDesc[] = [
  ['2502', '04:00', '04:12', '04:18', '04:29', '04:37', '04:50', '05:03', '05:11', '05:21', '05:26', '05:38', null],
  ['2504', '06:12', '06:24', '06:30', '06:41', '06:49', '07:02', '07:15', '07:23', '07:33', '07:38', '07:50', '08:00'],
  ['2506', '08:28', '08:40', '08:46', '08:57', '09:05', '09:18', '09:31', '09:39', '09:49', '09:54', '10:06', '10:16'],
  ['2508', '10:32', '10:44', '10:50', '11:01', '11:09', '11:22', '11:35', '11:43', '11:53', '11:58', '12:10', '12:24'],
  ['2510', '12:40', '12:52', '12:58', '13:09', '13:17', '13:30', '13:43', '13:51', '14:01', '14:06', '14:18', '14:33'],
  ['2512', '14:43', '14:55', '15:01', '15:12', '15:20', '15:33', '15:46', '15:54', '16:04', '16:09', '16:21', '16:35'],
  ['2514', '16:48', '17:00', '17:06', '17:17', '17:25', '17:38', '17:51', '17:59', '18:09', '18:14', '18:26', '18:38'],
  ['2516', '18:51', '19:03', '19:09', '19:20', '19:28', '19:41', '19:54', '20:02', '20:12', '20:17', '20:29', '20:45'],
  ['2518', '20:43', '20:55', '21:01', '21:12', '21:20', '21:33', '21:46', '21:54', '22:04', '22:09', '22:21', null],
  ['2720', null, null, null, null, null, '23:40', '23:52', '00:00', '00:10', '00:15', '00:27', null],
  ['2522', '23:20', '23:32', '23:38', '23:49', '23:57', '00:10', '00:23', '00:31', '00:41', '00:46', '00:58', null],
];

export const ALL_MITRE_TRAIN_SERVICES: TrainServiceEntry[] = [
  ...buildAscEntries('lunes_viernes', LUNES_VIERNES_HACIA_ZARATE),
  ...buildDescEntries('lunes_viernes', LUNES_VIERNES_HACIA_BALLESTER),
  ...buildAscEntries('sabados', SABADOS_HACIA_ZARATE),
  ...buildDescEntries('sabados', SABADOS_HACIA_BALLESTER),
  ...buildAscEntries('domingos_feriados', DOMINGOS_HACIA_ZARATE),
  ...buildDescEntries('domingos_feriados', DOMINGOS_HACIA_BALLESTER),
];

export function getDefaultTrainDayType(date: Date = new Date()): TrainDayType {
  const day = date.getDay();
  if (day === 0) return 'domingos_feriados';
  if (day === 6) return 'sabados';
  return 'lunes_viernes';
}

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * Si un tren parte tarde (>= 18:00) y llega pasada la medianoche ("00:xx"),
 * suma +1440 para ordenar cronológicamente en gráficos y cálculos de duración.
 */
export function parseTrainMinutes(timeStr: string | null | undefined, serviceFirstHourHint?: number): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  let mins = h * 60 + m;
  if (serviceFirstHourHint !== undefined && serviceFirstHourHint >= 18 && h < 4) {
    mins += 1440;
  }
  return mins;
}

export function getServiceStartHourHint(service: TrainServiceEntry): number {
  const ordered =
    service.direction === 'hacia_zarate'
      ? TRAIN_STATIONS_ORDER_ASC
      : [...TRAIN_STATIONS_ORDER_ASC].reverse();
  for (const st of ordered) {
    const t = service.stops[st.id];
    if (t) {
      return Number(t.split(':')[0]) || 0;
    }
  }
  return 0;
}

export interface RetiroComboSuggestion {
  hasCombo: boolean;
  retiroTime: string | null;
  ballesterTime: string | null;
  waitMinutes: number | null;
  summary: string;
  detail: string;
}

export function getRetiroComboSuggestion(service: TrainServiceEntry): RetiroComboSuggestion {
  const ballesterTime = service.stops.villa_ballester ?? null;
  if (!service.retiroTime || !ballesterTime) {
    return {
      hasCombo: false,
      retiroTime: null,
      ballesterTime,
      waitMinutes: null,
      summary: 'Sin combinación directa a Retiro',
      detail:
        service.direction === 'hacia_zarate'
          ? `Servicio nocturno/madrugada: sale directo desde Villa Ballester (${ballesterTime ?? '—'}).`
          : `Finaliza en Villa Ballester (${ballesterTime ?? '—'}) sin conexión programada hacia Retiro.`,
    };
  }

  const hint = getServiceStartHourHint(service);
  const bMin = parseTrainMinutes(ballesterTime, hint);
  const rMin = parseTrainMinutes(service.retiroTime, hint);
  let waitMinutes: number | null = null;
  if (bMin !== null && rMin !== null) {
    waitMinutes = Math.abs(bMin - rMin);
  }

  if (service.direction === 'hacia_zarate') {
    return {
      hasCombo: true,
      retiroTime: service.retiroTime,
      ballesterTime,
      waitMinutes,
      summary: `Desde Retiro ${service.retiroTime} hs`,
      detail: `Sugerido: abordá en Retiro a las ${service.retiroTime} hs y combiná en Villa Ballester para tomar el Tren N° ${service.trainNo} (${ballesterTime} hs).`,
    };
  }

  return {
    hasCombo: true,
    retiroTime: service.retiroTime,
    ballesterTime,
    waitMinutes,
    summary: `Combina a Retiro ${service.retiroTime} hs`,
    detail: `Sugerido: al llegar a Villa Ballester (${ballesterTime} hs), combiná en ${
      waitMinutes !== null ? `${waitMinutes} min` : 'andén'
    } hacia Retiro (sale ${service.retiroTime} hs).`,
  };
}

export interface UpcomingTrainMatch {
  service: TrainServiceEntry;
  stationTime: string;
  minutesUntil: number;
  combo: RetiroComboSuggestion;
}

export function findNextTrainForStation(
  dayType: TrainDayType,
  direction: TrainDirection,
  stationId: string,
  now: Date = new Date()
): UpcomingTrainMatch | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const candidates = ALL_MITRE_TRAIN_SERVICES.filter(
    (s) => s.dayType === dayType && s.direction === direction && Boolean(s.stops[stationId])
  );

  let best: UpcomingTrainMatch | null = null;
  for (const s of candidates) {
    const tStr = s.stops[stationId];
    if (!tStr) continue;
    const hint = getServiceStartHourHint(s);
    const tMins = parseTrainMinutes(tStr, hint);
    if (tMins === null) continue;
    const diff = tMins - nowMinutes;
    if (diff >= 0 && (!best || diff < best.minutesUntil)) {
      best = {
        service: s,
        stationTime: tStr,
        minutesUntil: diff,
        combo: getRetiroComboSuggestion(s),
      };
    }
  }

  // Si ya pasaron todos los trenes de hoy, mostrar el primero del día siguiente
  if (!best && candidates.length > 0) {
    const first = candidates[0];
    const tStr = first.stops[stationId]!;
    const tMins = parseTrainMinutes(tStr, getServiceStartHourHint(first)) ?? 0;
    return {
      service: first,
      stationTime: tStr,
      minutesUntil: 1440 - nowMinutes + tMins,
      combo: getRetiroComboSuggestion(first),
    };
  }

  return best;
}

export function formatMinutesDelta(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'Saliendo ahora';
  if (minutesUntil < 60) return `en ${minutesUntil} min`;
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}
