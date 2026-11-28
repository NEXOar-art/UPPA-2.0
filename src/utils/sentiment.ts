import { ChatMessage, MapEvent, MensajeChatFirestore } from '../types';
import { LINEA_228_STOPS } from '../data/linea228Stops';
import { getMessageTimestampMs, isRealChatMessage } from '../services/realtimeFirebaseService';

export interface SentimentAnalysis {
  status: 'normal' | 'delayed' | 'critical';
  label: string;
  subtext: string;
  score: number; // 0 (catastrophic) to 100 (smooth)
  delayMinutesEstimated: number;
  positiveRatio: number;
  negativeRatio: number;
  urgentAlertsCount: number;
  confidenceScore: number;
}

export type LiveSentimentTone = 'sin_datos' | 'positivo' | 'neutro' | 'alerta' | 'critico';

export type ChatInsightCategory =
  | 'delay_direction'
  | 'passing_location'
  | 'fare_price'
  | 'sube_status'
  | 'transport_news'
  | 'transport_issue'
  | 'service_ok';

export interface ExtractedChatInsight {
  id: string;
  category: ChatInsightCategory;
  badge: string;
  title: string;
  excerpt: string;
  author: string;
  timestampMs: number;
  ageLabel: string;
  direction?: 'hacia_zarate' | 'hacia_malvinas' | 'general';
  severity: 'positive' | 'info' | 'warning' | 'critical';
  source: 'chat' | 'event';
}

export interface LiveCommunitySentimentReport {
  hasRealData: boolean;
  tone: LiveSentimentTone;
  statusBadge: string;
  statusShortLabel: string;
  score: number | null;
  evaluatedChatCount: number;
  userChatCount: number;
  activeEventsCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  estimatedDelayMinutes: number | null;
  delaysByDirection: {
    haciaZarate: ExtractedChatInsight | null;
    haciaMalvinas: ExtractedChatInsight | null;
    general: ExtractedChatInsight | null;
  };
  latestPassingLocation: ExtractedChatInsight | null;
  latestFareInfo: {
    insight: ExtractedChatInsight;
    detectedAmount: string | null;
  } | null;
  subeStatus: {
    state: 'none' | 'working' | 'failing' | 'info';
    label: string;
    insight: ExtractedChatInsight | null;
  };
  latestTransportNews: ExtractedChatInsight | null;
  latestTransportIssue: ExtractedChatInsight | null;
  bannerHeadline: string;
  detailedInsights: ExtractedChatInsight[];
}

