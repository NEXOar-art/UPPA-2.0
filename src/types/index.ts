export type UserRole =
  | 'pasajero'
  | 'chofer_micro'
  | 'chofer_moto'
  | 'chofer_auto'
  | 'administrador'
  | 'passenger'
  | 'driver'
  | 'admin'
  | 'advertiser'
  | 'cliente';

export function mapRoleToAppRole(rol?: string, esChofer?: boolean): UserRole {
  if (rol === 'administrador' || rol === 'admin') return 'admin';
  if (esChofer || rol === 'chofer_auto' || rol === 'chofer_moto' || rol === 'chofer_micro' || rol === 'driver') {
    return 'driver';
  }
  return 'passenger';
}
export const mapFirestoreRolToAppRole = mapRoleToAppRole;

export interface User {
  id: string;
  name: string;
  nombre?: string;
  email: string;
  role: UserRole;
  phone?: string;
  barrio?: string;
  avatarUrl?: string;
  uid?: string;
  rol?: 'pasajero' | 'chofer_micro' | 'chofer_moto' | 'chofer_auto' | 'administrador' | 'cliente' | string;
  esChofer?: boolean;
  tipoVehiculo?: 'moto' | 'auto' | 'micro' | null;
  activo?: boolean;
  fotoPerfil?: string;
  telefono?: string;
  estado?: 'activo' | 'inactivo' | 'suspendido';
  emailVerificado?: boolean;
  ultimaConexion?: any;
  fechaRegistro?: any;
}

export interface UsuarioFirestore {
  uid: string;
  nombre: string;
  email: string;
  rol: 'pasajero' | 'chofer_micro' | 'chofer_moto' | 'chofer_auto' | 'administrador';
  esChofer: boolean;
  tipoVehiculo: 'moto' | 'auto' | 'micro' | null;
  activo: boolean;
  emailVerificado?: boolean;
  fotoPerfil?: string;
  telefono?: string;
  barrio?: string;
  ultimaConexion?: any;
  fechaRegistro?: any;
}

export type EventType =
  | 'late'        // 🚌 Micro llega tarde / Demora
  | 'breakdown'   // 🔧 Micro averiado
  | 'missed'      // ❌ No pasó
  | 'accident'    // 💥 Choque / Accidente (Rojo)
  | 'traffic'     // 🚗 Tráfico denso / Congestión (Naranja)
  | 'moving'      // ⚡ Unidad en movimiento / Normal (Verde)
  | 'danger'      // 🚧 Calle cortada / Alerta
  | 'corte'       // ⛔ Corte de ruta
  | 'control';    // 👮 Control policial

export interface MapEvent {
  id: string;
  routeId: string;
  type: EventType;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  reportedBy: string;
  reportedByUserId: string;
  confirmations: number;
  confirmedByUserIds: string[];
  reportedAt: string;
  direction?: 'hacia_malvinas' | 'hacia_zarate' | 'ambas';
  isVerified?: boolean;
  ruta?: string;
  estado?: 'activo' | 'resuelto' | 'oculto';
}

export interface ReporteFirestore {
  id: string;
  usuarioId: string;
  nombreUsuario: string;
  tipo: 'demora' | 'accidente' | 'corte' | 'control' | 'congestion' | 'alerta';
  descripcion: string;
  ubicacion: {
    lat: number;
    lng: number;
  };
  ruta: string; // 'campana-zarate' | 'zarate-campana' | 'vigalondo-mcdonalds' | 'general'
  estado: 'activo' | 'resuelto' | 'oculto';
  creadoEn: any;
  confirmaciones?: number;
}

export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sequence: number;
  zone?: string;
  description?: string;
}

export interface TransitRoute {
  id: string;
  name: string;
  shortName: string;
  code: string;
  description: string;
  color: string;
  coordinates: [number, number][]; // [lat, lng]
  stops: BusStop[];
  status: 'normal' | 'delayed' | 'critical';
  frequencyMinutes: number;
  currentDelayMinutes: number;
  lastUpdated: string;
}

export interface DriverActivationCode {
  code: string;
  driverName: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  whatsapp: string;
  hours: number;
  paymentId?: string;
  isUsed: boolean;
  activatedAt?: number;
  expiresAt?: number;
  createdAt: string;
  activatedByAdmin?: boolean;
  adminPinUsed?: string;
}

export interface HabilitacionChofer {
  id: string;
  driverId: string;
  driverName: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  whatsapp: string;
  zone: string;
  horas: number;
  estado: 'pendiente' | 'activo' | 'expirado' | 'revocado';
  activadoConClaveAdmin?: boolean;
  claveAdminUsada?: string; // '0608'
  activationCode?: string;
  startsAt?: number;
  endsAt?: number;
  comprobanteUrl?: string;
  comprobanteFileName?: string;
  alias?: string; // 'luciaveronicag'
  cvu?: string; // '0000003100020253501840'
  titular?: string; // 'Lucia Veronica Gimenez'
  createdAt?: any;
  habilitadoPor?: string;
  adminNotes?: string;
}

