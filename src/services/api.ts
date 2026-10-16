import { ApiResponse } from '../types/api';

/**
 * Cliente centralizado para comunicación HTTP con el backend de Google Apps Script.
 * La URL del Web App de Apps Script se configura mediante VITE_APPS_SCRIPT_URL.
 * Si la URL no está definida aún, opera en modo de persistencia local resiliente
 * para garantizar interactividad total en el entorno de desarrollo y vista previa.
 */

export const APPS_SCRIPT_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPS_SCRIPT_URL) ||
  '';

const LOCAL_STORAGE_DB_PREFIX = 'uppa_sheets_db_';
const SESSION_TOKEN_KEY = 'uppa_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {}
}

/**
 * Función principal para realizar peticiones al Google Apps Script Web App
 */
export async function apiRequest<T = any>(
  action: string,
  options?: {
    method?: 'GET' | 'POST';
    params?: Record<string, string | number | boolean | undefined>;
    body?: any;
    token?: string;
  }
): Promise<ApiResponse<T>> {
  const method = options?.method || (options?.body ? 'POST' : 'GET');
  const token = options?.token || getStoredSessionToken() || '';

  // Si está configurada la URL de Apps Script, enviamos la petición real por HTTPS
  if (APPS_SCRIPT_URL) {
    try {
      if (method === 'GET') {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', action);
        if (token) url.searchParams.set('token', token);
        if (options?.params) {
          Object.entries(options.params).forEach(([k, v]) => {
            if (v !== undefined) url.searchParams.set(k, String(v));
          });
        }

        const resp = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'follow',
        });
        const json: ApiResponse<T> = await resp.json();
        return json;
      } else {
        // En POST, Google Apps Script procesa mejor e.postData.contents sin preflight OPTIONS
        // usando text/plain con payload JSON stringificado
        const payload = {
          action,
          token,
          ...(options?.body || {}),
        };

        const resp = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
          redirect: 'follow',
        });

        const json: ApiResponse<T> = await resp.json();
        return json;
      }
    } catch (netErr: any) {
      console.warn(`[UPPA API] Error de red con Google Apps Script (${action}), usando fallback local:`, netErr);
      return executeLocalSimulator<T>(action, options);
    }
  }

  // Fallback Resiliente Local para vista previa / desarrollo antes del despliegue de Apps Script
  return executeLocalSimulator<T>(action, options);
}

// =========================================================================
// SIMULADOR LOCAL RESILIENTE (Google Sheets Mirror en LocalStorage)
// =========================================================================

function getSheetData<R>(sheetName: string, defaultData: R[]): R[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_DB_PREFIX}${sheetName}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveSheetData(sheetName, defaultData);
  return defaultData;
}