function normalizeForMatch(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRelativeAgeLabel(timestampMs: number, nowTs: number): string {
  const diffSec = Math.max(0, Math.floor((nowTs - timestampMs) / 1000));
  if (diffSec < 45) return 'ahora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  return `hace ${diffHrs}h`;
}

function makeConciseExcerpt(raw: string, maxLen = 96): string {
  const cleaned = (raw || '')
    .replace(/^📍\s*\[UBICACIÓN COLECTIVO AHORA\]\s*/i, '')
    .replace(/^📢\s*\[EVENTO EN VIVO\]\s*/i, '')
    .replace(/^🚨\s*\[ALERTA OFICIAL UPPA\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

// Palabras clave de paradas reales de Línea 228 para reconocer dónde pasa el colectivo en el chat
const KNOWN_CORRIDOR_LANDMARKS = Array.from(
  new Set([
    ...LINEA_228_STOPS.flatMap((s) =>
      `${s.name} ${s.description || ''}`
        .split(/[\s,/()-]+/)
        .map((w) => normalizeForMatch(w))
        .filter((w) => w.length >= 5 && !['calle', 'parada', 'barrio', 'sector', 'frente', 'entre', 'avda', 'avenida', 'camino', 'cruce'].includes(w))
    ),
    'zarate',
    'campana',
    'malvinas',
    'tenaris',
    'siderca',
    'mcdonald',
    'colectora',
    'panamericana',
    'rotonda',
    'terminal',
    'plaza',
    'hospital',
    'estacion',
    'viaducto',
    'puente',
    'arco',
    'vigalondo',
    'ameghino',
    'rocca',
    'mitre',
    'sarmiento',
    'rivadavia',
    'belgrano',
    'lavalle',
    'moreno',
    'san martin',
    'villa fox',
    'dalmine',
    'otamendi',
    'rio lujan',
    '6 de julio',
    'ruta 9',
    'ruta 6',
    'ruta 193',
    'justo lima',
    'antigua',
    'las acacias',
    'las campanas',
    'lubo',
    'la josefa',
    'petrolero',
    'bajada',
  ])
);

function detectChatDirection(
  normText: string,
  salaId?: string
): 'hacia_zarate' | 'hacia_malvinas' | undefined {
  const zaratePatterns = [
    /(?:hacia|para|rumbo a|sentido|yendo a|va a|a|hasta)\s+(?:la\s+)?(?:ciudad\s+de\s+)?(?:terminal\s+de\s+)?zarate/,
    /campana\s*(?:->|a|hacia)\s*zarate/,
    /malvinas\s*(?:->|a|hacia)\s*zarate/,
    /\bhacia zarate\b/,
    /\ba zarate\b/,
    /\bpara zarate\b/,
  ];
  const malvinasPatterns = [
    /(?:hacia|para|rumbo a|sentido|yendo a|va a|a|hasta)\s+(?:b[°º]?\s*|barrio\s+)?malvinas/,
    /(?:hacia|para|rumbo a|sentido|yendo a|va a|a|hasta)\s+campana/,
    /zarate\s*(?:->|a|hacia)\s*(?:b[°º]?\s*malvinas|campana)/,
    /\bhacia malvinas\b/,
    /\ba malvinas\b/,
    /\bpara malvinas\b/,
    /\bhacia campana\b/,
    /\ba campana\b/,
    /\bpara campana\b/,
  ];

  const hitsZarate = zaratePatterns.some((re) => re.test(normText));
  const hitsMalvinas = malvinasPatterns.some((re) => re.test(normText));

  if (hitsZarate && !hitsMalvinas) return 'hacia_zarate';
  if (hitsMalvinas && !hitsZarate) return 'hacia_malvinas';
  if (salaId === 'campana-zarate') return 'hacia_zarate';
  if (salaId === 'zarate-campana') return 'hacia_malvinas';
  return undefined;
}

function extractDelayMinutesFromText(normText: string): number | null {
  const minMatch = normText.match(/(\d{1,3})\s*(?:min|mins|minuto|minutos)\b/);
  if (minMatch) {
    const val = Number(minMatch[1]);
    if (val >= 2 && val <= 180) return val;
  }
  const hrMatch = normText.match(/(\d{1,2})\s*(?:h|hs|hora|horas)\b/);
  if (hrMatch) {
    const val = Number(hrMatch[1]) * 60;
    if (val >= 30 && val <= 240) return val;
  }
  if (normText.includes('media hora')) return 30;
  if (normText.includes('cuarto de hora')) return 15;
  return null;
}

function detectFareAmount(rawText: string): string | null {
  const pesoSignMatch = rawText.match(/\$\s*(\d[\d.,]*)/);
  if (pesoSignMatch) {
    return `$${pesoSignMatch[1]}`;
  }
  const pesosWordMatch = rawText.match(/(\d{3,5}(?:[.,]\d{1,2})?)\s*pesos\b/i);
  if (pesosWordMatch) {
    return `$${pesosWordMatch[1]}`;
  }
  return null;
}

function isAutoSystemChat(rawText: string): boolean {
  const t = (rawText || '').trim();
  return (
    t.startsWith('📍 [UBICACIÓN COLECTIVO AHORA]') ||
    t.startsWith('📢 [EVENTO EN VIVO]') ||
    t.startsWith('🚨 [ALERTA OFICIAL UPPA]')
  );
}

/**
 * Análisis de Sentimiento EN VIVO estrictamente sobre mensajes REALES del chat comunitario
 * y eventos activos reales en el mapa. Cero simulación: si no hay reportes, lo informa honestamente.
 */
export function analyzeLiveCommunityChat(
  chatMessages: MensajeChatFirestore[] = [],
  events: MapEvent[] = [],
  nowTs: number = Date.now()
): LiveCommunitySentimentReport {
  const CHAT_WINDOW_MS = 45 * 60 * 1000; // Últimos 45 minutos (Firestore TTL activo = 20m)
  const EVENT_WINDOW_MS = 45 * 60 * 1000;

  // 1. Filtrar exclusivamente mensajes 100% reales dentro de ventana activa y ordenarlos del más reciente al más antiguo
  const realChatMessages = (chatMessages || [])
    .filter((m) => isRealChatMessage(m))
    .map((m) => ({
      msg: m,
      ts: getMessageTimestampMs(m.enviadoEn),
    }))
    .filter(({ ts, msg }) => Boolean((msg.texto || '').trim()) && nowTs - ts <= CHAT_WINDOW_MS)
    .sort((a, b) => b.ts - a.ts);

  // Eventos activos reales recientes en el mapa
  const activeEvents = (events || [])
    .filter((ev) => !ev.createdAtMs || nowTs - ev.createdAtMs <= EVENT_WINDOW_MS)
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let userChatCount = 0;
  let maxDelayMinFromChat = 0;

  let delayZarate: ExtractedChatInsight | null = null;
  let delayMalvinas: ExtractedChatInsight | null = null;
  let delayGeneral: ExtractedChatInsight | null = null;
  let latestPassingLocation: ExtractedChatInsight | null = null;
  let latestFareInfo: { insight: ExtractedChatInsight; detectedAmount: string | null } | null = null;
  let subeStatus: LiveCommunitySentimentReport['subeStatus'] = {
    state: 'none',
    label: '',
    insight: null,
  };
  let latestTransportNews: ExtractedChatInsight | null = null;
  let latestTransportIssue: ExtractedChatInsight | null = null;

  const detailedInsights: ExtractedChatInsight[] = [];
  const seenInsightKeys = new Set<string>();

  const pushDetailed = (insight: ExtractedChatInsight) => {
    const key = `${insight.category}_${insight.id}`;
    if (seenInsightKeys.has(key)) return;
    seenInsightKeys.add(key);
    detailedInsights.push(insight);
  };

  // Patrones lingüísticos en español rioplatense para el corredor Campana - Zárate
  const NEGATIVE_DELAY_PATTERNS = [
    /\b(?:demora|demorado|demorando|retraso|retrasado|atraso|atrasado|tarde|tardando)\b/,
    /\bno\s+(?:paso|pasa|viene|llego|llega|freno|frena|paro|para)\b/,
    /\b(?:hace\s+rato\s+esperando|sigo\s+esperando|estoy\s+esperando|esperando\s+(?:el\s+)?(?:228|colectivo|micro|bondi))\b/,
    /\b(?:no\s+hay\s+(?:colectivo|micro|228)|sin\s+frecuencia|corto\s+servicio|paso\s+de\s+largo)\b/,
    /\b(?:lento|trancado|embottellamiento|embotellamiento|congestion|muy\s+lento)\b/,
  ];

  const POSITIVE_SERVICE_PATTERNS = [
    /\b(?:a\s+horario|en\s+hora|puntual|buen\s+ritmo|circula\s+normal|todo\s+normal|servicio\s+normal|sin\s+demora|sin\s+demoras)\b/,
    /(?<!no\s)\b(?:paso\s+(?:recien|puntual|normal|rapido|bien)|llego\s+(?:bien|a\s+tiempo)|saliendo\s+(?:a\s+hora|puntual))\b/,
    /\b(?:libre|tranquilo|con\s+asientos|hay\s+lugar|vacio)\b/,
    /\b(?:gracias|excelente|perfecto|todo\s+ok|todo\s+bien)\b/,
  ];

  const PASSING_LOCATION_TRIGGERS = [
    /\b(?:pasando\s+por|pasa\s+por|recien\s+por|va\s+por|viene\s+por|llegando\s+a|saliendo\s+de|doblando\s+(?:en|por)|frente\s+a|altura\s+|cerca\s+de)\b/,
    /\b(?:en\s+la\s+(?:rotonda|colectora|plaza|terminal|estacion|bajada|esquina|parada))\b/,
    /\b(?:por\s+(?:colectora|panamericana|rotonda|plaza|tenaris|siderca|mcdonald|rocca|mitre|ameghino|vigalondo|ruta\s*\d+))\b/,
  ];

  const FARE_PATTERNS = [
    /\b(?:pasaje|boleto|tarifa|aument(?:o|aron)|subi(?:o|eron)\s+(?:el\s+)?(?:boleto|pasaje|tarifa)|cuanto\s+(?:sale|esta|cuesta|cobran)|precio\s+del\s+(?:pasaje|boleto)|sale\s+\$|cuesta\s+\$|cobran\s+\$)\b/,
    /\$\s*\d{2,5}/,
    /\b\d{3,5}\s*pesos\b/,
  ];

  const SUBE_TRIGGER_PATTERNS = [
    /\bsube\b/,
    /\b(?:maquinita|lector\s+de\s+tarjeta|lector\s+sube|posnet|maquina\s+(?:de\s+cobro|para\s+pagar)|sin\s+sistema(?:\s+para\s+pagar)?|para\s+pagar\s+el\s+pasaje)\b/,
  ];

  const SUBE_FAILING_PATTERNS = [
    /\bno\s+(?:anda|funciona|cobra|toma|lee|sirve|pasa)\b/,
    /\b(?:sin\s+sistema|sistema\s+caido|caido|roto|rota|apagado|apagada|descompuesto|falla|fallando|error|problema|solo\s+efectivo|unicamente\s+efectivo|no\s+hay\s+sistema|sin\s+sube)\b/,
  ];

  const SUBE_WORKING_PATTERNS = [
    /(?<!no\s)\b(?:anda\s+(?:bien|normal|perfecto|la\s+sube)|funciona\s+(?:bien|normal|perfecto|la\s+sube)|ya\s+(?:anda|funciona|volvio)|volvio\s+(?:el\s+sistema|la\s+sube)|cobra\s+(?:con\s+sube|normal)|toma\s+(?:la\s+)?sube|se\s+puede\s+pagar\s+con\s+sube)\b/,
  ];

  const TRANSPORT_NEWS_PATTERNS = [
    /\b(?:paro\s+de\s+(?:transporte|colectivos|micros|uta|choferes)|paro\s+general|de\s+paro|hay\s+paro|anunciaron\s+paro|huelga|medida\s+de\s+fuerza|asamblea|gremio|uta)\b/,
    /\b(?:sin\s+servicio|servicio\s+suspendido|suspendieron\s+el\s+servicio|servicio\s+reducido|no\s+circulan|no\s+salen\s+los\s+colectivos)\b/,
    /\b(?:corte\s+de\s+(?:ruta|calle|transito|colectora|puente)|ruta\s+cortada|calle\s+cortada|piquete|manifestacion|protesta|desvio|desvian|desviando|inundado|inundacion|accidente|choque)\b/,
    /\b(?:noticia|comunicado|alerta\s+oficial|atencion\s+usuarios|aviso\s+importante)\b/,
  ];

  const GENERAL_PROBLEM_PATTERNS = [
    /\b(?:lleno|hasta\s+las\s+manos|repleto|no\s+para|averiado|tirado|se\s+rompio|rompio|pincho|humo|fuego|inseguridad|robo|bronca|desastre|malisimo|pesimo|mugre|sin\s+aire|sin\s+calefaccion|caro|carisimo)\b/,
  ];

  for (const { msg, ts } of realChatMessages) {
    const rawText = (msg.texto || '').trim();
    const norm = normalizeForMatch(rawText);
    const isAuto = isAutoSystemChat(rawText);
    const isAdminAlert = rawText.startsWith('🚨 [ALERTA OFICIAL UPPA]');
    const ageLabel = formatRelativeAgeLabel(ts, nowTs);
    const author = msg.nombreUsuario || 'Vecino';
    const excerpt = makeConciseExcerpt(rawText);
    const direction = detectChatDirection(norm, msg.salaId);

    if (!isAuto) {
      userChatCount++;
    }

    const isNegativeNotPassing = /\bno\s+(?:paso|pasa|viene|llego|llega)\b/.test(norm);
    const hasDelay = NEGATIVE_DELAY_PATTERNS.some((re) => re.test(norm));
    const hasNews = isAdminAlert || TRANSPORT_NEWS_PATTERNS.some((re) => re.test(norm));
    const hasFare = !isAuto && FARE_PATTERNS.some((re) => re.test(norm));
    const hasProblem = GENERAL_PROBLEM_PATTERNS.some((re) => re.test(norm));
    const hasPositive = !hasDelay && !isNegativeNotPassing && POSITIVE_SERVICE_PATTERNS.some((re) => re.test(norm));

    // Evaluar SUBE (evitando confundir "sube el pasaje/boleto" con tarjeta SUBE si no habla de pago/sistema)
    const mentionsSubeWord = SUBE_TRIGGER_PATTERNS.some((re) => re.test(norm));
    const isPriceRiseVerb = /\bsube\s+(?:el\s+|la\s+)?(?:pasaje|boleto|tarifa|precio)\b/.test(norm);
    const hasSube =
      !isAuto &&
      mentionsSubeWord &&
      (!isPriceRiseVerb || /\b(?:tarjeta|sistema|lector|pagar|maquina|maquinita|funciona|anda)\b/.test(norm));

    let subeMessageState: 'working' | 'failing' | 'info' | null = null;
    if (hasSube) {
      if (SUBE_FAILING_PATTERNS.some((re) => re.test(norm))) {
        subeMessageState = 'failing';
      } else if (SUBE_WORKING_PATTERNS.some((re) => re.test(norm))) {
        subeMessageState = 'working';
      } else {
        subeMessageState = 'info';
      }
    }

    // Evaluar ubicación por donde pasa el colectivo
    const isBusLocationTelemetry = rawText.startsWith('📍 [UBICACIÓN COLECTIVO AHORA]');
    const mentionsLandmark = KNOWN_CORRIDOR_LANDMARKS.some((lm) => norm.includes(lm));
    const hasPassingTrigger = PASSING_LOCATION_TRIGGERS.some((re) => re.test(norm));
    const mentionsBusContext =
      isBusLocationTelemetry ||
      /\b(?:228|colectivo|micro|bondi|unidad|interno|coche|viene|pasando|pasa|doblando|saliendo|llegando)\b/.test(norm);

    const isPassingLocation =
      !isNegativeNotPassing &&
      !hasNews &&
      (isBusLocationTelemetry || (hasPassingTrigger && (mentionsBusContext || mentionsLandmark)));

    // Clasificar sentimiento del mensaje real de usuario
    if (!isAuto) {
      const msgIsNegative =
        hasDelay ||
        subeMessageState === 'failing' ||
        hasProblem ||
        (hasNews && !/\b(?:normalizado|levantaron\s+el\s+paro|ya\s+circula)\b/.test(norm)) ||
        (hasFare && /\b(?:aument|caro|carisimo|subi|bronca|robo)\b/.test(norm));

      const msgIsPositive = !msgIsNegative && (hasPositive || subeMessageState === 'working');

      if (msgIsNegative) negativeCount++;
      else if (msgIsPositive) positiveCount++;
      else neutralCount++;
    }

    // 1) Retrasos por dirección
    if (hasDelay) {
      const parsedMin = extractDelayMinutesFromText(norm);
      if (parsedMin) {
        maxDelayMinFromChat = Math.max(maxDelayMinFromChat, parsedMin);
      } else {
        maxDelayMinFromChat = Math.max(maxDelayMinFromChat, 12);
      }

      const dirLabel =
        direction === 'hacia_zarate'
          ? 'Hacia Zárate'
          : direction === 'hacia_malvinas'
          ? 'Hacia Malvinas / Campana'
          : 'Corredor 228';

      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'delay_direction',
        badge: `⏱️ Demora ${dirLabel}`,
        title: `Retraso reportado ${dirLabel.toLowerCase()}`,
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        direction: direction || 'general',
        severity: parsedMin && parsedMin >= 25 ? 'critical' : 'warning',
        source: 'chat',
      };

      if (direction === 'hacia_zarate' && !delayZarate) {
        delayZarate = insight;
      } else if (direction === 'hacia_malvinas' && !delayMalvinas) {
        delayMalvinas = insight;
      } else if (!direction && !delayGeneral) {
        delayGeneral = insight;
      }
      pushDetailed(insight);
    }

    // 2) Por dónde está pasando el colectivo
    if (isPassingLocation && !latestPassingLocation) {
      const dirLabel =
        direction === 'hacia_zarate'
          ? ' (→ Zárate)'
          : direction === 'hacia_malvinas'
          ? ' (→ Malvinas)'
          : '';
      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'passing_location',
        badge: `📍 Pasando${dirLabel}`,
        title: `Avistamiento en vivo${dirLabel}`,
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        direction: direction || 'general',
        severity: 'positive',
        source: 'chat',
      };
      latestPassingLocation = insight;
      pushDetailed(insight);
    }

    // 3) Precios del pasaje
    if (hasFare) {
      const amount = detectFareAmount(rawText);
      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'fare_price',
        badge: amount ? `💵 Pasaje ${amount}` : '💵 Tarifa / Pasaje',
        title: amount ? `Precio del pasaje mencionado (${amount})` : 'Comentario sobre precio del pasaje',
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        severity: /\b(?:aument|subi|caro)\b/.test(norm) ? 'warning' : 'info',
        source: 'chat',
      };
      if (!latestFareInfo) {
        latestFareInfo = { insight, detectedAmount: amount };
      }
      pushDetailed(insight);
    }

    // 4) Sistema de pago con SUBE
    if (hasSube && subeMessageState) {
      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'sube_status',
        badge:
          subeMessageState === 'failing'
            ? '💳 SUBE sin sistema'
            : subeMessageState === 'working'
            ? '💳 SUBE funcionando'
            : '💳 SUBE (consulta/aviso)',
        title:
          subeMessageState === 'failing'
            ? 'Falla reportada para pagar con SUBE'
            : subeMessageState === 'working'
            ? 'Pago con SUBE funcionando'
            : 'Mención sobre sistema SUBE',
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        severity:
          subeMessageState === 'failing'
            ? 'critical'
            : subeMessageState === 'working'
            ? 'positive'
            : 'info',
        source: 'chat',
      };
      if (subeStatus.state === 'none') {
        subeStatus = {
          state: subeMessageState,
          label:
            subeMessageState === 'failing'
              ? 'Sin sistema / Falla'
              : subeMessageState === 'working'
              ? 'Funciona normal'
              : 'Mencionada en chat',
          insight,
        };
      }
      pushDetailed(insight);
    }

    // 5) Noticias / Paros / Cortes / Alertas de transporte
    if (hasNews) {
      const isStrikeOrNoService = /\b(?:paro|huelga|medida\s+de\s+fuerza|sin\s+servicio|suspendid|no\s+circulan|corte|ruta\s+cortada|accidente|choque)\b/.test(
        norm
      );
      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'transport_news',
        badge: isStrikeOrNoService ? '🚨 Paro / Corte / Alerta' : '📰 Noticia Transporte',
        title: isAdminAlert
          ? 'Comunicado oficial publicado en chat'
          : isStrikeOrNoService
          ? 'Alerta de paro, corte o interrupción'
          : 'Novedad sobre el servicio',
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        direction: direction || 'general',
        severity: isStrikeOrNoService ? 'critical' : 'warning',
        source: 'chat',
      };
      if (!latestTransportNews) {
        latestTransportNews = insight;
      }
      pushDetailed(insight);
    }

    // 6) Otros comentarios de problemas en el transporte
    if (!hasDelay && !hasNews && subeMessageState !== 'failing' && hasProblem) {
      const insight: ExtractedChatInsight = {
        id: msg.id,
        category: 'transport_issue',
        badge: '⚠️ Reporte servicio',
        title: 'Comentario sobre el estado del viaje',
        excerpt,
        author,
        timestampMs: ts,
        ageLabel,
        direction: direction || 'general',
        severity: 'warning',
        source: 'chat',
      };
      if (!latestTransportIssue) {
        latestTransportIssue = insight;
      }
      pushDetailed(insight);
    }
  }

  // Enriquecer con eventos reales activos del mapa cuando complementan dirección o ubicación
  for (const ev of activeEvents) {
    const ts = ev.createdAtMs || nowTs;
    const ageLabel = formatRelativeAgeLabel(ts, nowTs);
    const evDir: 'hacia_zarate' | 'hacia_malvinas' | 'general' =
      ev.direction === 'hacia_zarate' || ev.direction === 'hacia_malvinas' ? ev.direction : 'general';
    const dirLabel =
      evDir === 'hacia_zarate'
        ? 'Hacia Zárate'
        : evDir === 'hacia_malvinas'
        ? 'Hacia Malvinas / Campana'
        : 'Corredor 228';

    if (
      (ev.type === 'late' || ev.type === 'missed' || ev.type === 'traffic') &&
      (!delayZarate || !delayMalvinas || !delayGeneral)
    ) {
      const place = ev.streetAddress ? ` en ${ev.streetAddress}` : '';
      const insight: ExtractedChatInsight = {
        id: `ev_${ev.id}`,
        category: 'delay_direction',
        badge: `⏱️ Demora ${dirLabel}`,
        title: `${ev.title}${place}`,
        excerpt: makeConciseExcerpt(ev.description || `${ev.title}${place}`),
        author: ev.reportedBy || 'Comunidad',
        timestampMs: ts,
        ageLabel,
        direction: evDir,
        severity: ev.type === 'missed' ? 'critical' : 'warning',
        source: 'event',
      };
      if (evDir === 'hacia_zarate' && !delayZarate) delayZarate = insight;
      else if (evDir === 'hacia_malvinas' && !delayMalvinas) delayMalvinas = insight;
      else if (evDir === 'general' && !delayGeneral) delayGeneral = insight;
      pushDetailed(insight);
    } else if (ev.type === 'bus_location' && !latestPassingLocation) {
      const place = ev.streetAddress || ev.description || 'en recorrido en vivo';
      const insight: ExtractedChatInsight = {
        id: `ev_${ev.id}`,
        category: 'passing_location',
        badge: `📍 Pasando${evDir === 'hacia_zarate' ? ' (→ Zárate)' : evDir === 'hacia_malvinas' ? ' (→ Malvinas)' : ''}`,
        title: `GPS activo ${dirLabel}`,
        excerpt: makeConciseExcerpt(place),
        author: ev.reportedBy || 'Pasajero/Chofer',
        timestampMs: ts,
        ageLabel,
        direction: evDir,
        severity: 'positive',
        source: 'event',
      };
      latestPassingLocation = insight;
      pushDetailed(insight);
    } else if (
      (ev.type === 'breakdown' || ev.type === 'accident' || ev.type === 'danger' || ev.type === 'inundacion') &&
      !latestTransportNews
    ) {
      const place = ev.streetAddress ? ` (${ev.streetAddress})` : '';
      const insight: ExtractedChatInsight = {
        id: `ev_${ev.id}`,
        category: 'transport_news',
        badge: '🚨 Alerta en corredor',
        title: `${ev.title}${place}`,
        excerpt: makeConciseExcerpt(ev.description || `${ev.title}${place}`),
        author: ev.reportedBy || 'Comunidad',
        timestampMs: ts,
        ageLabel,
        direction: evDir,
        severity: 'critical',
        source: 'event',
      };
      latestTransportNews = insight;
      pushDetailed(insight);
    }
  }

  // Ordenar hallazgos reales por relevancia/recencia
  detailedInsights.sort((a, b) => b.timestampMs - a.timestampMs);

  const hasRealData = realChatMessages.length > 0 || activeEvents.length > 0;

  let tone: LiveSentimentTone = 'sin_datos';
  let statusBadge = '⚪ Sin reportes';
  let statusShortLabel = 'Sin mensajes recientes';
  let score: number | null = null;
  let estimatedDelayMinutes: number | null = null;

  if (hasRealData) {
    let rawScore = 68;
    rawScore += positiveCount * 9;
    rawScore -= negativeCount * 14;
    if (latestTransportNews?.severity === 'critical') rawScore -= 28;
    else if (latestTransportNews) rawScore -= 14;
    if (subeStatus.state === 'failing') rawScore -= 12;
    if (delayZarate || delayMalvinas || delayGeneral) rawScore -= 10;

    for (const ev of activeEvents.slice(0, 8)) {
      if (ev.type === 'breakdown' || ev.type === 'accident' || ev.type === 'danger' || ev.type === 'inundacion') {
        rawScore -= 20;
      } else if (ev.type === 'late' || ev.type === 'missed') {
        rawScore -= 12;
      } else if (ev.type === 'moving' || ev.type === 'bus_location') {
        rawScore += 6;
      }
    }

    score = Math.max(5, Math.min(98, Math.round(rawScore)));

    if (maxDelayMinFromChat > 0) {
      estimatedDelayMinutes = maxDelayMinFromChat;
    } else if (
      activeEvents.some((e) => e.type === 'late' || e.type === 'missed' || e.type === 'breakdown' || e.type === 'accident')
    ) {
      estimatedDelayMinutes = 15;
    } else if (negativeCount > 0 || positiveCount > 0) {
      estimatedDelayMinutes = 0;
    }

    const hasCriticalNews = latestTransportNews?.severity === 'critical';
    const hasAlerts =
      Boolean(delayZarate || delayMalvinas || delayGeneral) ||
      subeStatus.state === 'failing' ||
      Boolean(latestTransportIssue) ||
      Boolean(latestTransportNews) ||
      negativeCount > positiveCount;

    if (hasCriticalNews || score < 40) {
      tone = 'critico';
      statusBadge = '🔴 Crítico';
      statusShortLabel = 'Alerta crítica en vivo';
    } else if (hasAlerts || score < 65) {
      tone = 'alerta';
      statusBadge = '🟡 Alertas';
      statusShortLabel = 'Demoras o novedades';
    } else if (positiveCount > 0 || latestPassingLocation || subeStatus.state === 'working') {
      tone = 'positivo';
      statusBadge = '🟢 Fluido';
      statusShortLabel = 'Sentimiento positivo';
    } else {
      tone = 'neutro';
      statusBadge = '💬 En vivo';
      statusShortLabel = 'Actividad comunitaria';
    }
  }

  // Titular 100% real para Lectura IA (sin inventar datos)
  let bannerHeadline = 'Sin reportes recientes en el chat comunitario ni alertas activas.';
  if (hasRealData) {
    const parts: string[] = [];
    if (latestTransportNews) {
      parts.push(`${latestTransportNews.badge}: "${latestTransportNews.excerpt}" (${latestTransportNews.ageLabel})`);
    }
    if (delayZarate) {
      parts.push(`Retraso a Zárate: "${delayZarate.excerpt}" (${delayZarate.ageLabel})`);
    }
    if (delayMalvinas) {
      parts.push(`Retraso a Malvinas: "${delayMalvinas.excerpt}" (${delayMalvinas.ageLabel})`);
    }
    if (!delayZarate && !delayMalvinas && delayGeneral) {
      parts.push(`Demora reportada: "${delayGeneral.excerpt}" (${delayGeneral.ageLabel})`);
    }
    if (latestPassingLocation) {
      parts.push(`Pasando por: "${latestPassingLocation.excerpt}" (${latestPassingLocation.ageLabel})`);
    }
    if (subeStatus.state !== 'none' && subeStatus.insight) {
      parts.push(`SUBE (${subeStatus.label}): "${subeStatus.insight.excerpt}" (${subeStatus.insight.ageLabel})`);
    }
    if (latestFareInfo) {
      parts.push(
        `Pasaje${latestFareInfo.detectedAmount ? ` ${latestFareInfo.detectedAmount}` : ''}: "${latestFareInfo.insight.excerpt}" (${latestFareInfo.insight.ageLabel})`
      );
    }
    if (parts.length === 0 && latestTransportIssue) {
      parts.push(`Reporte: "${latestTransportIssue.excerpt}" (${latestTransportIssue.ageLabel})`);
    }
    if (parts.length === 0 && userChatCount > 0) {
      const latestRealUserMsg = realChatMessages.find(({ msg }) => !isAutoSystemChat(msg.texto));
      if (latestRealUserMsg) {
        parts.push(
          `${latestRealUserMsg.msg.nombreUsuario}: "${makeConciseExcerpt(latestRealUserMsg.msg.texto)}" (${formatRelativeAgeLabel(latestRealUserMsg.ts, nowTs)})`
        );
      }
    }
    if (parts.length === 0 && activeEvents.length > 0) {
      parts.push(`${activeEvents.length} reporte(s) real(es) activo(s) en el mapa`);
    }

    bannerHeadline = parts.join(' · ');
  }

  return {
    hasRealData,
    tone,
    statusBadge,
    statusShortLabel,
    score,
    evaluatedChatCount: realChatMessages.length,
    userChatCount,
    activeEventsCount: activeEvents.length,
    positiveCount,
    negativeCount,
    neutralCount,
    estimatedDelayMinutes,
    delaysByDirection: {
      haciaZarate: delayZarate,
      haciaMalvinas: delayMalvinas,
      general: delayGeneral,
    },
    latestPassingLocation,
    latestFareInfo,
    subeStatus,
    latestTransportNews,
    latestTransportIssue,
    bannerHeadline,
    detailedInsights: detailedInsights.slice(0, 8),
  };
}

