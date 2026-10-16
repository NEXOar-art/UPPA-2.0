import { apiRequest } from './api';
import { ApiSolicitudTransporteRecord } from '../types/api';
import { SolicitudTransporteFirestore } from '../types';

export function formatTransportRequest(s: ApiSolicitudTransporteRecord): SolicitudTransporteFirestore {
  return {
    id: s.id,
    pasajeroId: s.usuarioId,
    nombrePasajero: s.nombreUsuario,
    telefonoPasajero: s.telefonoUsuario,
    origen: s.direccionOrigen,
    destino: s.direccionDestino || 'Destino',
    tipoVehiculoRequerido: s.tipoVehiculo,
    estado: s.estado as any,
    choferId: s.choferId || null,
    choferNombre: s.nombreChofer,
    choferTelefono: s.telefonoChofer,
    fechaSolicitud: s.creadoEn,
    precioEstimado: s.precioEstimado,
  };
}

export function subscribeToTransportRequests(
  callback: (solicitudes: SolicitudTransporteFirestore[]) => void
): () => void {
  let isMounted = true;
  let currentList: SolicitudTransporteFirestore[] = [];

  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('uppa_sheets_sync')
    : null;

  const handleBroadcast = (ev: MessageEvent) => {
    if (!isMounted) return;
    if (ev.data?.type === 'NEW_TRANSPORT_REQUEST') {
      const incoming = formatTransportRequest(ev.data.request);
      currentList = [incoming, ...currentList.filter((s) => s.id !== incoming.id)];
      callback(currentList);
    }
  };

  if (bc) {
    bc.addEventListener('message', handleBroadcast);
  }

  const fetchList = async () => {
    try {
      const res = await apiRequest<ApiSolicitudTransporteRecord[]>('getTransportRequests', { method: 'GET' });
      if (res.ok && res.data && isMounted) {
        currentList = res.data.map(formatTransportRequest);
        callback(currentList);
      }
    } catch {}
  };

  fetchList();
  const poll = setInterval(fetchList, 4000);

  return () => {
    isMounted = false;
    clearInterval(poll);
    if (bc) {
      bc.removeEventListener('message', handleBroadcast);
      bc.close();
    }
  };
}

export async function createTransportRequest(data: {
  pasajeroId: string;
  nombrePasajero: string;
  telefonoPasajero?: string;
  origen: string;
  destino: string;
  tipoVehiculoRequerido: 'moto' | 'auto';
  precioEstimado?: number;
  distanciaKm?: number;
}): Promise<SolicitudTransporteFirestore> {
  const res = await apiRequest<ApiSolicitudTransporteRecord>('createTransportRequest', {
    method: 'POST',
    body: data,
  });

  if (res.ok && res.data) {
    return formatTransportRequest(res.data);
  }

  return {
    id: `sol_local_${Date.now()}`,
    pasajeroId: data.pasajeroId,
    nombrePasajero: data.nombrePasajero,
    telefonoPasajero: data.telefonoPasajero,
    origen: data.origen,
    destino: data.destino,
    tipoVehiculoRequerido: data.tipoVehiculoRequerido,
    estado: 'pendiente',
    choferId: null,
    fechaSolicitud: Date.now(),
    precioEstimado: data.precioEstimado,
    distanciaKm: data.distanciaKm,
  };
}

export async function acceptTransportRequest(
  solicitudId: string,
  choferId: string,
  nombreChofer: string,
  telefonoChofer: string
): Promise<void> {
  await apiRequest('acceptTransportRequest', {
    method: 'POST',
    body: {
      solicitudId,
      choferId,
      nombreChofer,
      telefonoChofer,
    },
  });
}

export async function updateRequestStatus(
  solicitudId: string,
  estado: string
): Promise<void> {
  await apiRequest('updateTransportRequestStatus', {
    method: 'POST',
    body: { solicitudId, estado },
  });
}