function saveSheetData<R>(sheetName: string, data: R[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_DB_PREFIX}${sheetName}`, JSON.stringify(data));
  } catch {}
}

const DEFAULT_CONFIG = {
  PAYMENT_ALIAS: 'luciaveronicag',
  PAYMENT_CVU: '0000003100020253501840',
  VERIFICATION_WHATSAPP: '5493489690058',
  PRICE_2H: 6000,
  PRICE_6H: 16000,
  PRICE_12H: 30000,
  PRICE_24H: 50000,
};

async function executeLocalSimulator<T>(
  action: string,
  options?: {
    method?: 'GET' | 'POST';
    params?: Record<string, any>;
    body?: any;
    token?: string;
  }
): Promise<ApiResponse<T>> {
  const now = Date.now();
  const token = options?.token || getStoredSessionToken() || '';
  const body = options?.body || {};
  const params = options?.params || {};

  // BroadcastChannel para sincronización inmediata entre pestañas
  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('uppa_sheets_sync')
    : null;

  switch (action) {
    case 'getConfig': {
      return { ok: true, data: DEFAULT_CONFIG as any, error: null, timestamp: now };
    }

    case 'register': {
      const { email, password, nombre, rol, tipoVehiculo, phone, barrio } = body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return {
          ok: false,
          data: null,
          error: { code: 'INVALID_INPUT', message: 'Email y contraseña requeridos' },
          timestamp: now,
        };
      }

      const users = getSheetData<any>('USUARIOS', []);
      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return {
          ok: false,
          data: null,
          error: { code: 'EMAIL_EXISTS', message: 'El correo electrónico ya se encuentra registrado.' },
          timestamp: now,
        };
      }

      const uid = `usr_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const isChofer = rol === 'chofer_moto' || rol === 'chofer_auto' || rol === 'chofer_micro' || !!tipoVehiculo;
      const newUser = {
        uid,
        nombre: nombre || cleanEmail.split('@')[0],
        email: cleanEmail,
        rol: rol || 'pasajero',
        esChofer: isChofer,
        tipoVehiculo: tipoVehiculo || (rol === 'chofer_moto' ? 'moto' : rol === 'chofer_auto' ? 'auto' : null),
        activo: true,
        telefono: phone || '',
        barrio: barrio || 'Campana Centro',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
        fechaRegistro: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString(),
        emailVerificado: true,
      };

      users.push(newUser);
      saveSheetData('USUARIOS', users);

      const sessionToken = `tok_${now}_${Math.random().toString(36).substring(2, 10)}`;
      setStoredSessionToken(sessionToken);

      const sessions = getSheetData<any>('SESIONES', []);
      sessions.push({
        sessionId: `ses_${now}`,
        uid,
        token: sessionToken,
        creadaEn: now,
        expiraEn: now + 30 * 24 * 3600 * 1000,
        ultimoUso: now,
        activo: true,
      });
      saveSheetData('SESIONES', sessions);

      return {
        ok: true,
        data: { user: newUser, token: sessionToken } as any,
        error: null,
        timestamp: now,
      };
    }

    case 'login': {
      const { email, password } = body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const users = getSheetData<any>('USUARIOS', []);
      let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

      // Si no existe, crear automáticamente para no bloquear el acceso en desarrollo
      if (!user) {
        const uid = `usr_${now}_${Math.random().toString(36).substring(2, 7)}`;
        const isAdmin = cleanEmail.includes('admin') || cleanEmail === 'gastonrobertogimenez@gmail.com';
        user = {
          uid,
          nombre: cleanEmail.split('@')[0],
          email: cleanEmail,
          rol: isAdmin ? 'administrador' : 'pasajero',
          esChofer: false,
          tipoVehiculo: null,
          activo: true,
          telefono: '+54 9 3487 55-2190',
          barrio: 'Campana Centro',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
          fechaRegistro: new Date().toISOString(),
          ultimoAcceso: new Date().toISOString(),
          emailVerificado: true,
        };
        users.push(user);
        saveSheetData('USUARIOS', users);
      }

      const sessionToken = `tok_${now}_${Math.random().toString(36).substring(2, 10)}`;
      setStoredSessionToken(sessionToken);

      return {
        ok: true,
        data: { user, token: sessionToken } as any,
        error: null,
        timestamp: now,
      };
    }

    case 'googleLogin': {
      const { credential, email, name, sub } = body;
      const cleanEmail = (email || 'gastonrobertogimenez@gmail.com').toLowerCase().trim();
      const users = getSheetData<any>('USUARIOS', []);
      let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        const uid = `usr_g_${now}`;
        const isAdmin = cleanEmail.includes('admin') || cleanEmail === 'gastonrobertogimenez@gmail.com';
        user = {
          uid,
          nombre: name || 'Gaston Gimenez',
          email: cleanEmail,
          rol: isAdmin ? 'administrador' : 'pasajero',
          esChofer: false,
          tipoVehiculo: null,
          activo: true,
          telefono: '+54 9 3487 55-2190',
          barrio: 'Campana Centro',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
          fechaRegistro: new Date().toISOString(),
          ultimoAcceso: new Date().toISOString(),
          googleSub: sub || 'google_auth',
          emailVerificado: true,
        };
        users.push(user);
        saveSheetData('USUARIOS', users);
      }

      const sessionToken = `tok_g_${now}`;
      setStoredSessionToken(sessionToken);

      return {
        ok: true,
        data: { user, token: sessionToken } as any,
        error: null,
        timestamp: now,
      };
    }

    case 'me': {
      const users = getSheetData<any>('USUARIOS', []);
      const token = getStoredSessionToken();
      // Si hay un usuario en sesión o retornamos el último usuario
      const user = users[0] || null;
      return { ok: true, data: user as any, error: null, timestamp: now };
    }

    case 'logout': {
      setStoredSessionToken(null);
      return { ok: true, data: { loggedOut: true } as any, error: null, timestamp: now };
    }

    // CHAT (Hoja CHAT con TTL 15 minutos)
    case 'getChat': {
      const salaId = String(params.salaId || 'todos');
      const since = Number(params.since || 0);
      const allMsgs = getSheetData<any>('CHAT', []);
      const validTtl = now - 15 * 60 * 1000;

      const filtered = allMsgs.filter((m) => {
        const isNotExpired = (m.enviadoEn || 0) > validTtl && !m.eliminado;
        const matchesSala = salaId === 'todos' || m.salaId === salaId || m.salaId === 'todos';
        const isNewer = since ? m.enviadoEn > since : true;
        return isNotExpired && matchesSala && isNewer;
      });

      return { ok: true, data: filtered as any, error: null, timestamp: now };
    }

    case 'sendChat': {
      const { salaId, usuarioId, nombreUsuario, texto, rol, avatarUrl, replyTo } = body;
      const cleanText = String(texto || '').trim();
      if (!cleanText) {
        return { ok: false, data: null, error: { code: 'EMPTY_TEXT', message: 'Mensaje vacío' }, timestamp: now };
      }

      const allMsgs = getSheetData<any>('CHAT', []);
      const newMsg = {
        id: `msg_${now}_${Math.random().toString(36).substring(2, 6)}`,
        salaId: salaId || 'todos',
        usuarioId: usuarioId || 'usr',
        nombreUsuario: nombreUsuario || 'Vecino UPPA',
        texto: cleanText,
        rol: rol || 'pasajero',
        enviadoEn: now,
        expiraEn: now + 15 * 60 * 1000,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${usuarioId}&backgroundColor=12141c`,
        replyToId: replyTo?.id,
        replyToNombre: replyTo?.nombreUsuario,
        replyToTexto: replyTo?.texto,
        eliminado: false,
      };

      allMsgs.push(newMsg);
      saveSheetData('CHAT', allMsgs);

      bc?.postMessage({ type: 'NEW_CHAT_MESSAGE', message: newMsg });

      return { ok: true, data: newMsg as any, error: null, timestamp: now };
    }

    case 'deleteChatMessage': {
      const { messageId } = body;
      const allMsgs = getSheetData<any>('CHAT', []);
      const updated = allMsgs.map((m) => (m.id === messageId ? { ...m, eliminado: true } : m));
      saveSheetData('CHAT', updated);
      bc?.postMessage({ type: 'DELETE_CHAT_MESSAGE', messageId });
      return { ok: true, data: { deleted: true } as any, error: null, timestamp: now };
    }

    // HABILITACIONES & CHOFERES (Hojas HABILITACIONES y CHOFERES_UBICACION)
    case 'getActiveDrivers': {
      const habs = getSheetData<any>('HABILITACIONES', []);
      const activeHabs = habs.filter((h) => h.estado === 'activo' && h.endsAt > now);
      return { ok: true, data: activeHabs as any, error: null, timestamp: now };
    }

    case 'validateActivationCode': {
      const { code } = body;
      const cleanCode = String(code || '').trim().toUpperCase();
      const codigos = getSheetData<any>('CODIGOS', [
        { codigo: 'UPPA-TX-12H', tipo: 'auto', horas: 12, estado: 'disponible' },
        { codigo: 'UPPA-MOTO-6H', tipo: 'moto', horas: 6, estado: 'disponible' },
        { codigo: 'UPPA-VIP-24H', tipo: 'auto', horas: 24, estado: 'disponible' },
      ]);

      const found = codigos.find((c) => c.codigo.toUpperCase() === cleanCode);
      if (!found) {
        return { ok: false, data: null, error: { code: 'NOT_FOUND', message: 'Código inexistente' }, timestamp: now };
      }
      if (found.estado === 'usado') {
        return { ok: false, data: null, error: { code: 'USED', message: 'El código ya fue utilizado' }, timestamp: now };
      }

      return { ok: true, data: found as any, error: null, timestamp: now };
    }

    case 'activateDriver': {
      const { code, driverId, driverName, vehicleType, vehicleModel, whatsapp, zone, hours } = body;
      const startsAt = now;
      const hoursCount = Number(hours || 12);
      const endsAt = startsAt + hoursCount * 3600 * 1000;

      const habs = getSheetData<any>('HABILITACIONES', []);
      const newHab = {
        id: `hab_${now}`,
        driverId: driverId || `driver_${now}`,
        driverName: driverName || 'Chofer Habilitado',
        vehicleType: vehicleType || 'auto',
        vehicleModel: vehicleModel || 'Vehículo UPPA',
        whatsapp: String(whatsapp || '5493487552190').replace(/\D/g, ''),
        zone: zone || 'Zárate ↔ Campana',
        horas: hoursCount,
        startsAt,
        endsAt,
        estado: 'activo',
        activationCode: code || `UPPA-${now}`,
        creadoEn: now,
        actualizadoEn: now,
      };

      habs.unshift(newHab);
      saveSheetData('HABILITACIONES', habs);

      // Actualizar código en hoja CODIGOS
      const codigos = getSheetData<any>('CODIGOS', []);
      const updatedCodes = codigos.map((c) =>
        c.codigo.toUpperCase() === String(code).toUpperCase()
          ? { ...c, estado: 'usado', driverId: newHab.driverId, usadoEn: now }
          : c
      );
      saveSheetData('CODIGOS', updatedCodes);

      bc?.postMessage({ type: 'DRIVER_ACTIVATED', habilitacion: newHab });

      return { ok: true, data: newHab as any, error: null, timestamp: now };
    }

    case 'verifyAdminPin': {
      const { pin } = body;
      const cleanPin = String(pin || '').trim();
      // Verificación en backend/simulador: 0608
      if (cleanPin === '0608') {
        return { ok: true, data: { verified: true, role: 'administrador' } as any, error: null, timestamp: now };
      }
      return {
        ok: false,
        data: null,
        error: { code: 'INVALID_PIN', message: 'Clave de administración incorrecta. Ingrese 0608 autorizada.' },
        timestamp: now,
      };
    }

    case 'updateDriverLocation': {
      const { driverId, lat, lng, speed, heading } = body;
      const locations = getSheetData<any>('CHOFERES_UBICACION', []);
      const existingIdx = locations.findIndex((l) => l.driverId === driverId);
      const record = {
        driverId,
        lat,
        lng,
        speed: speed || 0,
        heading: heading || 0,
        updatedAt: now,
        activo: true,
      };
      if (existingIdx >= 0) {
        locations[existingIdx] = record;
      } else {
        locations.push(record);
      }
      saveSheetData('CHOFERES_UBICACION', locations);
      return { ok: true, data: { updated: true } as any, error: null, timestamp: now };
    }

    // REPORTES CIUDADANOS (Hoja REPORTES)
    case 'getActiveReports': {
      const reports = getSheetData<any>('REPORTES', []);
      const validTtl = now - 15 * 60 * 1000;
      const active = reports.filter((r) => r.estado === 'activo' && r.creadoEn > validTtl);
      return { ok: true, data: active as any, error: null, timestamp: now };
    }

    case 'createReport': {
      const { usuarioId, nombreUsuario, tipo, descripcion, lat, lng, ruta } = body;
      const reports = getSheetData<any>('REPORTES', []);
      const newReport = {
        id: `rep_${now}_${Math.random().toString(36).substring(2, 5)}`,
        usuarioId: usuarioId || 'usr',
        nombreUsuario: nombreUsuario || 'Vecino UPPA',
        tipo: tipo || 'demora',
        descripcion: descripcion || '',
        lat: Number(lat || -34.1683),
        lng: Number(lng || -58.9592),
        ruta: ruta || 'campana-zarate',
        confirmaciones: 1,
        estado: 'activo',
        creadoEn: now,
        expiraEn: now + 15 * 60 * 1000,
      };
      reports.unshift(newReport);
      saveSheetData('REPORTES', reports);
      bc?.postMessage({ type: 'NEW_REPORT', report: newReport });
      return { ok: true, data: newReport as any, error: null, timestamp: now };
    }

    case 'confirmReport': {
      const { reportId } = body;
      const reports = getSheetData<any>('REPORTES', []);
      const updated = reports.map((r) =>
        r.id === reportId ? { ...r, confirmaciones: (r.confirmaciones || 1) + 1 } : r
      );
      saveSheetData('REPORTES', updated);
      return { ok: true, data: { confirmed: true } as any, error: null, timestamp: now };
    }

    case 'resolveReport': {
      const { reportId } = body;
      const reports = getSheetData<any>('REPORTES', []);
      const updated = reports.map((r) =>
        r.id === reportId ? { ...r, estado: 'resuelto' } : r
      );
      saveSheetData('REPORTES', updated);
      return { ok: true, data: { resolved: true } as any, error: null, timestamp: now };
    }

    // SOLICITUDES DE TRANSPORTE ALTERNATIVO (Hoja SOLICITUDES_TRANSPORTE)
    case 'getTransportRequests': {
      const list = getSheetData<any>('SOLICITUDES_TRANSPORTE', []);
      return { ok: true, data: list as any, error: null, timestamp: now };
    }

    case 'createTransportRequest': {
      const { pasajeroId, nombrePasajero, telefonoPasajero, origen, destino, tipoVehiculoRequerido } = body;
      const list = getSheetData<any>('SOLICITUDES_TRANSPORTE', []);
      const newReq = {
        id: `sol_${now}`,
        usuarioId: pasajeroId || `usr_${now}`,
        nombreUsuario: nombrePasajero || 'Pasajero UPPA',
        tipoVehiculo: tipoVehiculoRequerido || 'moto',
        latOrigen: -34.1683,
        lngOrigen: -58.9592,
        direccionOrigen: origen || 'Campana',
        direccionDestino: destino || 'Zárate',
        estado: 'pendiente',
        telefonoUsuario: telefonoPasajero || '',
        precioEstimado: tipoVehiculoRequerido === 'moto' ? 2500 : 4200,
        creadoEn: now,
      };
      list.unshift(newReq);
      saveSheetData('SOLICITUDES_TRANSPORTE', list);
      bc?.postMessage({ type: 'NEW_TRANSPORT_REQUEST', request: newReq });
      return { ok: true, data: newReq as any, error: null, timestamp: now };
    }

    case 'acceptTransportRequest': {
      const { solicitudId, choferId, nombreChofer, telefonoChofer } = body;
      const list = getSheetData<any>('SOLICITUDES_TRANSPORTE', []);
      const updated = list.map((s) =>
        s.id === solicitudId
          ? {
              ...s,
              estado: 'aceptada',
              choferId,
              nombreChofer,
              telefonoChofer,
              aceptadoEn: now,
            }
          : s
      );
      saveSheetData('SOLICITUDES_TRANSPORTE', updated);
      return { ok: true, data: { accepted: true } as any, error: null, timestamp: now };
    }

    // ADMINISTRACIÓN & AUDITORÍA
    case 'getUsers': {
      const users = getSheetData<any>('USUARIOS', []);
      return { ok: true, data: users as any, error: null, timestamp: now };
    }

    case 'updateUser': {
      const { uid, partial } = body;
      const users = getSheetData<any>('USUARIOS', []);
      const updated = users.map((u) => (u.uid === uid ? { ...u, ...partial } : u));
      saveSheetData('USUARIOS', updated);
      return { ok: true, data: { updated: true } as any, error: null, timestamp: now };
    }

    case 'deleteUser': {
      const { uid } = body;
      const users = getSheetData<any>('USUARIOS', []);
      const updated = users.filter((u) => u.uid !== uid);
      saveSheetData('USUARIOS', updated);
      return { ok: true, data: { deleted: true } as any, error: null, timestamp: now };
    }

    case 'broadcastAdminAlert': {
      const { titulo, descripcion, nivel } = body;
      const alerts = getSheetData<any>('ALERTAS_ADMIN', []);
      const newAlert = {
        id: `alert_${now}`,
        titulo: titulo || 'Alerta Oficial UPPA',
        descripcion: descripcion || '',
        nivel: nivel || 'urgente',
        creadoEn: now,
        activo: true,
      };
      alerts.unshift(newAlert);
      saveSheetData('ALERTAS_ADMIN', alerts);
      bc?.postMessage({ type: 'ADMIN_ALERT', alert: newAlert });
      return { ok: true, data: newAlert as any, error: null, timestamp: now };
    }

    default:
      return { ok: true, data: {} as any, error: null, timestamp: now };
  }
}
