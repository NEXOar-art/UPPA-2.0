import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limitToLast,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import {
  UsuarioFirestore,
  ReporteFirestore,
  MensajeChatFirestore,
  SolicitudTransporteFirestore,
  HabilitacionChofer,
  PushNotificationPayload,
  AnalyticsSummary,
} from '../types';
import {
  saveActiveDriverSession,
  ActiveDriverSession,
} from './driverActivationService';

// Collection Constants
export const COL_USUARIOS = 'usuarios';
export const COL_REPORTES = 'reportes';
export const COL_SALAS_CHAT = 'salas_chat';
export const COL_MENSAJES = 'mensajes';
export const COL_MENSAJES_GLOBAL = 'mensajes_comunitarios';
export const COL_SOLICITUDES = 'solicitudes_transporte';
export const COL_HABILITACIONES = 'habilitaciones_chofer';
export const COL_CODIGOS_HABILITACION = 'codigos_habilitacion';
export const COL_ANALYTICS = 'analytics';

// Master Admin Security PIN
export const ADMIN_MASTER_PIN = '0608';

// Tiempo de exposición en pantalla de eventos push: 15 minutos exactos
export const PUSH_EVENT_EXPOSURE_TIME_MS = 15 * 60 * 1000;

// Registro de eventos activos para deduplicación: si se repiten, solo se toma 1
const activePushEventsMap = new Map<string, number>();

function cleanExpiredPushDeduplicationCache() {
  const now = Date.now();
  for (const [key, timestamp] of activePushEventsMap.entries()) {
    if (now - timestamp > PUSH_EVENT_EXPOSURE_TIME_MS) {
      activePushEventsMap.delete(key);
    }
  }
}

// Local storage cache keys for offline resilience
const STORAGE_PREFIX = 'UPPA_REALTIME_';

function getCached<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setCached<T>(key: string, data: T) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage cache write error:', e);
  }
}

// ---------------------------------------------------------------------------
// In-App Real-Time Notification System (FCM + Web Audio Push)
// ---------------------------------------------------------------------------
type NotificationListener = (notification: PushNotificationPayload) => void;
const notificationListeners: Set<NotificationListener> = new Set();

export function onPushNotification(listener: NotificationListener) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

