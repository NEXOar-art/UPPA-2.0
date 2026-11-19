import { LINEA_228_STOPS, Linea228Stop } from '../data/linea228Stops';

export interface StopSearchResult {
  stop: Linea228Stop;
  score: number;
  matchReason: string;
  betweenLabel: string;
}

export interface StreetPrediction {
  id: string;
  label: string;
  query: string;
  subtitle: string;
  kind: 'street' | 'between' | 'stop';
  stop?: Linea228Stop;
}

const STOP_CONNECTORS = new Set([
  'y',
  'e',
  'entre',
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'en',
  'a',
  'al',
  'por',
  'hacia',
  'calle',
  'parada',
  'av',
  'av.',
  'avenida',
  'nro',
  'n',
]);

// Alias populares de vecinos para agilizar búsquedas coloquiales
const STOP_ALIASES: Record<string, string[]> = {
  'p228-03': ['comercial', 'cabecera', 'origen', 'malvinas', 'inicio'],
  'p228-14': ['fomento', 'club ariel'],
  'p228-16': ['galeria', 'comercios ariel'],
  'p228-17': ['roca', 'rocca', 'tecnica', 'escuela tecnica'],
  'p228-15': ['aguer', 'primaria ariel', 'colegio ariel'],
  'p228-mcdonalds': ['mc', 'mac', 'mcdonalds', 'hamburguesa', 'km 72', 'panamericana', 'shell', 'axion'],
  'p228-25': ['6 de julio', 'aramburu', 'puente', 'distribuidor', 'ypf'],
  'p228-27': ['salk', 'slak', 'dr salk'],
  'p228-33': ['escuela 5', 'colegio 5', 'primaria 5'],
  'p228-34': ['parque', 'urbano', 'plaza'],
  'p228-40': ['estacion', 'centro campana'],
  'p228-48': ['cancha', 'dalmine', 'villa dalmine', 'estadio'],
  'p228-49': ['bidegain', 'badegain', 'rp6', 'rp 6'],
  'p228-53': ['ruta 12', 'cruce 12', 'rotonda'],
  'p228-61': ['centro zarate', 'civico'],
  'p228-62': ['peatonal', 'noya', 'romulo'],
  'p228-63': ['plaza mitre', 'municipalidad', 'muni zarate'],
  'p228-69': ['terminal', 'transferencia', 'andenes', 'final', 'llegada', 'destino'],
};

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´°.]/g, '')
    .replace(/[^a-z0-9\s#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getShortStreetLabel(stopName: string): string {
  return stopName
    .replace(/^(Av\.|Avenida|Calle)\s+/i, '')
    .trim();
}

function getBetweenLabel(index: number): string {
  const prev = index > 0 ? LINEA_228_STOPS[index - 1] : null;
  const next = index < LINEA_228_STOPS.length - 1 ? LINEA_228_STOPS[index + 1] : null;
  if (prev && next) {
    return `Entre ${getShortStreetLabel(prev.name)} y ${getShortStreetLabel(next.name)}`;
  }
  if (next) {
    return `Antes de ${getShortStreetLabel(next.name)}`;
  }
  if (prev) {
    return `Después de ${getShortStreetLabel(prev.name)}`;
  }
  return '';
}

function tokenizeQuery(normalized: string): string[] {
  const rawTokens = normalized.replace(/#/g, ' ').split(/\s+/).filter(Boolean);
  const meaningful = rawTokens.filter((t) => !STOP_CONNECTORS.has(t));
  return meaningful.length > 0 ? meaningful : rawTokens;
}

// Distancia de edición acotada para tolerar errores de tipeo en calles
function isFuzzyMatch(token: string, targetWord: string): boolean {
  if (token.length < 3 || targetWord.length < 3) return false;
  if (targetWord.startsWith(token) || targetWord.includes(token)) return true;

  // Permitir hasta 1 diferencia para palabras de 4-6 letras, o 2 para >6 letras
  const maxDist = token.length >= 7 ? 2 : 1;
  if (Math.abs(token.length - targetWord.length) > maxDist + 2) return false;

  // Comparar contra prefijo de longitud similar si el usuario aún está escribiendo
  const compareTarget =
    targetWord.length > token.length + maxDist
      ? targetWord.slice(0, token.length + 1)
      : targetWord;

  const a = token;
  const b = compareTarget;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[b.length] <= maxDist;
}

interface IndexedStop {
  stop: Linea228Stop;
  index: number;
  betweenLabel: string;
  normName: string;
  normZone: string;
  normDesc: string;
  normPrev: string;
  normNext: string;
  normAliases: string;
  wordsOwn: string[];
  wordsNeighbor: string[];
}

const INDEXED_STOPS: IndexedStop[] = LINEA_228_STOPS.map((stop, index) => {
  const prev = index > 0 ? LINEA_228_STOPS[index - 1] : null;
  const next = index < LINEA_228_STOPS.length - 1 ? LINEA_228_STOPS[index + 1] : null;
  const normName = normalizeSearchText(stop.name);
  const normZone = normalizeSearchText(stop.zone);
  const normDesc = normalizeSearchText(stop.description || '');
  const normPrev = prev ? normalizeSearchText(prev.name) : '';
  const normNext = next ? normalizeSearchText(next.name) : '';
  const normAliases = normalizeSearchText((STOP_ALIASES[stop.id] || []).join(' '));

  const ownText = `${normName} ${normZone} ${normDesc} ${normAliases} ${stop.sequence}`;
  const neighborText = `${normPrev} ${normNext}`;

  return {
    stop,
    index,
    betweenLabel: getBetweenLabel(index),
    normName,
    normZone,
    normDesc,
    normPrev,
    normNext,
    normAliases,
    wordsOwn: Array.from(new Set(ownText.split(/\s+/).filter(Boolean))),
    wordsNeighbor: Array.from(new Set(neighborText.split(/\s+/).filter(Boolean))),
  };
});

// Lista única de calles y puntos clave del corredor para autocompletado instantáneo
const CORRIDOR_STREETS: { name: string; norm: string; count: number; sampleStop: Linea228Stop }[] = (() => {
  const map = new Map<string, { name: string; norm: string; count: number; sampleStop: Linea228Stop }>();

  const addStreet = (raw: string, stop: Linea228Stop) => {
    const clean = raw.trim();
    const norm = normalizeSearchText(clean);
    if (norm.length < 3) return;
    const existing = map.get(norm);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(norm, { name: clean, norm, count: 1, sampleStop: stop });
    }
  };

  LINEA_228_STOPS.forEach((stop) => {
    addStreet(stop.name, stop);
    const parts = stop.name.split(/\s+(?:y|e)\s+/i);
    if (parts.length > 1) {
      parts.forEach((p) => addStreet(p, stop));
    }
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
})();

export const POPULAR_STREET_CHIPS: { label: string; query: string }[] = [
  { label: 'Vigalondo', query: 'Vigalondo' },
  { label: 'Casaux', query: 'Casaux' },
  { label: 'Ariel del Plata', query: 'Ariel del Plata' },
  { label: 'Colectora Sur', query: 'Colectora Sur' },
  { label: "McDonald's", query: "McDonald's" },
  { label: 'Av. Rivadavia', query: 'Rivadavia' },
  { label: 'Belgrano', query: 'Belgrano' },
  { label: 'San Martín', query: 'San Martín' },
  { label: '25 de Mayo', query: '25 de Mayo' },
  { label: 'Mitre', query: 'Mitre' },
  { label: 'Ruta 6', query: 'Ruta 6' },
  { label: 'Av. Lavalle', query: 'Lavalle' },
  { label: 'Leandro Alem', query: 'Alem' },
  { label: 'Terminal Zárate', query: 'Terminal' },
];

export function searchLinea228Stops(query: string, selectedZone: string = 'all'): StopSearchResult[] {
  const normQuery = normalizeSearchText(query);

  if (!normQuery) {
    return INDEXED_STOPS.filter((item) => selectedZone === 'all' || item.stop.zone === selectedZone).map(
      (item) => ({
        stop: item.stop,
        score: 100 - item.index,
        matchReason: item.stop.description || item.betweenLabel,
        betweenLabel: item.betweenLabel,
      })
    );
  }

  const isBetweenQuery = /\bentre\b/.test(normQuery);
  const tokens = tokenizeQuery(normQuery);
  const numericOnly = normQuery.replace(/^(parada|p|#|\s)+/g, '').trim();
  const isSeqNumberQuery = /^\d{1,2}$/.test(numericOnly);

  const results: StopSearchResult[] = [];

  for (const item of INDEXED_STOPS) {
    let score = 0;
    let matchReason = item.stop.description || item.betweenLabel;

    // 1. Coincidencia exacta por número de parada (#14, parada 14, 14)
    if (isSeqNumberQuery) {
      const seqStr = String(item.stop.sequence);
      if (seqStr === numericOnly) {
        score += 220;
        matchReason = `Parada #${item.stop.sequence} exacta`;
      } else if (seqStr.startsWith(numericOnly)) {
        score += 90;
      }
    }

    // 2. Coincidencia de frase completa en nombre, descripción o alias
    if (item.normName === normQuery) {
      score += 200;
      matchReason = 'Coincidencia exacta de parada';
    } else if (item.normName.startsWith(normQuery)) {
      score += 150;
      matchReason = `Coincide con "${item.stop.name}"`;
    } else if (item.normName.includes(normQuery)) {
      score += 120;
      matchReason = `Frase encontrada en parada`;
    } else if (item.normDesc.includes(normQuery) || item.normAliases.includes(normQuery)) {
      score += 105;
      matchReason = item.stop.description || 'Coincidencia por referencia';
    } else if (item.normZone.includes(normQuery)) {
      score += 85;
      matchReason = `Zona ${item.stop.zone}`;
    }

    // 3. Análisis por tokens (calles, cruces y "entre qué calle y qué calle")
    if (tokens.length > 0) {
      let ownMatchedTokens = 0;
      let neighborPrevMatched = 0;
      let neighborNextMatched = 0;
      let totalMatchedTokens = 0;

      for (const token of tokens) {
        const inOwn =
          item.normName.includes(token) ||
          item.normDesc.includes(token) ||
          item.normZone.includes(token) ||
          item.normAliases.includes(token) ||
          String(item.stop.sequence) === token ||
          item.wordsOwn.some((w) => isFuzzyMatch(token, w));

        const inPrev =
          item.normPrev.includes(token) ||
          (item.normPrev ? item.normPrev.split(/\s+/).some((w) => isFuzzyMatch(token, w)) : false);

        const inNext =
          item.normNext.includes(token) ||
          (item.normNext ? item.normNext.split(/\s+/).some((w) => isFuzzyMatch(token, w)) : false);

        if (inOwn) {
          ownMatchedTokens++;
          totalMatchedTokens++;
          score += item.normName.includes(token) ? 45 : 30;
        } else if (inPrev || inNext) {
          totalMatchedTokens++;
          score += isBetweenQuery ? 38 : 18;
        }

        if (inPrev) neighborPrevMatched++;
        if (inNext) neighborNextMatched++;
      }

      // Bonus fuerte si la búsqueda tipo "entre calle A y calle B" ubica esta parada justo en el medio
      if (tokens.length >= 2 && neighborPrevMatched > 0 && neighborNextMatched > 0) {
        score += 110;
        matchReason = item.betweenLabel;
      } else if (tokens.length >= 2 && ownMatchedTokens > 0 && (neighborPrevMatched > 0 || neighborNextMatched > 0)) {
        score += 65;
        matchReason = item.betweenLabel;
      }

      // Exigir que casi todos los tokens coincidan (o todos si son 1-2 tokens)
      const requiredMatches = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.65);
      if (totalMatchedTokens < requiredMatches && score < 80) {
        score = 0;
      } else if (ownMatchedTokens === tokens.length) {
        score += 55;
      }
    }

    if (score > 0) {
      results.push({
        stop: item.stop,
        score,
        matchReason,
        betweenLabel: item.betweenLabel,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.stop.sequence - b.stop.sequence);
}

export function getPredictiveStopSuggestions(query: string): StreetPrediction[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];

  const suggestions: StreetPrediction[] = [];
  const seenLabels = new Set<string>();

  // 1. Sugerencias de calles del corredor que coincidan por prefijo o contenido
  const matchingStreets = CORRIDOR_STREETS.filter(
    (st) => st.norm.startsWith(norm) || st.norm.includes(norm) || st.norm.split(' ').some((w) => isFuzzyMatch(norm, w))
  ).slice(0, 4);

  matchingStreets.forEach((st) => {
    const key = normalizeSearchText(st.name);
    if (!seenLabels.has(key)) {
      seenLabels.add(key);
      suggestions.push({
        id: `street-${key}`,
        label: st.name,
        query: st.name,
        subtitle:
          st.count > 1
            ? `${st.count} paradas sobre esta traza · ${st.sampleStop.zone}`
            : `Parada #${st.sampleStop.sequence} · ${st.sampleStop.zone}`,
        kind: st.count > 1 ? 'street' : 'stop',
        stop: st.count === 1 ? st.sampleStop : undefined,
      });
    }
  });

  // 2. Top paradas predichas (incluyendo coincidencias "entre calles" o por frase)
  const stopMatches = searchLinea228Stops(query, 'all').slice(0, 4);
  stopMatches.forEach((res) => {
    const key = normalizeSearchText(res.stop.name);
    if (!seenLabels.has(key)) {
      seenLabels.add(key);
      suggestions.push({
        id: `stop-${res.stop.id}`,
        label: `#${res.stop.sequence} · ${res.stop.name}`,
        query: res.stop.name,
        subtitle: res.betweenLabel || res.matchReason,
        kind: /\bentre\b/i.test(query) ? 'between' : 'stop',
        stop: res.stop,
      });
    }
  });

  return suggestions.slice(0, 6);
}
