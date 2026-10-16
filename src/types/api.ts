export interface ApiResponse<T = any> {
  ok: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  timestamp: number;
}

export interface ApiUserRecord {
  uid: string;
  nombre: string;
  email: string;
  rol: 'pasajero' | 'chofer_micro' | 'chofer_moto' | 'chofer_auto' | 'administrador' | string;
  esChofer: boolean;
  tipoVehiculo: 'moto' | 'auto' | 'micro' | null;
  activo: boolean;
  telefono?: string;
  barrio?: string;
  avatarUrl?: string;
  fechaRegistro?: string;
  ultimoAcceso?: string;
  googleSub?: string;
  emailVerificado?: boolean;
}

export interface ApiSessionRecord {
  sessionId: string;
  uid: string;
  token: string;
  creadaEn: number;
  expiraEn: number;
  ultimoUso: number;
  activo: boolean;
  user: ApiUserRecord;
}

export interface ApiChatMessageRecord {
  id: string;
  salaId: string;
  usuarioId: string;
  nombreUsuario: string;
  texto: string;
  rol: string;
  enviadoEn: number;
  expiraEn: number;
  avatarUrl?: string;
  replyToId?: string;
  replyToNombre?: string;
  replyToTexto?: string;
  eliminado?: boolean;
}

export interface ApiHabilitacionRecord {
  id: string;
  driverId: string;
  driverName: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  whatsapp: string;
  zone: string;
  horas: number;
  startsAt: number;
  endsAt: number;
  estado: 'pendiente' | 'activo' | 'expirado' | 'cancelado';
  activationCode?: string;
  comprobanteUrl?: string;
  creadoEn: number;
  actualizadoEn: number;
}

export interface ApiCodigoRecord {
  codigo: string;
  tipo: 'moto' | 'auto';
  horas: number;
  driverId?: string;
  creadoEn: number;
  usadoEn?: number;
  estado: 'disponible' | 'usado' | 'expirado';
}

export interface ApiReporteRecord {
  id: string;
  usuarioId: string;
  nombreUsuario: string;
  tipo: 'demora' | 'accidente' | 'congestion' | 'corte' | 'control' | 'alerta';
  descripcion: string;
  lat: number;
  lng: number;
  ruta: string;
  confirmaciones: number;
  estado: 'activo' | 'resuelto' | 'expirado';
  creadoEn: number;
  expiraEn: number;
}

export interface ApiChoferUbicacionRecord {
  driverId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  updatedAt: number;
  activo: boolean;
}

export interface ApiSolicitudTransporteRecord {
  id: string;
  usuarioId: string;
  nombreUsuario: string;
  tipoVehiculo: 'moto' | 'auto';
  latOrigen: number;
  lngOrigen: number;
  direccionOrigen: string;
  direccionDestino?: string;
  estado: 'pendiente' | 'aceptada' | 'en_camino' | 'finalizada' | 'cancelada';
  choferId?: string;
  nombreChofer?: string;
  telefonoChofer?: string;
  telefonoUsuario?: string;
  precioEstimado?: number;
  creadoEn: number;
  aceptadoEn?: number;
  finalizadoEn?: number;
}

export interface ApiAdminAlertaRecord {
  id: string;
  titulo: string;
  descripcion: string;
  nivel: 'informativa' | 'urgente' | 'critica';
  creadoEn: number;
  activo: boolean;
}

export interface ApiAuditoriaRecord {
  id: string;
  fecha: number;
  adminUid: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalle: string;
  ip?: string;
  userAgent?: string;
}

export interface ApiConfigRecord {
  PAYMENT_ALIAS: string;
  PAYMENT_CVU: string;
  VERIFICATION_WHATSAPP: string;
  PRICE_2H: number;
  PRICE_6H: number;
  PRICE_12H: number;
  PRICE_24H: number;
}