export interface TaxiListing {
  id: string;
  userId: string;
  driverName: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  plate?: string;
  whatsapp: string;
  zone: string;
  lat: number;
  lng: number;
  hoursPaid: number;
  startsAt: number;
  endsAt: number;
  status: 'active' | 'expired' | 'pending';
  rating: number;
  completedRides: number;
  avatarUrl?: string;
  activationCode?: string;
  isOnline?: boolean;
  disponibilidad?: 'desocupado' | 'ocupado';
}

export interface SolicitudTransporteFirestore {
  id: string;
  pasajeroId: string;
  nombrePasajero: string;
  telefonoPasajero?: string;
  origen: string;
  destino: string;
  origenCoords?: { lat: number; lng: number };
  destinoCoords?: { lat: number; lng: number };
  estado: 'pendiente' | 'aceptado' | 'en_camino' | 'completado' | 'cancelado' | 'expirada';
  tipoVehiculoRequerido: 'moto' | 'auto';
  choferId: string | null;
  choferNombre?: string | null;
  choferTelefono?: string | null;
  fechaSolicitud: any;
  fechaAceptado?: number; // Timestamp de aceptación para ventana de exposición de 30 minutos
  expiresAt?: number; // Temporizador límite de 12 minutos
  actualizadoEn?: any;
  precioEstimado?: number;
  distanciaKm?: number;
}

export interface CalificacionChoferFirestore {
  id: string;
  driverId: string;
  driverName: string;
  pasajeroId: string;
  pasajeroNombre: string;
  puntuacion: 1 | 2 | 3 | 4 | 5; // 1 = Malo, 2 = Insuficiente, 3 = Regular, 4 = Bueno, 5 = Muy Bueno
  comentario?: string;
  timestamp: number;
  expiresAt: number; // Vigencia de 3 horas en el ranking
}

export interface PaymentProof {
  id: string;
  userId: string;
  userName: string;
  whatsapp: string;
  vehicleType: 'moto' | 'auto';
  vehicleModel: string;
  zone: string;
  amount: number;
  hours: number;
  proofUrl: string;
  proofFileName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  alias: string;
  adminNotes?: string;
  activationCode?: string;
}

export interface ChatMessage {
  id: string;
  channel: 'campana-zarate' | 'zarate-campana' | 'general' | 'colectora-ruta6' | 'zarate-malvinas';
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  mapEventId?: string;
  userRole?: string;
  avatarUrl?: string;
  replyTo?: {
    id: string;
    userName: string;
    content: string;
  };
  isReported?: boolean;
}

export interface MensajeChatFirestore {
  id: string;
  salaId: string;
  usuarioId: string;
  nombreUsuario: string;
  texto: string;
  rol: string;
  enviadoEn: any;
  avatarUrl?: string;
  replyTo?: {
    id: string;
    nombreUsuario: string;
    texto: string;
  };
  reportado?: boolean;
  reacciones?: Record<string, number>;
  userReactions?: Record<string, string[]>;
  telefonoContacto?: string;
}

export interface PushNotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'reporte' | 'chat' | 'transporte' | 'admin';
  timestamp: number;
  exposureExpiresAt?: number;
  data?: any;
  read?: boolean;
}

export interface CodigoHabilitacionFirestore {
  codigo: string;
  usado: boolean;
  tipoVehiculo: 'moto' | 'auto';
  creadoEn: number;
  usadoPor: string | null;
}

export interface AdListing {
  id: string;
  businessName: string;
  category: string;
  title: string;
  description: string;
  phone: string;
  linkUrl: string;
  whatsappUrl?: string;
  imageUrl?: string;
  zone: string;
  discountBadge?: string;
  isActive: boolean;
}

export interface LiveBus {
  id: string;
  routeId: string;
  internalNumber: string;
  lat: number;
  lng: number;
  heading: number; // degrees
  nextStopName: string;
  etaMinutes: number;
  occupancy: 'baja' | 'media' | 'alta';
  speedKmH: number;
}

export interface AnalyticsSummary {
  usuariosConectados: number;
  reportesActivos: number;
  viajesSolicitados: number;
  viajesCompletados: number;
  mensajesEnviados: number;
  tiempoPromedioAceptacionMinutos: number;
  solicitudesEmergencia: number;
  reportesPorZona: { zona: string; cantidad: number }[];
  demorasPorHorario: { franja: string; cantidad: number }[];
}
