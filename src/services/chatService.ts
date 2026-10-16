import { apiRequest } from './api';
import { ApiChatMessageRecord } from '../types/api';
import { MensajeChatFirestore } from '../types';

export const CHAT_MESSAGE_TTL_MS = 15 * 60 * 1000;

export function isChatMessageValid(enviadoEn: any): boolean {
  if (!enviadoEn) return false;
  const ts = typeof enviadoEn === 'number' ? enviadoEn : Number(enviadoEn);
  if (isNaN(ts)) return false;
  return Date.now() - ts < CHAT_MESSAGE_TTL_MS;
}

export function formatChatMessage(record: ApiChatMessageRecord): MensajeChatFirestore {
  return {
    id: record.id,
    salaId: record.salaId,
    usuarioId: record.usuarioId,
    nombreUsuario: record.nombreUsuario,
    texto: record.texto,
    rol: record.rol as any,
    enviadoEn: record.enviadoEn,
    avatarUrl: record.avatarUrl,
    replyTo: record.replyToId
      ? {
          id: record.replyToId,
          nombreUsuario: record.replyToNombre || 'Usuario',
          texto: record.replyToTexto || '',
        }
      : undefined,
    reportado: false,
  };
}

export function subscribeToChat(
  salaId: string,
  callback: (mensajes: MensajeChatFirestore[]) => void,
  onError?: (err: any) => void
): () => void {
  const safeSala = salaId || 'todos';
  let activeMessages: MensajeChatFirestore[] = [];
  let isMounted = true;
  let lastFetchTs = 0;

  // BroadcastChannel para sincronización instantánea entre pestañas (0ms)
  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('uppa_sheets_sync')
    : null;

  const emitValidMessages = (msgs: MensajeChatFirestore[]) => {
    const valid = msgs.filter((m) => isChatMessageValid(m.enviadoEn));
    valid.sort((a, b) => Number(a.enviadoEn) - Number(b.enviadoEn));
    activeMessages = valid;
    callback(valid);
  };

  const handleBroadcast = (ev: MessageEvent) => {
    if (!isMounted) return;
    if (ev.data?.type === 'NEW_CHAT_MESSAGE') {
      const incoming = formatChatMessage(ev.data.message);
      if (incoming.salaId === safeSala || safeSala === 'todos') {
        const merged = [...activeMessages.filter((m) => m.id !== incoming.id), incoming];
        emitValidMessages(merged);
      }
    } else if (ev.data?.type === 'DELETE_CHAT_MESSAGE') {
      const deletedId = ev.data.messageId;
      emitValidMessages(activeMessages.filter((m) => m.id !== deletedId));
    }
  };

  if (bc) {
    bc.addEventListener('message', handleBroadcast);
  }

  // Carga y polling periódico incremental contra el backend de Apps Script
  const fetchMessages = async () => {
    try {
      const res = await apiRequest<ApiChatMessageRecord[]>('getChat', {
        method: 'GET',
        params: { salaId: safeSala, since: lastFetchTs },
      });

      if (res.ok && res.data && isMounted) {
        lastFetchTs = Date.now();
        const incoming = res.data.map(formatChatMessage);
        const map = new Map<string, MensajeChatFirestore>();
        activeMessages.forEach((m) => map.set(m.id, m));
        incoming.forEach((m) => map.set(m.id, m));
        emitValidMessages(Array.from(map.values()));
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchMessages();
  const pollInterval = setInterval(fetchMessages, 4000);

  // Ticker activo cada 2s para purgar mensajes que alcancen los 15 minutos en memoria
  const pruneInterval = setInterval(() => {
    if (!isMounted || activeMessages.length === 0) return;
    const remaining = activeMessages.filter((m) => isChatMessageValid(m.enviadoEn));
    if (remaining.length !== activeMessages.length) {
      emitValidMessages(remaining);
    }
  }, 2000);

  return () => {
    isMounted = false;
    clearInterval(pollInterval);
    clearInterval(pruneInterval);
    if (bc) {
      bc.removeEventListener('message', handleBroadcast);
      bc.close();
    }
  };
}

export async function enviarMensajeChat(
  salaId: string,
  data: {
    usuarioId: string;
    nombreUsuario: string;
    texto: string;
    rol?: string;
    avatarUrl?: string;
    replyTo?: { id: string; nombreUsuario: string; texto: string };
  }
): Promise<MensajeChatFirestore> {
  const cleanText = data.texto.trim();
  const now = Date.now();

  const res = await apiRequest<ApiChatMessageRecord>('sendChat', {
    method: 'POST',
    body: {
      salaId: salaId || 'todos',
      usuarioId: data.usuarioId,
      nombreUsuario: data.nombreUsuario || 'Vecino UPPA',
      texto: cleanText,
      rol: data.rol || 'pasajero',
      avatarUrl: data.avatarUrl,
      replyTo: data.replyTo,
    },
  });

  if (res.ok && res.data) {
    return formatChatMessage(res.data);
  }

  // Fallback optimista instantáneo
  return {
    id: `msg_local_${now}`,
    salaId: salaId || 'todos',
    usuarioId: data.usuarioId,
    nombreUsuario: data.nombreUsuario,
    texto: cleanText,
    rol: data.rol as any,
    enviadoEn: now,
    avatarUrl: data.avatarUrl,
    replyTo: data.replyTo,
  };
}

export async function eliminarMensajeChat(messageId: string): Promise<void> {
  await apiRequest('deleteChatMessage', {
    method: 'POST',
    body: { messageId },
  });
}