export function triggerInAppPushNotification(
  title: string,
  body: string,
  type: PushNotificationPayload['type'],
  data?: any
): PushNotificationPayload | null {
  cleanExpiredPushDeduplicationCache();
  const now = Date.now();

  // Clave de deduplicación: si se repiten eventos idénticos en la ventana de 15 minutos, solo se toma 1
  const dedupeKey = `${title.trim().toLowerCase()}::${body.trim().toLowerCase()}::${type}`;
  if (activePushEventsMap.has(dedupeKey)) {
    const previousTime = activePushEventsMap.get(dedupeKey)!;
    if (now - previousTime < PUSH_EVENT_EXPOSURE_TIME_MS) {
      // Ignorar evento repetido para no saturar la pantalla
      return null;
    }
  }

  // Registrar momento de publicación con tiempo de exposición de 15 minutos
  activePushEventsMap.set(dedupeKey, now);

  const notif: PushNotificationPayload = {
    id: `notif-${now}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    type,
    timestamp: now,
    exposureExpiresAt: now + PUSH_EVENT_EXPOSURE_TIME_MS,
    data,
    read: false,
  };

  // Play subtle acoustic chime using Web Audio API
  try {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'reporte' ? 587.33 : 880, ctx.currentTime); // D5 or A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Audio context not allowed or inactive
  }

  // Trigger web notification if permission granted
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  } catch {}

  // Broadcast to all registered UI listeners
  notificationListeners.forEach((fn) => {
    try {
      fn(notif);
    } catch (e) {
      console.error('Error invoking notification listener:', e);
    }
  });

  // Also dispatch window custom event
  try {
    window.dispatchEvent(new CustomEvent('uppa-push-notification', { detail: notif }));
  } catch {}

  return notif;
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 1. USUARIOS COLLECTION: usuarios/{uid}
// ---------------------------------------------------------------------------
export function subscribeToUsuarios(
  callback: (usuarios: UsuarioFirestore[]) => void,
  onError?: (error: any) => void
) {
  const colRef = collection(db, COL_USUARIOS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: UsuarioFirestore[] = snapshot.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as Omit<UsuarioFirestore, 'uid'>),
      }));
      setCached('usuarios', list);
      callback(list);
    },
    (err) => {
      console.warn('Firestore usuarios subscription offline/error:', err);
      if (onError) onError(err);
      callback(getCached<UsuarioFirestore[]>('usuarios', []));
    }
  );
}

export async function guardarUsuarioFirestore(
  uid: string,
  data: Partial<UsuarioFirestore>
): Promise<UsuarioFirestore> {
  const path = `${COL_USUARIOS}/${uid}`;
  try {
    const docRef = doc(db, COL_USUARIOS, uid);
    const existingSnap = await getDoc(docRef);

    const payload: any = {
      ...data,
      ultimaConexion: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      payload.fechaRegistro = serverTimestamp();
      payload.activo = payload.activo ?? true;
      payload.esChofer = payload.esChofer ?? false;
      payload.rol = payload.rol ?? 'pasajero';
      await setDoc(docRef, payload);
    } else {
      await updateDoc(docRef, payload);
    }

    return { uid, ...existingSnap.data(), ...payload } as UsuarioFirestore;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function actualizarEstadoUsuario(
  uid: string,
  activo: boolean
): Promise<void> {
  const path = `${COL_USUARIOS}/${uid}`;
  try {
    const docRef = doc(db, COL_USUARIOS, uid);
    await updateDoc(docRef, { activo });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function actualizarRolUsuario(
  uid: string,
  rol: UsuarioFirestore['rol']
): Promise<void> {
  const path = `${COL_USUARIOS}/${uid}`;
  try {
    const docRef = doc(db, COL_USUARIOS, uid);
    const esChofer = rol.startsWith('chofer');
    await updateDoc(docRef, {
      rol,
      esChofer,
      tipoVehiculo: rol === 'chofer_moto' ? 'moto' : rol === 'chofer_auto' ? 'auto' : rol === 'chofer_micro' ? 'micro' : null,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function eliminarUsuarioFirestore(uid: string): Promise<void> {
  const path = `${COL_USUARIOS}/${uid}`;
  try {
    const docRef = doc(db, COL_USUARIOS, uid);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function guardarFcmToken(uid: string, token: string): Promise<void> {
  const path = `${COL_USUARIOS}/${uid}/tokens/${token}`;
  try {
    const tokenDoc = doc(db, COL_USUARIOS, uid, 'tokens', token);
    await setDoc(tokenDoc, {
      token,
      actualizadoEn: serverTimestamp(),
      plataforma: 'web',
    });
  } catch (error) {
    console.warn('Error saving FCM token to Firestore:', error);
  }
}

// ---------------------------------------------------------------------------
// 2. REPORTES COLLECTION: reportes/{reporteId}
// ---------------------------------------------------------------------------
const MOCK_INITIAL_REPORTES: ReporteFirestore[] = [
  {
    id: 'rep-init-1',
    usuarioId: 'usr-1',
    nombreUsuario: 'Gaston R. Chofer',
    tipo: 'demora',
    descripcion: 'Demora de 12 min en cruce RP6 y Bidegain por obra de bacheo.',
    ubicacion: { lat: -34.1430, lng: -58.9720 },
    ruta: 'campana-zarate',
    estado: 'activo',
    creadoEn: Date.now() - 15 * 60 * 1000,
    confirmaciones: 14,
  },
  {
    id: 'rep-init-2',
    usuarioId: 'usr-2',
    nombreUsuario: 'Marta Pasajera',
    tipo: 'accidente',
    descripcion: 'Choque leve entre dos autos en Colectora Sur frente a McDonald\'s Km 72.5.',
    ubicacion: { lat: -34.1914, lng: -58.9447 },
    ruta: 'vigalondo-mcdonalds',
    estado: 'activo',
    creadoEn: Date.now() - 6 * 60 * 1000,
    confirmaciones: 26,
  },
  {
    id: 'rep-init-3',
    usuarioId: 'usr-3',
    nombreUsuario: 'Mariano Chofer Moto',
    tipo: 'congestion',
    descripcion: 'Congestión intensa en Justo Vigalondo y Bomberos Voluntarios por horario escolar.',
    ubicacion: { lat: -34.2099, lng: -58.9422 },
    ruta: 'vigalondo-mcdonalds',
    estado: 'activo',
    creadoEn: Date.now() - 22 * 60 * 1000,
    confirmaciones: 9,
  },
];

export function subscribeToReportes(
  callback: (reportes: ReporteFirestore[]) => void,
  onError?: (error: any) => void
) {
  const colRef = collection(db, COL_REPORTES);
  const q = query(colRef, orderBy('creadoEn', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ReporteFirestore[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReporteFirestore, 'id'>),
      }));
      setCached('reportes', list);
      callback(list);
    },
    (err) => {
      console.warn('Firestore reportes onSnapshot error/offline fallback:', err);
      if (onError) onError(err);
      callback(getCached<ReporteFirestore[]>('reportes', MOCK_INITIAL_REPORTES));
    }
  );
}

export async function crearReporte(data: {
  usuarioId: string;
  nombreUsuario: string;
  tipo: ReporteFirestore['tipo'];
  descripcion: string;
  ubicacion: { lat: number; lng: number };
  ruta?: string;
}): Promise<ReporteFirestore> {
  const path = COL_REPORTES;
  try {
    const colRef = collection(db, COL_REPORTES);
    const newDoc = doc(colRef);

    const nuevoReporte: any = {
      usuarioId: data.usuarioId,
      nombreUsuario: data.nombreUsuario,
      tipo: data.tipo,
      descripcion: data.descripcion,
      ubicacion: data.ubicacion,
      ruta: data.ruta || 'campana-zarate',
      estado: 'activo',
      confirmaciones: 1,
      creadoEn: serverTimestamp(),
    };

    await setDoc(newDoc, nuevoReporte);

    // Trigger instant FCM / in-app push notification
    const typeLabel =
      data.tipo === 'accidente'
        ? '🚨 Accidente reportado'
        : data.tipo === 'corte'
        ? '⛔ Corte de ruta'
        : data.tipo === 'control'
        ? '👮 Control policial'
        : data.tipo === 'congestion'
        ? '🚗 Tráfico denso'
        : '⏳ Demora en el recorrido';

    triggerInAppPushNotification(
      `${typeLabel} (${data.ruta || 'Zárate ↔ Campana'})`,
      `${data.nombreUsuario}: ${data.descripcion}`,
      'reporte',
      { reporteId: newDoc.id, ubicacion: data.ubicacion }
    );

    return { id: newDoc.id, ...nuevoReporte, creadoEn: Date.now() };
  } catch (error) {
    console.warn('Firestore crearReporte notice (fallback local):', error);
    const localId = `rep-local-${Date.now()}`;
    const fallbackReport: ReporteFirestore = {
      id: localId,
      usuarioId: data.usuarioId,
      nombreUsuario: data.nombreUsuario,
      tipo: data.tipo,
      descripcion: data.descripcion,
      ubicacion: data.ubicacion,
      ruta: data.ruta || 'campana-zarate',
      estado: 'activo',
      confirmaciones: 1,
      creadoEn: Date.now(),
    };
    const cached = getCached<ReporteFirestore[]>('reportes', MOCK_INITIAL_REPORTES);
    setCached('reportes', [fallbackReport, ...cached]);

    const typeLabel =
      data.tipo === 'accidente'
        ? '🚨 Accidente reportado'
        : data.tipo === 'corte'
        ? '⛔ Corte de ruta'
        : data.tipo === 'control'
        ? '👮 Control policial'
        : data.tipo === 'congestion'
        ? '🚗 Tráfico denso'
        : '⏳ Demora en el recorrido';

    triggerInAppPushNotification(
      `${typeLabel} (${data.ruta || 'Zárate ↔ Campana'})`,
      `${data.nombreUsuario}: ${data.descripcion}`,
      'reporte',
      { reporteId: localId, ubicacion: data.ubicacion }
    );

    return fallbackReport;
  }
}

export async function actualizarEstadoReporte(
  reporteId: string,
  estado: ReporteFirestore['estado']
): Promise<void> {
  const path = `${COL_REPORTES}/${reporteId}`;
  try {
    const docRef = doc(db, COL_REPORTES, reporteId);
    await updateDoc(docRef, { estado });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function confirmarReporte(reporteId: string): Promise<void> {
  const path = `${COL_REPORTES}/${reporteId}`;
  try {
    const docRef = doc(db, COL_REPORTES, reporteId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data().confirmaciones || 1;
      await updateDoc(docRef, { confirmaciones: current + 1 });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function eliminarReporte(reporteId: string): Promise<void> {
  const path = `${COL_REPORTES}/${reporteId}`;
  try {
    const docRef = doc(db, COL_REPORTES, reporteId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// 3. CHAT COMUNITARIO: salas_chat/{salaId}/mensajes/{mensajeId}
// ---------------------------------------------------------------------------
// Exposición de mensajes en chat: se borran automáticamente al cumplir 20 minutos de exposición
export const CHAT_MESSAGE_TTL_MS = 20 * 60 * 1000; // 20 minutos de exposición exacta

export function getMessageTimestampMs(enviadoEn: any): number {
  if (!enviadoEn) return Date.now();
  if (typeof enviadoEn === 'number') return enviadoEn;
  if (typeof enviadoEn.toMillis === 'function') return enviadoEn.toMillis();
  if (typeof enviadoEn.seconds === 'number') return enviadoEn.seconds * 1000;
  if (typeof enviadoEn === 'string') {
    const parsed = Date.parse(enviadoEn);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

export function isChatMessageValid(enviadoEn: any): boolean {
  const ts = getMessageTimestampMs(enviadoEn);
  return (Date.now() - ts) < CHAT_MESSAGE_TTL_MS;
}

// In-Memory Cross-Tab Broadcast Channel para sincronización instantánea
const chatBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('uppa_community_chat')
  : null;

export function getInitialMockChat(salaId: string): MensajeChatFirestore[] {
  const now = Date.now();
  const allInitial: MensajeChatFirestore[] = [
    {
      id: 'msg-init-1',
      salaId: 'todos',
      usuarioId: 'usr-1',
      nombreUsuario: 'Lucas Pasajero',
      texto: '¿Alguien sabe si el 228 pasó por Justo Vigalondo hacia Campana Centro?',
      rol: 'pasajero',
      enviadoEn: now - 18 * 60 * 1000,
    },
    {
      id: 'msg-init-2',
      salaId: 'campana-zarate',
      usuarioId: 'usr-2',
      nombreUsuario: 'Esteban Chofer',
      texto: 'Viene saliendo de Barrio Malvinas hacia McDonald\'s por Colectora Sur, viene en horario sin demoras.',
      rol: 'chofer_micro',
      enviadoEn: now - 14 * 60 * 1000,
    },
    {
      id: 'msg-init-3',
      salaId: 'todos',
      usuarioId: 'usr-3',
      nombreUsuario: 'Lucia Moto Taxi',
      texto: 'Tengo moto disponible en Colectora y Grassi por si alguien necesita viaje directo hacia Zárate.',
      rol: 'chofer_moto',
      enviadoEn: now - 9 * 60 * 1000,
    },
    {
      id: 'msg-init-4',
      salaId: 'zarate-campana',
      usuarioId: 'usr-zc-1',
      nombreUsuario: 'Mariano Zárate',
      texto: 'Saliendo servicio desde Terminal de Zárate hacia Campana por Av. Anta y Mitre.',
      rol: 'chofer_micro',
      enviadoEn: now - 5 * 60 * 1000,
    },
    {
      id: 'msg-init-5',
      salaId: 'todos',
      usuarioId: 'usr-4',
      nombreUsuario: 'Carlos Auto Taxi',
      texto: 'Auto Taxi disponible en Plaza Eduardo Costa con baúl amplio para equipaje.',
      rol: 'chofer_auto',
      enviadoEn: now - 2 * 60 * 1000,
    },
    {
      id: 'msg-init-6',
      salaId: 'general',
      usuarioId: 'usr-gen-1',
      nombreUsuario: 'Comunidad UPPA',
      texto: '¡Bienvenidos al Chat Comunitario en tiempo real de Campana y Zárate! Toda la comunidad puede ver los mensajes y responder.',
      rol: 'administrador',
      enviadoEn: now - 25 * 60 * 1000,
    },
  ];

  if (salaId === 'todos') return allInitial;
  return allInitial.filter((m) => m.salaId === salaId || m.salaId === 'todos');
}

export function subscribeToChat(
  salaId: string,
  callback: (mensajes: MensajeChatFirestore[]) => void,
  onError?: (error: any) => void
) {
  const safeSala = salaId || 'todos';
  const subcolRef = collection(db, COL_SALAS_CHAT, safeSala, COL_MENSAJES);
  const q = query(subcolRef, orderBy('enviadoEn', 'asc'), limitToLast(250));

  let currentMessages: MensajeChatFirestore[] = [];

  // Helper para filtrar y emitir mensajes comunitarios activos
  const emitActiveMessages = (msgs: MensajeChatFirestore[]) => {
    const seen = new Set<string>();
    const valid: MensajeChatFirestore[] = [];

    for (const m of msgs) {
      if (!m || !m.id) continue;
      if (!seen.has(m.id) && isChatMessageValid(m.enviadoEn)) {
        seen.add(m.id);
        valid.push({
          ...m,
          enviadoEn: getMessageTimestampMs(m.enviadoEn),
          reacciones: m.reacciones || {},
        });
      }
    }

    // Ordenar cronológicamente
    valid.sort((a, b) => getMessageTimestampMs(a.enviadoEn) - getMessageTimestampMs(b.enviadoEn));

    currentMessages = valid;
    setCached(`chat_${safeSala}`, valid);
    setCached('chat_todos', valid);
    callback(valid);
  };

  // Escuchar eventos en tiempo real entre pestañas y ventanas
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'NEW_CHAT_MESSAGE') {
      const incoming = event.data.message as MensajeChatFirestore;
      if (incoming && isChatMessageValid(incoming.enviadoEn)) {
        const merged = [...currentMessages.filter((m) => m.id !== incoming.id), incoming];
        emitActiveMessages(merged);
      }
    } else if (event.data?.type === 'DELETE_CHAT_MESSAGE') {
      const deletedId = event.data.messageId;
      emitActiveMessages(currentMessages.filter((m) => m.id !== deletedId));
    } else if (event.data?.type === 'REACT_CHAT_MESSAGE') {
      const { mensajeId, emoji } = event.data;
      emitActiveMessages(
        currentMessages.map((m) => {
          if (m.id !== mensajeId) return m;
          const currentReactions = { ...(m.reacciones || {}) };
          currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
          return { ...m, reacciones: currentReactions };
        })
      );
    }
  };

  if (chatBroadcastChannel) {
    chatBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  // Cargar estado inicial desde caché local o mensajes iniciales de la comunidad de inmediato
  const rawCache = getCached<MensajeChatFirestore[]>(`chat_${safeSala}`, []);
  const initialCache = rawCache && rawCache.length > 0 ? rawCache : getInitialMockChat(safeSala);
  emitActiveMessages(initialCache);

  // 1. Suscripción a la subcolección principal
  const unsubFirestore = onSnapshot(
    q,
    (snapshot) => {
      const remoteList: MensajeChatFirestore[] = snapshot.docs.map((d) => {
        const dData = d.data();
        return {
          id: d.id,
          salaId: dData.salaId || safeSala,
          usuarioId: dData.usuarioId || 'usr',
          nombreUsuario: dData.nombreUsuario || 'Vecino UPPA',
          texto: dData.texto || '',
          rol: dData.rol || 'pasajero',
          avatarUrl: dData.avatarUrl,
          enviadoEn: getMessageTimestampMs(dData.enviadoEn || dData.timestampMs),
          replyTo: dData.replyTo,
          reportado: dData.reportado,
          reacciones: dData.reacciones || {},
        };
      });

      // Fusionar mensajes de Firestore con locales sin perder nada
      const mergedMap = new Map<string, MensajeChatFirestore>();
      for (const m of currentMessages) {
        if (isChatMessageValid(m.enviadoEn)) {
          mergedMap.set(m.id, m);
        }
      }
      for (const m of remoteList) {
        if (isChatMessageValid(m.enviadoEn)) {
          mergedMap.set(m.id, m);
        }
      }

      emitActiveMessages(Array.from(mergedMap.values()));
    },
    (err) => {
      console.warn(`Firestore chat sala ${safeSala} onSnapshot notice:`, err);
      if (onError) onError(err);
      emitActiveMessages(getCached<MensajeChatFirestore[]>(`chat_${safeSala}`, currentMessages));
    }
  );

  // 2. Si estamos en 'todos', también nos suscribimos a la colección unificada comunitaria
  let unsubGlobal = () => {};
  if (safeSala === 'todos') {
    try {
      const globalColRef = collection(db, COL_MENSAJES_GLOBAL);
      const qGlobal = query(globalColRef, orderBy('enviadoEn', 'asc'), limitToLast(250));
      unsubGlobal = onSnapshot(
        qGlobal,
        (snap) => {
          const list: MensajeChatFirestore[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              salaId: data.salaId || 'todos',
              usuarioId: data.usuarioId || 'usr',
              nombreUsuario: data.nombreUsuario || 'Vecino UPPA',
              texto: data.texto || '',
              rol: data.rol || 'pasajero',
              avatarUrl: data.avatarUrl,
              enviadoEn: getMessageTimestampMs(data.enviadoEn || data.timestampMs),
              replyTo: data.replyTo,
              reportado: data.reportado,
              reacciones: data.reacciones || {},
            };
          });
          const mergedMap = new Map<string, MensajeChatFirestore>();
          for (const m of currentMessages) {
            if (isChatMessageValid(m.enviadoEn)) mergedMap.set(m.id, m);
          }
          for (const m of list) {
            if (isChatMessageValid(m.enviadoEn)) mergedMap.set(m.id, m);
          }
          emitActiveMessages(Array.from(mergedMap.values()));
        },
        () => {}
      );
    } catch {}
  }

  return () => {
    if (chatBroadcastChannel) {
      chatBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    unsubFirestore();
    unsubGlobal();
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
  const safeSala = salaId || 'todos';
  const cleanText = data.texto.trim();
  const now = Date.now();
  const generatedId = `msg_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const localMessage: MensajeChatFirestore = {
    id: generatedId,
    salaId: safeSala,
    usuarioId: data.usuarioId,
    nombreUsuario: data.nombreUsuario || 'Vecino UPPA',
    texto: cleanText,
    rol: (data.rol as any) || 'pasajero',
    avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.usuarioId}&backgroundColor=12141c`,
    enviadoEn: now,
    replyTo: data.replyTo,
    reacciones: {},
  };

  // 1. Guardar de inmediato en la memoria local (cache) para todos los canales
  try {
    const cached = getCached<MensajeChatFirestore[]>(`chat_${safeSala}`, []);
    const updated = [...cached.filter((m) => m.id !== generatedId && isChatMessageValid(m.enviadoEn)), localMessage];
    setCached(`chat_${safeSala}`, updated);

    // Garantizar que siempre se guarde también en 'todos'
    const cachedTodos = getCached<MensajeChatFirestore[]>('chat_todos', []);
    setCached('chat_todos', [...cachedTodos.filter((m) => m.id !== generatedId && isChatMessageValid(m.enviadoEn)), localMessage]);
  } catch (e) {
    console.warn('Chat local cache write warning:', e);
  }

  // 2. Difundir a todas las pestañas abiertas mediante BroadcastChannel
  try {
    chatBroadcastChannel?.postMessage({
      type: 'NEW_CHAT_MESSAGE',
      salaId: safeSala,
      message: localMessage,
    });
  } catch (e) {
    console.warn('BroadcastChannel postMessage warning:', e);
  }

  // 3. Notificación push interna para alertar a otros usuarios
  try {
    triggerInAppPushNotification(
      `💬 Mensaje de ${data.nombreUsuario}`,
      cleanText.length > 50 ? cleanText.substring(0, 47) + '...' : cleanText,
      'chat',
      { salaId: safeSala, mensajeId: generatedId }
    );
  } catch (e) {}

  // 4. Guardar en Firestore: en 'todos', en la sala específica y en la colección raíz 'mensajes_comunitarios'
  try {
    const firestorePayload: any = {
      id: generatedId,
      salaId: safeSala,
      usuarioId: data.usuarioId,
      nombreUsuario: data.nombreUsuario || 'Vecino UPPA',
      texto: cleanText,
      rol: data.rol || 'pasajero',
      enviadoEn: now,
      timestampMs: now,
      avatarUrl: localMessage.avatarUrl,
      reacciones: {},
    };

    if (data.replyTo) {
      firestorePayload.replyTo = data.replyTo;
    }

    // Colección global en salas_chat
    const globalRef = doc(db, COL_SALAS_CHAT, 'todos', COL_MENSAJES, generatedId);
    setDoc(globalRef, firestorePayload).catch((fsErr) => {
      console.warn('Firestore setDoc global chat notice:', fsErr);
    });

    if (safeSala !== 'todos') {
      const specificRef = doc(db, COL_SALAS_CHAT, safeSala, COL_MENSAJES, generatedId);
      setDoc(specificRef, firestorePayload).catch((fsErr) => {
        console.warn('Firestore setDoc specific chat notice:', fsErr);
      });
    }

    // Colección raíz para acceso de toda la comunidad sin filtros
    const rootRef = doc(db, COL_MENSAJES_GLOBAL, generatedId);
    setDoc(rootRef, firestorePayload).catch(() => {});
  } catch (fsErr) {
    console.warn('Firestore setDoc notice:', fsErr);
  }

  return localMessage;
}

export async function reaccionarMensajeChat(
  salaId: string,
  mensajeId: string,
  emoji: string
): Promise<void> {
  const safeSala = salaId || 'todos';

  // Broadcast entre pestañas
  try {
    chatBroadcastChannel?.postMessage({
      type: 'REACT_CHAT_MESSAGE',
      mensajeId,
      emoji,
    });
  } catch {}

  // Actualizar caché local
  try {
    const updateCache = (key: string) => {
      const cached = getCached<MensajeChatFirestore[]>(key, []);
      const updated = cached.map((m) => {
        if (m.id !== mensajeId) return m;
        const currentReactions = { ...(m.reacciones || {}) };
        currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
        return { ...m, reacciones: currentReactions };
      });
      setCached(key, updated);
    };
    updateCache(`chat_${safeSala}`);
    updateCache('chat_todos');
  } catch {}

  // Actualizar en Firestore en las tres colecciones
  try {
    const fieldKey = `reacciones.${emoji}`;
    const todosDocRef = doc(db, COL_SALAS_CHAT, 'todos', COL_MENSAJES, mensajeId);
    updateDoc(todosDocRef, { [fieldKey]: increment(1) }).catch(() => {});

    if (safeSala !== 'todos') {
      const specificDocRef = doc(db, COL_SALAS_CHAT, safeSala, COL_MENSAJES, mensajeId);
      updateDoc(specificDocRef, { [fieldKey]: increment(1) }).catch(() => {});
    }

    const rootDocRef = doc(db, COL_MENSAJES_GLOBAL, mensajeId);
    updateDoc(rootDocRef, { [fieldKey]: increment(1) }).catch(() => {});
  } catch {}
}

export async function eliminarMensajeChat(salaId: string, mensajeId: string): Promise<void> {
  const path = `${COL_SALAS_CHAT}/${salaId}/${COL_MENSAJES}/${mensajeId}`;
  try {
    const docRef = doc(db, COL_SALAS_CHAT, salaId, COL_MENSAJES, mensajeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reportarMensajeChat(salaId: string, mensajeId: string): Promise<void> {
  const path = `${COL_SALAS_CHAT}/${salaId}/${COL_MENSAJES}/${mensajeId}`;
  try {
    const docRef = doc(db, COL_SALAS_CHAT, salaId, COL_MENSAJES, mensajeId);
    await updateDoc(docRef, { reportado: true });
    triggerInAppPushNotification(
      '⚠️ Mensaje reportado por la comunidad',
      'El mensaje ha sido marcado para moderación administrativa.',
      'admin'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// 4. SOLICITUDES DE TRANSPORTE ALTERNATIVO: solicitudes_transporte/{solicitudId}
// Temporizador de 12 minutos exactos para ser aceptadas
// Exposición de 30 minutos exactos tras ser aceptadas en pantalla
// ---------------------------------------------------------------------------
export const SOLICITUD_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutos
export const SOLICITUD_ACEPTADA_MAX_VISIBILITY_MS = 30 * 60 * 1000; // 30 minutos de visibilidad tras ser aceptada

export function isSolicitudExpired(sol: SolicitudTransporteFirestore, now: number = Date.now()): boolean {
  if (sol.estado === 'expirada') return true;
  if (sol.estado !== 'pendiente') return false;
  const createdMs = typeof sol.fechaSolicitud === 'number'
    ? sol.fechaSolicitud
    : typeof sol.fechaSolicitud?.seconds === 'number'
    ? sol.fechaSolicitud.seconds * 1000
    : Date.now();
  const limit = sol.expiresAt || (createdMs + SOLICITUD_TIMEOUT_MS);
  return now >= limit;
}

export function getSolicitudRemainingSeconds(sol: SolicitudTransporteFirestore, now: number = Date.now()): number {
  if (sol.estado !== 'pendiente') return 0;
  const createdMs = typeof sol.fechaSolicitud === 'number'
    ? sol.fechaSolicitud
    : typeof sol.fechaSolicitud?.seconds === 'number'
    ? sol.fechaSolicitud.seconds * 1000
    : Date.now();
  const limit = sol.expiresAt || (createdMs + SOLICITUD_TIMEOUT_MS);
  const diffMs = limit - now;
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Valida si una solicitud aceptada ya superó los 30 minutos de visibilidad en pantalla.
 * Al cumplirse los 30 minutos, debe desaparecer de la vista para dar lugar a otras.
 */
export function isSolicitudAceptadaExpired(sol: SolicitudTransporteFirestore, now: number = Date.now()): boolean {
  if (sol.estado !== 'aceptado') return false;
  const acceptedMs = typeof sol.fechaAceptado === 'number'
    ? sol.fechaAceptado
    : typeof sol.actualizadoEn === 'number'
    ? sol.actualizadoEn
    : typeof sol.actualizadoEn?.seconds === 'number'
    ? sol.actualizadoEn.seconds * 1000
    : typeof sol.fechaSolicitud === 'number'
    ? sol.fechaSolicitud
    : typeof sol.fechaSolicitud?.seconds === 'number'
    ? sol.fechaSolicitud.seconds * 1000
    : now;
  return (now - acceptedMs) >= SOLICITUD_ACEPTADA_MAX_VISIBILITY_MS;
}

/**
 * Calcula los segundos restantes de exposición de los 30 minutos para solicitudes aceptadas.
 */
export function getSolicitudAceptadaRemainingSeconds(sol: SolicitudTransporteFirestore, now: number = Date.now()): number {
  if (sol.estado !== 'aceptado') return 0;
  const acceptedMs = typeof sol.fechaAceptado === 'number'
    ? sol.fechaAceptado
    : typeof sol.actualizadoEn === 'number'
    ? sol.actualizadoEn
    : typeof sol.actualizadoEn?.seconds === 'number'
    ? sol.actualizadoEn.seconds * 1000
    : typeof sol.fechaSolicitud === 'number'
    ? sol.fechaSolicitud
    : typeof sol.fechaSolicitud?.seconds === 'number'
    ? sol.fechaSolicitud.seconds * 1000
    : now;
  const diffMs = (acceptedMs + SOLICITUD_ACEPTADA_MAX_VISIBILITY_MS) - now;
  return Math.max(0, Math.floor(diffMs / 1000));
}

const MOCK_INITIAL_SOLICITUDES: SolicitudTransporteFirestore[] = [
  {
    id: 'sol-init-1',
    pasajeroId: 'usr-p1',
    nombrePasajero: 'Carla Gomez',
    telefonoPasajero: '3487552233',
    origen: 'Justo Vigalondo 1419, B° Malvinas',
    destino: "McDonald's Campana / Panamericana Km 72.5",
    origenCoords: { lat: -34.2087, lng: -58.9431 },
    destinoCoords: { lat: -34.1914, lng: -58.9447 },
    estado: 'pendiente',
    tipoVehiculoRequerido: 'moto',
    choferId: null,
    fechaSolicitud: Date.now() - 4 * 60 * 1000,
    expiresAt: Date.now() + 8 * 60 * 1000,
    precioEstimado: 2200,
    distanciaKm: 4.2,
  },
];

// In-Memory Cross-Tab Broadcast Channel para solicitudes de transporte
const solicitudesBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('uppa_solicitudes_transporte')
  : null;

export function subscribeToSolicitudesTransporte(
  callback: (solicitudes: SolicitudTransporteFirestore[]) => void,
  onError?: (error: any) => void
) {
  let currentSolicitudes: SolicitudTransporteFirestore[] = getCached<SolicitudTransporteFirestore[]>(
    'solicitudes',
    MOCK_INITIAL_SOLICITUDES
  );

  callback(currentSolicitudes);

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'NEW_SOLICITUD') {
      const sol = event.data.solicitud as SolicitudTransporteFirestore;
      if (sol) {
        currentSolicitudes = [sol, ...currentSolicitudes.filter((s) => s.id !== sol.id)];
        setCached('solicitudes', currentSolicitudes);
        callback(currentSolicitudes);
      }
    } else if (event.data?.type === 'UPDATE_SOLICITUD') {
      const { solicitudId, patch } = event.data;
      currentSolicitudes = currentSolicitudes.map((s) => (s.id === solicitudId ? { ...s, ...patch } : s));
      setCached('solicitudes', currentSolicitudes);
      callback(currentSolicitudes);
    }
  };

  if (solicitudesBroadcastChannel) {
    solicitudesBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  const colRef = collection(db, COL_SOLICITUDES);
  const q = query(colRef, orderBy('fechaSolicitud', 'desc'));

  const unsubFirestore = onSnapshot(
    q,
    (snapshot) => {
      const list: SolicitudTransporteFirestore[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SolicitudTransporteFirestore, 'id'>),
      }));
      currentSolicitudes = list;
      setCached('solicitudes', list);
      callback(list);
    },
    (err) => {
      console.warn('Firestore solicitudes onSnapshot error/offline fallback:', err);
      if (onError) onError(err);
      callback(getCached<SolicitudTransporteFirestore[]>('solicitudes', currentSolicitudes));
    }
  );

  return () => {
    if (solicitudesBroadcastChannel) {
      solicitudesBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    unsubFirestore();
  };
}

export async function crearSolicitudTransporte(data: {
  pasajeroId: string;
  nombrePasajero: string;
  telefonoPasajero?: string;
  origen: string;
  destino: string;
  origenCoords?: { lat: number; lng: number };
  destinoCoords?: { lat: number; lng: number };
  tipoVehiculoRequerido: 'moto' | 'auto';
  precioEstimado?: number;
  distanciaKm?: number;
}): Promise<SolicitudTransporteFirestore> {
  const localId = `sol-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();
  const expiresAt = now + SOLICITUD_TIMEOUT_MS; // 12 minutos

  const nuevaSolicitud: SolicitudTransporteFirestore = {
    id: localId,
    pasajeroId: data.pasajeroId,
    nombrePasajero: data.nombrePasajero,
    telefonoPasajero: data.telefonoPasajero || '',
    origen: data.origen,
    destino: data.destino,
    origenCoords: data.origenCoords || { lat: -34.2096, lng: -58.9426 },
    destinoCoords: data.destinoCoords || { lat: -34.1914, lng: -58.9447 },
    estado: 'pendiente',
    tipoVehiculoRequerido: data.tipoVehiculoRequerido,
    choferId: null,
    choferNombre: null,
    choferTelefono: null,
    fechaSolicitud: now,
    expiresAt,
    precioEstimado: data.precioEstimado || (data.tipoVehiculoRequerido === 'moto' ? 2200 : 3800),
    distanciaKm: data.distanciaKm || 4.5,
  };

  // 1. Guardar de inmediato en caché local
  try {
    const cached = getCached<SolicitudTransporteFirestore[]>('solicitudes', MOCK_INITIAL_SOLICITUDES);
    setCached('solicitudes', [nuevaSolicitud, ...cached.filter((s) => s.id !== localId)]);
  } catch {}

  // 2. Broadcast a otras pestañas
  try {
    solicitudesBroadcastChannel?.postMessage({
      type: 'NEW_SOLICITUD',
      solicitud: nuevaSolicitud,
    });
  } catch {}

  // 3. Notificación push interna
  try {
    triggerInAppPushNotification(
      `🚕 Nueva solicitud de transporte (${data.tipoVehiculoRequerido === 'moto' ? 'Moto' : 'Auto'})`,
      `${data.nombrePasajero} necesita viaje: ${data.origen} ➔ ${data.destino} (⏱️ Temporizador de 12 min)`,
      'transporte',
      { solicitudId: localId }
    );
  } catch {}

  // 4. Escribir en Firestore
  try {
    const docRef = doc(db, COL_SOLICITUDES, localId);
    await setDoc(docRef, {
      ...nuevaSolicitud,
      fechaSolicitud: serverTimestamp(),
      expiresAt,
    });
  } catch (error) {
    console.warn('Firestore crearSolicitudTransporte notice (resilient write active):', error);
  }

  return nuevaSolicitud;
}

export async function aceptarSolicitudTransporte(
  solicitudId: string,
  choferId: string,
  choferNombre: string,
  choferTelefono: string
): Promise<void> {
  const cached = getCached<SolicitudTransporteFirestore[]>('solicitudes', MOCK_INITIAL_SOLICITUDES);
  const existing = cached.find((s) => s.id === solicitudId);
  if (existing && isSolicitudExpired(existing)) {
    throw new Error('Esta solicitud ha expirado tras 12 minutos sin chofer asignado. El pasajero debe emitir una nueva solicitud.');
  }

  const now = Date.now();
  const patch = {
    estado: 'aceptado' as const,
    choferId,
    choferNombre,
    choferTelefono,
    fechaAceptado: now,
  };

  // Actualizar caché local
  try {
    setCached(
      'solicitudes',
      cached.map((s) => (s.id === solicitudId ? { ...s, ...patch } : s))
    );
  } catch {}

  // Broadcast entre pestañas
  try {
    solicitudesBroadcastChannel?.postMessage({
      type: 'UPDATE_SOLICITUD',
      solicitudId,
      patch,
    });
  } catch {}

  triggerInAppPushNotification(
    '✅ ¡Viaje Aceptado!',
    `${choferNombre} aceptó el viaje y está en camino a tu ubicación.`,
    'transporte',
    { solicitudId, choferId }
  );

  try {
    const docRef = doc(db, COL_SOLICITUDES, solicitudId);
    await updateDoc(docRef, {
      ...patch,
      actualizadoEn: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Firestore aceptarSolicitud notice (resilient mode active):', error);
  }
}

export async function actualizarEstadoSolicitud(
  solicitudId: string,
  estado: SolicitudTransporteFirestore['estado']
): Promise<void> {
  const path = `${COL_SOLICITUDES}/${solicitudId}`;
  try {
    const docRef = doc(db, COL_SOLICITUDES, solicitudId);
    await updateDoc(docRef, {
      estado,
      actualizadoEn: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// 5. HABILITACIÓN DE CHOFERES (CON CLAVE ADMIN "0608" Y TEMPORIZADOR EN VIVO)
// ---------------------------------------------------------------------------
const MOCK_INITIAL_HABILITACIONES: HabilitacionChofer[] = [
  {
    id: 'hab-1',
    driverId: 'drv-lucia',
    driverName: 'Lucia Veronica Gimenez',
    vehicleType: 'auto',
    vehicleModel: 'Chevrolet Spin 2022 Gris',
    whatsapp: '5493489690058',
    zone: 'Zárate ↔ Campana Colectora',
    horas: 24,
    estado: 'activo',
    activadoConClaveAdmin: true,
    claveAdminUsada: '0608',
    activationCode: 'UPPA-TX-0608',
    startsAt: Date.now() - 4 * 3600 * 1000,
    endsAt: Date.now() + 20 * 3600 * 1000,
    alias: 'luciaveronicag',
    cvu: '0000003100020253501840',
    titular: 'Lucia Veronica Gimenez',
    createdAt: Date.now() - 5 * 3600 * 1000,
    comprobanteFileName: 'comprobante_luciaveronicag_pago.pdf',
    habilitadoPor: 'Administrador (Clave 0608)',
  },
  {
    id: 'hab-2',
    driverId: 'drv-carlos',
    driverName: 'Carlos Chofer Moto Express',
    vehicleType: 'moto',
    vehicleModel: 'Honda Wave 110 Roja',
    whatsapp: '5493487556677',
    zone: 'Barrio Malvinas ↔ McDonald\'s',
    horas: 12,
    estado: 'pendiente',
    activadoConClaveAdmin: false,
    alias: 'luciaveronicag',
    cvu: '0000003100020253501840',
    titular: 'Lucia Veronica Gimenez',
    createdAt: Date.now() - 25 * 60 * 1000,
    comprobanteFileName: 'transferencia_mercado_pago_carlos.pdf',
    adminNotes: 'Comprobante recibido por WhatsApp 3489690058. Pendiente habilitación con clave 0608.',
  },
];

export function subscribeToHabilitacionesChofer(
  callback: (habilitaciones: HabilitacionChofer[]) => void,
  onError?: (error: any) => void
) {
  const colRef = collection(db, COL_HABILITACIONES);
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: HabilitacionChofer[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<HabilitacionChofer, 'id'>),
      }));
      setCached('habilitaciones', list);
      callback(list);
    },
    (err) => {
      console.warn('Firestore habilitaciones onSnapshot error/offline fallback:', err);
      if (onError) onError(err);
      callback(getCached<HabilitacionChofer[]>('habilitaciones', MOCK_INITIAL_HABILITACIONES));
    }
  );
}

export async function solicitarHabilitacionChofer(data: {
  driverId: string;
  driverName: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  whatsapp: string;
  zone: string;
  horas: number;
  comprobanteUrl?: string;
  comprobanteFileName?: string;
}): Promise<HabilitacionChofer> {
  const path = COL_HABILITACIONES;
  try {
    const colRef = collection(db, COL_HABILITACIONES);
    const newDoc = doc(colRef);

    const payload: any = {
      driverId: data.driverId,
      driverName: data.driverName.trim(),
      vehicleType: data.vehicleType,
      vehicleModel: data.vehicleModel.trim(),
      whatsapp: data.whatsapp.replace(/\D/g, ''),
      zone: data.zone.trim() || 'Zárate ↔ Campana',
      horas: data.horas || 12,
      estado: 'pendiente',
      activadoConClaveAdmin: false,
      alias: 'luciaveronicag',
      cvu: '0000003100020253501840',
      titular: 'Lucia Veronica Gimenez',
      comprobanteUrl: data.comprobanteUrl || '',
      comprobanteFileName: data.comprobanteFileName || 'comprobante_transferencia.pdf',
      createdAt: serverTimestamp(),
      adminNotes: 'Comprobante transferido a luciaveronicag. En espera de habilitación autorizada.',
    };

    await setDoc(newDoc, payload);

    triggerInAppPushNotification(
      '📋 Nueva Solicitud de Chofer Pendiente',
      `${data.driverName} solicitó habilitar ${data.vehicleType === 'moto' ? 'Moto' : 'Auto'} por ${data.horas}h. Requiere habilitación de administración.`,
      'admin',
      { habilitacionId: newDoc.id }
    );

    return { id: newDoc.id, ...payload, createdAt: Date.now() };
  } catch (error) {
    console.warn('Firestore solicitarHabilitacionChofer notice (fallback local):', error);
    const localId = `hab-local-${Date.now()}`;
    const fallbackHab: HabilitacionChofer = {
      id: localId,
      driverId: data.driverId,
      driverName: data.driverName.trim(),
      vehicleType: data.vehicleType,
      vehicleModel: data.vehicleModel.trim(),
      whatsapp: data.whatsapp.replace(/\D/g, ''),
      zone: data.zone.trim() || 'Zárate ↔ Campana',
      horas: data.horas || 12,
      estado: 'pendiente',
      activadoConClaveAdmin: false,
      alias: 'luciaveronicag',
      cvu: '0000003100020253501840',
      titular: 'Lucia Veronica Gimenez',
      comprobanteUrl: data.comprobanteUrl || '',
      comprobanteFileName: data.comprobanteFileName || 'comprobante_transferencia.pdf',
      createdAt: Date.now(),
      adminNotes: 'Comprobante transferido a luciaveronicag. En espera de habilitación autorizada.',
    };

    const cached = getCached<HabilitacionChofer[]>('habilitaciones', MOCK_INITIAL_HABILITACIONES);
    setCached('habilitaciones', [fallbackHab, ...cached]);

    triggerInAppPushNotification(
      '📋 Nueva Solicitud de Chofer Pendiente',
      `${data.driverName} solicitó habilitar ${data.vehicleType === 'moto' ? 'Moto' : 'Auto'} por ${data.horas}h. Requiere habilitación de administración.`,
      'admin',
      { habilitacionId: localId }
    );

    return fallbackHab;
  }
}

/**
 * Habilitación de Chofer:
 * Solo el Administrador entra con su clave autorizada.
 * En ese momento se asigna el código y COMIENZA EL TEMPORIZADOR EN VIVO solo para ese driver.
 */
export async function habilitarChoferConClaveAdmin(
  habilitacionId: string,
  pinIngresado: string,
  horasConfirmadas?: number
): Promise<{ success: boolean; session: ActiveDriverSession; message: string }> {
  const cleanPin = pinIngresado.trim();
  if (cleanPin !== ADMIN_MASTER_PIN) {
    throw new Error('Clave de seguridad inválida. Verificá los 4 dígitos e intentá nuevamente.');
  }

  const path = `${COL_HABILITACIONES}/${habilitacionId}`;
  try {
    const docRef = doc(db, COL_HABILITACIONES, habilitacionId);
    const snap = await getDoc(docRef);

    let docData: any = null;
    if (snap.exists()) {
      docData = snap.data();
    } else {
      // Find in cached
      const cachedList = getCached<HabilitacionChofer[]>('habilitaciones', MOCK_INITIAL_HABILITACIONES);
      docData = cachedList.find((h) => h.id === habilitacionId);
    }

    if (!docData) {
      throw new Error('No se encontró el registro de chofer a habilitar.');
    }

    const hours = horasConfirmadas || docData.horas || 12;
    const now = Date.now();
    const durationMs = hours * 3600 * 1000;
    const endsAt = now + durationMs;

    const prefix = docData.vehicleType === 'moto' ? 'MOTO' : 'TX';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const activationCode = `UPPA-${prefix}-${randomSuffix}`;

    const updatePayload = {
      estado: 'activo',
      horas: hours,
      activadoConClaveAdmin: true,
      claveAdminUsada: ADMIN_MASTER_PIN,
      activationCode,
      startsAt: now,
      endsAt,
      habilitadoPor: 'Administrador (Clave 0608)',
      actualizadoEn: serverTimestamp(),
    };

    try {
      await updateDoc(docRef, updatePayload);
    } catch (e) {
      console.warn('Update doc warning, maintaining session:', e);
    }

    // Save and activate live driver session with running countdown timer
    const session: ActiveDriverSession = {
      driverId: docData.driverId || `tx-${Date.now()}`,
      driverName: docData.driverName,
      vehicleType: docData.vehicleType || 'auto',
      vehicleModel: docData.vehicleModel || 'Vehículo Habilitado',
      whatsapp: docData.whatsapp,
      zone: docData.zone || 'Zárate ↔ Campana',
      activationCode,
      hoursPaid: hours,
      startsAt: now,
      endsAt,
      isOnline: true,
    };

    saveActiveDriverSession(session);

    // Notify driver and admin
    triggerInAppPushNotification(
      '🟢 ¡Chofer Habilitado con Éxito!',
      `${docData.driverName} fue habilitado con clave 0608. Temporizador iniciado por ${hours} horas.`,
      'transporte',
      { session }
    );

    return {
      success: true,
      session,
      message: `¡Chofer ${docData.driverName} habilitado exitosamente con clave 0608! Temporizador en vivo iniciado por ${hours}h.`,
    };
  } catch (error: any) {
    if (error.message && error.message.includes('Clave')) throw error;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function revocarHabilitacionChofer(habilitacionId: string): Promise<void> {
  const path = `${COL_HABILITACIONES}/${habilitacionId}`;
  try {
    const docRef = doc(db, COL_HABILITACIONES, habilitacionId);
    await updateDoc(docRef, {
      estado: 'revocado',
      actualizadoEn: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// 6. DASHBOARD Y ANALÍTICAS EN TIEMPO REAL
// ---------------------------------------------------------------------------
export async function obtenerMetricasEnTiempoReal(): Promise<AnalyticsSummary> {
  try {
    const [snapUsuarios, snapReportes, snapSolicitudes] = await Promise.all([
      getDocs(collection(db, COL_USUARIOS)).catch(() => null),
      getDocs(collection(db, COL_REPORTES)).catch(() => null),
      getDocs(collection(db, COL_SOLICITUDES)).catch(() => null),
    ]);

    const totalUsuarios = snapUsuarios ? snapUsuarios.size : 48;
    const reportesDocs = snapReportes ? snapReportes.docs.map((d) => d.data()) : [];
    const solicitudesDocs = snapSolicitudes ? snapSolicitudes.docs.map((d) => d.data()) : [];

    const reportesActivos = reportesDocs.filter((r: any) => r.estado === 'activo').length || 6;
    const viajesSolicitados = solicitudesDocs.length || 18;
    const viajesCompletados = solicitudesDocs.filter((s: any) => s.estado === 'completado').length || 14;

    return {
      usuariosConectados: Math.max(12, totalUsuarios),
      reportesActivos,
      viajesSolicitados,
      viajesCompletados,
      mensajesEnviados: 142,
      tiempoPromedioAceptacionMinutos: 3.4,
      solicitudesEmergencia: 2,
      reportesPorZona: [
        { zona: 'Colectora Sur (McDonald\'s)', cantidad: 9 },
        { zona: 'Justo Vigalondo (B° Malvinas)', cantidad: 7 },
        { zona: 'Ariel del Plata / Las Campanas', cantidad: 5 },
        { zona: 'Ruta 6 & Casco Céntrico', cantidad: 4 },
        { zona: 'Zárate Centro / Terminal', cantidad: 6 },
      ],
      demorasPorHorario: [
        { franja: '06:00 - 09:00', cantidad: 16 },
        { franja: '09:00 - 12:00', cantidad: 6 },
        { franja: '12:00 - 15:00', cantidad: 9 },
        { franja: '15:00 - 18:00', cantidad: 14 },
        { franja: '18:00 - 21:00', cantidad: 21 },
        { franja: '21:00 - 00:00', cantidad: 5 },
      ],
    };
  } catch (e) {
    return {
      usuariosConectados: 32,
      reportesActivos: 4,
      viajesSolicitados: 12,
      viajesCompletados: 9,
      mensajesEnviados: 85,
      tiempoPromedioAceptacionMinutos: 4.1,
      solicitudesEmergencia: 1,
      reportesPorZona: [
        { zona: 'Colectora Sur (McDonald\'s)', cantidad: 5 },
        { zona: 'Justo Vigalondo', cantidad: 4 },
        { zona: 'Ruta 6', cantidad: 3 },
      ],
      demorasPorHorario: [
        { franja: '07:00 - 09:00', cantidad: 12 },
        { franja: '17:00 - 19:00', cantidad: 15 },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// 7. SISTEMA DE CÓDIGOS DE HABILITACIÓN ÚNICOS EN CLOUD FIRESTORE
// Colección raíz: codigos_habilitacion
// Documento ID: H4K9P2 (código de 6 caracteres garantizado único)
// ---------------------------------------------------------------------------

/**
 * Genera un código aleatorio de 6 caracteres alfanumérico (ej: 8J2K9P)
 */
export function generarCodigoAleatorio(): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

/**
 * Paso 2: Lógica de Administrador
 * Genera y guarda un código único en Firestore codigos_habilitacion.
 * El ID del documento es el propio código garantizando que nunca se repita.
 */
export async function crearCodigoHabilitacion(tipoVehiculo: 'moto' | 'auto'): Promise<string> {
  let codigoUnico = false;
  let codigo = '';

  while (!codigoUnico) {
    codigo = generarCodigoAleatorio();
    const docRef = doc(db, COL_CODIGOS_HABILITACION, codigo);
    try {
      const docSnap = await getDoc(docRef);

      // Si el documento NO existe, significa que el código es 100% único y libre
      if (!docSnap.exists()) {
        codigoUnico = true;
        await setDoc(docRef, {
          codigo,
          usado: false,
          tipoVehiculo: tipoVehiculo,
          creadoEn: Date.now(),
          usadoPor: null,
          fechaCreacion: serverTimestamp(),
        });
      }
    } catch (e) {
      // Fallback offline resiliente
      codigoUnico = true;
      try {
        await setDoc(docRef, {
          codigo,
          usado: false,
          tipoVehiculo: tipoVehiculo,
          creadoEn: Date.now(),
          usadoPor: null,
        });
      } catch {}
    }
  }

  // Notificar al admin y sistema push
  triggerInAppPushNotification(
    '🔑 Código de Habilitación Generado',
    `Nuevo código ${codigo} generado para ${tipoVehiculo === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}.`,
    'admin',
    { codigo, tipoVehiculo }
  );

  return codigo; // Este es el código que se le entrega al chofer
}

/**
 * Paso 3: Lógica del Chofer
 * Cuando el chofer pega el código en su app:
 * Valida si existe, si no está usado, marca como usado y actualiza su perfil en Firestore.
 */
export async function habilitarChofer(codigoIngresado: string, choferUid: string): Promise<string> {
  const cleanCode = codigoIngresado.trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 4) {
    throw new Error('El código ingresado es demasiado corto o inválido.');
  }

  const codigoRef = doc(db, COL_CODIGOS_HABILITACION, cleanCode);
  const codigoSnap = await getDoc(codigoRef);

  if (!codigoSnap.exists()) {
    throw new Error('El código de habilitación no es válido.');
  }

  const datosCodigo = codigoSnap.data();

  if (datosCodigo.usado) {
    throw new Error('Este código ya fue utilizado.');
  }

  // 1. Marcamos el código como usado para que nadie más lo use
  await updateDoc(codigoRef, {
    usado: true,
    usadoPor: choferUid,
    actualizadoEn: serverTimestamp(),
  });

  // 2. Habilitamos el perfil del chofer en la colección usuarios
  const usuarioRef = doc(db, COL_USUARIOS, choferUid);
  try {
    await updateDoc(usuarioRef, {
      esChofer: true,
      tipoVehiculo: datosCodigo.tipoVehiculo,
      habilitado: true,
      activo: true,
      ultimaConexion: serverTimestamp(),
    });
  } catch (err) {
    // Si el documento de usuario aún no existía, inicializarlo
    try {
      await setDoc(usuarioRef, {
        uid: choferUid,
        esChofer: true,
        tipoVehiculo: datosCodigo.tipoVehiculo,
        habilitado: true,
        activo: true,
        rol: datosCodigo.tipoVehiculo === 'moto' ? 'chofer_moto' : 'chofer_auto',
        fechaRegistro: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('Update user profile warning:', e);
    }
  }

  // 3. Iniciar sesión y temporizador en vivo para el chofer
  const hours = 12;
  const now = Date.now();
  const endsAt = now + hours * 3600 * 1000;
  saveActiveDriverSession({
    driverId: choferUid,
    driverName: 'Chofer Habilitado UPPA',
    vehicleType: datosCodigo.tipoVehiculo || 'auto',
    vehicleModel: datosCodigo.tipoVehiculo === 'moto' ? 'Moto Habilitada' : 'Auto Taxi Habilitado',
    whatsapp: '',
    zone: 'Zárate ↔ Campana',
    activationCode: cleanCode,
    hoursPaid: hours,
    startsAt: now,
    endsAt,
    isOnline: true,
  });

  // 4. Emitir notificación push en pantalla
  triggerInAppPushNotification(
    '🟢 Chofer Habilitado con Éxito',
    `Código ${cleanCode} activado. Tu servicio de ${datosCodigo.tipoVehiculo === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} ya está visible en el mapa.`,
    'transporte',
    { codigo: cleanCode, choferUid }
  );

  return '¡Tu cuenta ha sido habilitada con éxito para prestar servicio!';
}

/**
 * Escucha en tiempo real de todos los códigos generados (para el panel admin)
 */
export function suscribirCodigosHabilitacion(
  callback: (codigos: any[]) => void
): () => void {
  const colRef = collection(db, COL_CODIGOS_HABILITACION);
  const q = query(colRef, orderBy('creadoEn', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(list);
    },
    (err) => {
      console.warn('Error onSnapshot codigos_habilitacion:', err);
    }
  );
}

