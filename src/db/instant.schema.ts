/**
 * UPPA Comunidad de Transporte - Esquema de Base de Datos
 * Compatible con InstantDB / DB Square para lectura, escritura, edición y eliminación de datos.
 * Sin secretos ni claves admin expuestas en el frontend.
 */

export interface InstantSchema {
  usuarios: {
    id: string;
    email: string;
    nombre: string;
    rol: 'pasajero' | 'chofer_moto' | 'chofer_auto' | 'chofer_micro' | 'administrador';
    esChofer: boolean;
    tipoVehiculo?: 'moto' | 'auto' | null;
    habilitado: boolean;
    telefono?: string;
    barrio?: string;
    creadoEn: number;
    actualizadoEn: number;
  };

  codigos_habilitacion: {
    id: string; // Código de 6 dígitos único (ej: H4K9P2)
    usado: boolean;
    tipoVehiculo: 'moto' | 'auto';
    creadoEn: number;
    usadoPor: string | null;
    horas: number;
  };

  reportes: {
    id: string;
    usuarioId: string;
    nombreUsuario: string;
    tipo: 'demora' | 'accidente' | 'corte' | 'control' | 'congestion' | 'alerta';
    descripcion: string;
    lat: number;
    lng: number;
    rutaId: string;
    creadoEn: number;
    expiraEn: number;
    confirmaciones: number;
  };

  mensajes_chat: {
    id: string;
    usuarioId: string;
    nombreUsuario: string;
    texto: string;
    canal: string;
    creadoEn: number;
    adjuntoUrl?: string;
  };

  choferes_activos: {
    id: string;
    usuarioId: string;
    nombre: string;
    tipoVehiculo: 'moto' | 'auto';
    modelo: string;
    whatsapp: string;
    zona: string;
    lat: number;
    lng: number;
    enLinea: boolean;
    inicioTurno: number;
    finTurno: number;
    codigoHabilitacion: string;
  };
}

export const INSTANT_ENTITIES = {
  usuarios: 'usuarios',
  codigos_habilitacion: 'codigos_habilitacion',
  reportes: 'reportes',
  mensajes_chat: 'mensajes_chat',
  choferes_activos: 'choferes_activos',
} as const;
