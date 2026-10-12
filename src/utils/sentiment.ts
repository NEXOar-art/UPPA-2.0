import { ChatMessage, MapEvent } from '../types';

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

export function computeLineSentiment(messages: ChatMessage[], events: MapEvent[]): SentimentAnalysis {
  let score = 70; // baseline neutral-positive

  // Analyze events impact
  const activeEvents = events.slice(0, 10);
  let urgentAlerts = 0;

  for (const ev of activeEvents) {
    if (ev.type === 'breakdown' || ev.type === 'accident' || ev.type === 'danger') {
      score -= 22 * Math.min(1 + ev.confirmations * 0.1, 2.5);
      urgentAlerts++;
    } else if (ev.type === 'late' || ev.type === 'missed') {
      score -= 14 * Math.min(1 + ev.confirmations * 0.08, 2.0);
    } else if (ev.type === 'traffic') {
      score -= 8;
    } else if (ev.type === 'moving') {
      score += 10;
    }
  }

  // Analyze chat keywords
  let positiveCount = 0;
  let negativeCount = 0;
  const recentMessages = messages.slice(-15);

  const positiveWords = ['pasó', 'llegó', 'subiendo', 'libre', 'buen ritmo', 'circula', 'salida', 'gracias', 'rápido', 'normal'];
  const negativeWords = ['tarde', 'no pasó', 'demora', 'esperando', 'averiado', 'tirado', 'rompió', 'cortado', 'lleno', 'desvío', 'choque', 'bronca'];

  recentMessages.forEach((msg) => {
    const text = msg.content.toLowerCase();
    let hasNeg = false;
    let hasPos = false;

    negativeWords.forEach((word) => {
      if (text.includes(word)) hasNeg = true;
    });
    positiveWords.forEach((word) => {
      if (text.includes(word)) hasPos = true;
    });

    if (hasNeg) {
      negativeCount++;
      score -= 5;
    }
    if (hasPos) {
      positiveCount++;
      score += 4;
    }
  });

  // Clamp score
  score = Math.max(10, Math.min(95, Math.round(score)));

  let status: 'normal' | 'delayed' | 'critical' = 'normal';
  let label = '🟢 Normal';
  let subtext = 'Frecuencia regular y unidades circulando';
  let delayMinutesEstimated = 3;

  if (score < 40 || urgentAlerts >= 2) {
    status = 'critical';
    label = '🔴 Averías / Problemas Graves';
    subtext = 'Cortes o unidades fuera de servicio en el corredor';
    delayMinutesEstimated = 35;
  } else if (score < 68 || urgentAlerts >= 1 || events.some((e) => e.type === 'late')) {
    status = 'delayed';
    label = '🟡 Retrasos Comprobados';
    subtext = 'Demoras promedio de 15 a 25 min sobre el horario';
    delayMinutesEstimated = 18;
  }

  const totalEvaluated = Math.max(1, positiveCount + negativeCount);
  const positiveRatio = Math.round((positiveCount / totalEvaluated) * 100);
  const negativeRatio = Math.round((negativeCount / totalEvaluated) * 100);

  return {
    status,
    label,
    subtext,
    score,
    delayMinutesEstimated,
    positiveRatio,
    negativeRatio,
    urgentAlertsCount: urgentAlerts,
    confidenceScore: 92,
  };
}
