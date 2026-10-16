import { apiRequest } from './api';
import { ApiReporteRecord } from '../types/api';
import { ReporteFirestore, MapEvent } from '../types';

export function formatReportRecord(r: ApiReporteRecord): ReporteFirestore {
  return {
    id: r.id,
    usuarioId: r.usuarioId,
    nombreUsuario: r.nombreUsuario,
    tipo: r.tipo as any,
    descripcion: r.descripcion,
    ubicacion: { lat: r.lat, lng: r.lng },
    ruta: r.ruta,
    confirmaciones: r.confirmaciones || 1,
    estado: r.estado === 'resuelto' ? 'resuelto' : 'activo',
    creadoEn: r.creadoEn,
  };
}

export function subscribeToReports(
  callback: (reportes: ReporteFirestore[]) => void,
  onError?: (err: any) => void
): () => void {
  let isMounted = true;
  let activeReports: ReporteFirestore[] = [];

  const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('uppa_sheets_sync')
    : null;

  const handleBroadcast = (ev: MessageEvent) => {
    if (!isMounted) return;
    if (ev.data?.type === 'NEW_REPORT') {
      const incoming = formatReportRecord(ev.data.report);
      activeReports = [incoming, ...activeReports.filter((r) => r.id !== incoming.id)];
      callback(activeReports);
    }
  };

  if (bc) {
    bc.addEventListener('message', handleBroadcast);
  }

  const fetchReports = async () => {
    try {
      const res = await apiRequest<ApiReporteRecord[]>('getActiveReports', { method: 'GET' });
      if (res.ok && res.data && isMounted) {
        activeReports = res.data.map(formatReportRecord);
        callback(activeReports);
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchReports();
  const poll = setInterval(fetchReports, 5000);

  return () => {
    isMounted = false;
    clearInterval(poll);
    if (bc) {
      bc.removeEventListener('message', handleBroadcast);
      bc.close();
    }
  };
}

export async function createReport(data: {
  usuarioId: string;
  nombreUsuario: string;
  tipo: string;
  descripcion: string;
  ubicacion: { lat: number; lng: number };
  ruta: string;
}): Promise<ReporteFirestore> {
  const res = await apiRequest<ApiReporteRecord>('createReport', {
    method: 'POST',
    body: {
      usuarioId: data.usuarioId,
      nombreUsuario: data.nombreUsuario,
      tipo: data.tipo,
      descripcion: data.descripcion,
      lat: data.ubicacion.lat,
      lng: data.ubicacion.lng,
      ruta: data.ruta,
    },
  });

  if (res.ok && res.data) {
    return formatReportRecord(res.data);
  }

  return {
    id: `rep_local_${Date.now()}`,
    usuarioId: data.usuarioId,
    nombreUsuario: data.nombreUsuario,
    tipo: data.tipo as any,
    descripcion: data.descripcion,
    ubicacion: data.ubicacion,
    ruta: data.ruta,
    confirmaciones: 1,
    estado: 'activo',
    creadoEn: Date.now(),
  };
}

export async function confirmReport(reportId: string): Promise<void> {
  await apiRequest('confirmReport', {
    method: 'POST',
    body: { reportId },
  });
}

export async function resolveReport(reportId: string): Promise<void> {
  await apiRequest('resolveReport', {
    method: 'POST',
    body: { reportId },
  });
}