export function computeLineSentiment(messages: ChatMessage[], events: MapEvent[]): SentimentAnalysis {
  const mappedChats: MensajeChatFirestore[] = (messages || []).map((m) => ({
    id: m.id,
    salaId: m.channel || 'general',
    usuarioId: m.userId,
    nombreUsuario: m.userName,
    texto: m.content,
    rol: m.userRole || 'pasajero',
    enviadoEn: Date.now(),
  }));

  const live = analyzeLiveCommunityChat(mappedChats, events);

  let status: 'normal' | 'delayed' | 'critical' = 'normal';
  let label = live.hasRealData ? live.statusBadge : '⚪ Sin reportes recientes';
  let subtext = live.bannerHeadline;

  if (live.tone === 'critico') {
    status = 'critical';
  } else if (live.tone === 'alerta') {
    status = 'delayed';
  }

  const totalEvaluated = Math.max(1, live.positiveCount + live.negativeCount);
  return {
    status,
    label,
    subtext,
    score: live.score ?? 50,
    delayMinutesEstimated: live.estimatedDelayMinutes ?? 0,
    positiveRatio: live.hasRealData ? Math.round((live.positiveCount / totalEvaluated) * 100) : 0,
    negativeRatio: live.hasRealData ? Math.round((live.negativeCount / totalEvaluated) * 100) : 0,
    urgentAlertsCount: live.activeEventsCount,
    confidenceScore: live.hasRealData ? Math.min(99, 60 + live.evaluatedChatCount * 5 + live.activeEventsCount * 6) : 0,
  };
}
