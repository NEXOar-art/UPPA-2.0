import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { TransitRoute, MapEvent, LiveBus, TaxiListing, BusStop, EventType, SolicitudTransporteFirestore } from '../../types';
import { UserLocation, getDistanceKm, isCoordinateAddress } from '../../utils/geolocation';
import {
  calculateRealBusSpeed,
  calculateRealBusHeading,
  captureMostPreciseGpsReading,
  formatHeadingCardinal,
} from '../../utils/busSpeedEstimator';

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
import {
  playMicroSound,
  startPassengerApproachAlarm,
  stopPassengerApproachAlarm,
} from '../../utils/soundEffects';
import { MAP_CONFIG } from '../../config/api';
import {
  Crosshair,
  Layers,
  Navigation,
  CloudRain,
  Radio,
  Car,
  Compass,
  CheckCircle,
  Eye,
  Bus,
  Clock,
  MapPin,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Key,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  MessageCircle,
  Zap,
  Bike,
  ExternalLink,
  Search,
  Fuel,
  GraduationCap,
  Plus,
  SlidersHorizontal,
  EyeOff,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { isRealCommunityReport } from '../../services/realtimeFirebaseService';
import {
  GAS_STATIONS_DATA,
  SCHOOLS_DATA,
  HOSPITALS_DATA,
  TRAIN_STATIONS_DATA,
  PointOfInterest,
} from '../../data/poiCorredorData';
import { LINEA_228_STOPS, LINEA_228_COORDINATES } from '../../data/linea228Stops';
import { computeEventExpiresAtMs, isMapEventExpired } from '../../utils/eventExpiration';

export const CARTOGRAPHY_API_KEY = '0a49b2d34b5b7e8b65a6bd7da25e4bd8';

const TILE_PROVIDERS = {
  'tesla-dark': {
    name: 'Tesla Dark Moderno (Sin marcas)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abcd',
    attribution: '© CARTO, OpenStreetMap & UPPA',
    maxZoom: 20,
  },
  'streets': {
    name: 'Calles & Rutas (HD)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    attribution: '© CARTO, OpenStreetMap & UPPA',
    maxZoom: 20,
  },
  'osm': {
    name: 'OpenStreetMap Estándar',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    fallbackUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  'weather-radar': {
    name: 'Radar de Lluvia',
    url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=0a49b2d34b5b7e8b65a6bd7da25e4bd8',
    attribution: '© OWM',
    maxZoom: 18,
  },
};

interface TeslaMapProps {
  routes: TransitRoute[];
  events: MapEvent[];
  liveBuses: LiveBus[];
  taxis: TaxiListing[];
  selectedEvent: MapEvent | null;
  onSelectEvent: (event: MapEvent) => void;
  onSelectTaxi: (taxi: TaxiListing) => void;
  onOpenReportModal?: () => void;
  onOpenTaxisView?: () => void;
  onMapClickLocation?: (lat: number, lng: number) => void;
  isPinDropMode?: boolean;
  selectedRouteId: string;
  onSelectRouteId: (routeId: string) => void;
  userLocation?: UserLocation | null;
  isDriverMode?: boolean;
  isDriverOnline?: boolean;
  driverDisponibilidad?: 'desocupado' | 'ocupado';
  onToggleDriverDisponibilidad?: () => void;
  hasUnvalidatedRide?: boolean;
  activeTrackingTaxi?: TaxiListing | null;
  onClearTrackingTaxi?: () => void;
  activeTrackingPassenger?: SolicitudTransporteFirestore | null;
  onClearTrackingPassenger?: () => void;
  onFinalizePassengerRide?: (solicitudId: string) => void | Promise<void>;
  onOpenPedirTransporte?: () => void;
  onAddEvent?: (event: Omit<MapEvent, 'id' | 'confirmations' | 'confirmedByUserIds' | 'reportedAt'>) => void;
  currentUserName?: string;
  currentUserId?: string;
  focusedStop?: BusStop | null;
  hideTopBarButtons?: boolean;
  onOpenTrainSection?: (stationId: 'campana' | 'zarate') => void;
}

export const TRANSIT_EVENT_TYPES: {
  id: string;
  type: EventType;
  icon: string;
  label: string;
  subtitle: string;
  defaultTitle: string;
  colorClass: string;
  isPrimary?: boolean;
}[] = [
  {
    id: 'ubicacion_colectivo',
    type: 'bus_location',
    icon: '📍',
    label: 'Ubicación de colectivo ahora',
    subtitle: 'Reportá el paso de la unidad en este instante (vigente por 1 minuto)',
    defaultTitle: 'Ubicación de colectivo ahora',
    colorClass: 'bg-gradient-to-r from-cyan-500/25 via-sky-500/20 to-blue-500/25 hover:from-cyan-500/35 hover:to-blue-500/35 border-cyan-400/60 text-cyan-100 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-500/20',
    isPrimary: true,
  },
  {
    id: 'accidente',
    type: 'accident',
    icon: '💥',
    label: 'Accidente en Ruta / Calle',
    subtitle: 'Choque o siniestro vial que obstruye la calzada',
    defaultTitle: 'Accidente vial',
    colorClass: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-200',
  },
  {
    id: 'demora',
    type: 'late',
    icon: '⏳',
    label: 'Demora Prolongada',
    subtitle: 'Colectivo con atraso mayor a 20 minutos',
    defaultTitle: 'Demora en servicio',
    colorClass: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-200',
  },
  {
    id: 'congestion',
    type: 'traffic',
    icon: '🚗',
    label: 'Congestión / Tránsito Lento',
    subtitle: 'Tránsito a paso de hombre en rotonda o colectora',
    defaultTitle: 'Tránsito lento',
    colorClass: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-200',
  },
  {
    id: 'corte',
    type: 'corte',
    icon: '🚧',
    label: 'Corte de Calle / Desvío',
    subtitle: 'Calle cerrada por obras, baches o piquete con desvío',
    defaultTitle: 'Corte y desvío',
    colorClass: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-200',
  },
  {
    id: 'averia',
    type: 'breakdown',
    icon: '🔧',
    label: 'Unidad Averiada',
    subtitle: 'Colectivo detenido por desperfecto mecánico o neumático',
    defaultTitle: 'Micro averiado',
    colorClass: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-200',
  },
  {
    id: 'salteo',
    type: 'missed',
    icon: '❌',
    label: 'No Paró / Colectivo Lleno',
    subtitle: 'El chofer no se detuvo en la parada o venía colmado',
    defaultTitle: 'No frenó en parada',
    colorClass: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200',
  },
  {
    id: 'control',
    type: 'control',
    icon: '👮',
    label: 'Control Policial / Tránsito',
    subtitle: 'Operativo de control o fiscalización en la traza · Exposición 3.5 hs',
    defaultTitle: 'Control vehicular',
    colorClass: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-200',
  },
  {
    id: 'inundacion',
    type: 'inundacion',
    icon: '🌧️',
    label: 'Calle Anegada / Inundada',
    subtitle: 'Acumulación de agua de lluvia o pozo profundo · Exposición 10 hs',
    defaultTitle: 'Calle anegada',
    colorClass: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-200',
  },
  {
    id: 'normal',
    type: 'moving',
    icon: '⚡',
    label: 'Servicio Normal / Con Asiento',
    subtitle: 'Colectivo circulando a horario y con lugares disponibles',
    defaultTitle: 'Recorrido fluido',
    colorClass: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-200',
  },
  {
    id: 'alerta',
    type: 'danger',
    icon: '⚠️',
    label: 'Alerta General / Peligro',
    subtitle: 'Semáforo fuera de servicio o peligro en calzada',
    defaultTitle: 'Alerta de tránsito',
    colorClass: 'bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 text-amber-200',
  },
];

export const EVENT_FILTER_CATEGORIES: {
  key: string;
  icon: string;
  tooltip: string;
  ring: string;
  bg: string;
}[] = [
  { key: 'bus_location', icon: '📍', tooltip: 'Colectivo en vivo', ring: 'ring-cyan-400/60', bg: 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50 shadow-cyan-500/30' },
  { key: 'accident', icon: '💥', tooltip: 'Accidentes', ring: 'ring-red-400/60', bg: 'bg-red-500/25 text-red-200 border-red-500/50 shadow-red-500/30' },
  { key: 'late', icon: '⏳', tooltip: 'Demoras', ring: 'ring-yellow-400/60', bg: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/50 shadow-yellow-500/30' },
  { key: 'traffic', icon: '🚗', tooltip: 'Tránsito lento', ring: 'ring-orange-400/60', bg: 'bg-orange-500/25 text-orange-200 border-orange-500/50 shadow-orange-500/30' },
  { key: 'corte', icon: '🚧', tooltip: 'Cortes y desvíos', ring: 'ring-purple-400/60', bg: 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-purple-500/30' },
  { key: 'control', icon: '👮', tooltip: 'Controles', ring: 'ring-indigo-400/60', bg: 'bg-indigo-500/25 text-indigo-200 border-indigo-500/50 shadow-indigo-500/30' },
  { key: 'breakdown', icon: '🔧', tooltip: 'Averías', ring: 'ring-rose-400/60', bg: 'bg-rose-500/25 text-rose-200 border-rose-500/50 shadow-rose-500/30' },
  { key: 'missed', icon: '❌', tooltip: 'No paró / Lleno', ring: 'ring-amber-400/60', bg: 'bg-amber-500/25 text-amber-200 border-amber-500/50 shadow-amber-500/30' },
  { key: 'inundacion', icon: '🌧️', tooltip: 'Calles anegadas', ring: 'ring-cyan-400/60', bg: 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50 shadow-cyan-500/30' },
  { key: 'moving', icon: '⚡', tooltip: 'Servicio fluido', ring: 'ring-emerald-400/60', bg: 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50 shadow-emerald-500/30' },
  { key: 'other', icon: '⚠️', tooltip: 'Otras alertas', ring: 'ring-amber-400/60', bg: 'bg-amber-500/25 text-amber-200 border-amber-500/50 shadow-amber-500/30' },
];

interface TrajectoryResult {
  coordinates: [number, number][];
  distKm: number;
  etaMinutes: number;
}

export const TeslaMap: React.FC<TeslaMapProps> = ({
  routes,
  events,
  liveBuses,
  taxis,
  selectedEvent,
  onSelectEvent,
  onSelectTaxi,
  onOpenReportModal,
  onOpenTaxisView,
  onMapClickLocation,
  isPinDropMode = false,
  selectedRouteId,
  onSelectRouteId,
  userLocation,
  isDriverMode = false,
  isDriverOnline = false,
  driverDisponibilidad = 'desocupado',
  onToggleDriverDisponibilidad,
  hasUnvalidatedRide = false,
  activeTrackingTaxi,
  onClearTrackingTaxi,
  activeTrackingPassenger,
  onClearTrackingPassenger,
  onFinalizePassengerRide,
  onOpenPedirTransporte,
  onAddEvent,
  currentUserName,
  currentUserId,
  focusedStop,
  hideTopBarButtons = false,
  onOpenTrainSection,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const onOpenTrainSectionRef = useRef(onOpenTrainSection);
  onOpenTrainSectionRef.current = onOpenTrainSection;

  // Layers
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const weatherLayerRef = useRef<L.TileLayer | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const taxisLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);
  const trajectoryLayerRef = useRef<L.LayerGroup | null>(null);
  const stopTrajectoryLayerRef = useRef<L.LayerGroup | null>(null);
  const passengerTrackingLayerRef = useRef<L.LayerGroup | null>(null);
  const gasStationsLayerRef = useRef<L.LayerGroup | null>(null);
  const schoolsLayerRef = useRef<L.LayerGroup | null>(null);
  const hospitalsLayerRef = useRef<L.LayerGroup | null>(null);
  const trainStationsLayerRef = useRef<L.LayerGroup | null>(null);

  // Passenger Trajectory state for drivers navigating to passenger pickup
  const [passengerTrajectoryInfo, setPassengerTrajectoryInfo] = useState<{
    solicitud: SolicitudTransporteFirestore;
    distKm: number;
    etaDriveMin: number;
    driverLat: number;
    driverLng: number;
    passengerLat: number;
    passengerLng: number;
  } | null>(null);
  const [isPassengerHudMinimized, setIsPassengerHudMinimized] = useState(false);

  // Map state
  const [activeTileStyle, setActiveTileStyle] = useState<'streets' | 'tesla-dark' | 'osm'>('osm');
  const [showWeatherRadar, setShowWeatherRadar] = useState(false);
  const [showStops, setShowStops] = useState(true);
  const [showGasStations, setShowGasStations] = useState(false);
  const [showSchools, setShowSchools] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [showTrainStations, setShowTrainStations] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showTaxis, setShowTaxis] = useState(true);
  const [isEventFilterPanelOpen, setIsEventFilterPanelOpen] = useState(false);
  const [activeEventCategories, setActiveEventCategories] = useState<Record<string, boolean>>({
    bus_location: true,
    accident: true,
    late: true,
    traffic: true,
    corte: true,
    control: true,
    breakdown: true,
    missed: true,
    inundacion: true,
    moving: true,
    other: true,
  });
  const [isStopsPanelOpen, setIsStopsPanelOpen] = useState(false);
  const [isEventsPanelOpen, setIsEventsPanelOpen] = useState(false);
  const [stopSearchQuery, setStopSearchQuery] = useState('');
  const [eventCustomNote, setEventCustomNote] = useState('');
  const [eventRegisteredToast, setEventRegisteredToast] = useState<string | null>(null);
  const [gpsCalibrationStatus, setGpsCalibrationStatus] = useState<{
    samples: number;
    bestAccuracy: number;
  } | null>(null);
  const [selectedStop, setSelectedStop] = useState<{ stop: BusStop; route: TransitRoute } | null>(null);
  const userLocationRef = useRef<UserLocation | null | undefined>(userLocation);
  userLocationRef.current = userLocation;

  // Live 1-second ticker para expiración estricta de 1 minuto en "Ubicación de colectivo ahora"
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dirección seleccionada para "Ubicación de colectivo ahora"
  const [busDirection, setBusDirection] = useState<'hacia_zarate' | 'hacia_malvinas'>('hacia_zarate');

  // Trajectory state for driver tracking
  const [trajectoryInfo, setTrajectoryInfo] = useState<TrajectoryResult | null>(null);

  // Trajectory state for stop tracking (Punto A Usuario -> Punto B Parada Titilando)
  const [stopTrajectoryInfo, setStopTrajectoryInfo] = useState<{
    stop: BusStop;
    route: TransitRoute;
    distKm: number;
    etaWalkMin: number;
    etaTransitMin: number;
    userLat: number;
    userLng: number;
  } | null>(null);

  const formatStopNameForSpeech = (rawName: string): string =>
    rawName
      .replace(/\bC\.\s*Chapuis\b/gi, 'Claudio Chapuis')
      .replace(/\bDr\.\s*/gi, 'Doctor ')
      .replace(/\bAv\.\s*/gi, 'Avenida ')
      .replace(/\bB°\s*/gi, 'Barrio ')
      .replace(/\bRP\s*6\b/gi, 'Ruta Provincial 6')
      .replace(/\bRN\s*9\b/gi, 'Ruta Nacional 9');

  const speakStopAnnouncement = (stop: BusStop, mode: 'select' | 'gps' = 'select') => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const spokenName = formatStopNameForSpeech(stop.name);
        const seqPart = stop.sequence ? `Parada ${stop.sequence}, ` : 'Parada ';
        const text =
          mode === 'gps'
            ? `Iniciando guía GPS hacia ${seqPart}${spokenName}`
            : `${seqPart}${spokenName}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-AR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  // Focus on a stop when requested from bottom sheet
  useEffect(() => {
    if (!focusedStop || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([focusedStop.lat, focusedStop.lng], 16, {
      animate: true,
      duration: 1.2,
    });
    const matchedRoute = routes.find((r) => r.id === 'route-zarate-malvinas') || routes[0];
    if (matchedRoute) {
      setSelectedStop({ stop: focusedStop, route: matchedRoute });
      scheduleHideTimerRef.current(8000);
      speakStopAnnouncement(focusedStop, 'select');
    }
  }, [focusedStop, routes]);

  // Auto-hide cards logic: 3.5 seconds of exposure, waking up on touch/hover, staying while interacting
  const [areCardsVisible, setAreCardsVisible] = useState(true);
  const [isHoveringCards, setIsHoveringCards] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isHoveringCardsRef = useRef(false);
  const isStopsPanelOpenRef = useRef(false);
  const isEventsPanelOpenRef = useRef(false);
  const isEventFilterPanelOpenRef = useRef(false);
  isHoveringCardsRef.current = isHoveringCards;
  isStopsPanelOpenRef.current = isStopsPanelOpen;
  isEventsPanelOpenRef.current = isEventsPanelOpen;
  isEventFilterPanelOpenRef.current = isEventFilterPanelOpen;

  const passengerAlarmUntilRef = useRef<number>(0);
  const scheduleHideTimerRef = useRef<(customDurationMs?: number) => void>(() => {});
  const resetHideTimerRef = useRef<() => void>(() => {});
  const scheduleHideTimer = (customDurationMs: number = 3500) => {
    setAreCardsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const remainingAlarmMs = Math.max(0, passengerAlarmUntilRef.current - Date.now());
    const effectiveDurationMs = Math.max(customDurationMs, remainingAlarmMs);

    hideTimerRef.current = setTimeout(() => {
      // Don't auto-hide if user is hovering cards or interacting with stops or events panel
      if (
        !isHoveringCardsRef.current &&
        !isStopsPanelOpenRef.current &&
        !isEventsPanelOpenRef.current &&
        !isEventFilterPanelOpenRef.current
      ) {
        setAreCardsVisible(false);
      }
    }, effectiveDurationMs);
  };
  const resetHideTimer = () => scheduleHideTimer(3500);
  scheduleHideTimerRef.current = scheduleHideTimer;
  resetHideTimerRef.current = resetHideTimer;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('uppa-map-cards-visibility', {
        detail: { visible: areCardsVisible },
      })
    );
  }, [areCardsVisible]);

  useEffect(() => {
    if (hideTopBarButtons) {
      setIsStopsPanelOpen(false);
      setIsEventFilterPanelOpen(false);
      setIsEventsPanelOpen(false);
    }
  }, [hideTopBarButtons]);

  useEffect(() => {
    const handleShowControls = () => {
      resetHideTimerRef.current();
    };
    const handleHoverControls = (e: Event) => {
      const custom = e as CustomEvent<{ hovering: boolean }>;
      const hovering = Boolean(custom.detail?.hovering);
      setIsHoveringCards(hovering);
      if (hovering) {
        setAreCardsVisible(true);
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
      } else {
        resetHideTimerRef.current();
      }
    };
    window.addEventListener('uppa-map-show-controls', handleShowControls);
    window.addEventListener('uppa-map-hover-controls', handleHoverControls);
    return () => {
      window.removeEventListener('uppa-map-show-controls', handleShowControls);
      window.removeEventListener('uppa-map-hover-controls', handleHoverControls);
    };
  }, []);

  const getEventCategoryKey = (type: any): string => {
    switch (type) {
      case 'bus_location':
      case 'ubicacion_colectivo':
        return 'bus_location';
      case 'accident':
      case 'accidente':
        return 'accident';
      case 'late':
      case 'demora':
        return 'late';
      case 'traffic':
      case 'congestion':
        return 'traffic';
      case 'corte':
      case 'desvio':
      case 'danger':
        return 'corte';
      case 'control':
      case 'control_policial':
        return 'control';
      case 'breakdown':
      case 'averia':
        return 'breakdown';
      case 'missed':
      case 'salteo':
        return 'missed';
      case 'inundacion':
        return 'inundacion';
      case 'moving':
      case 'normal':
        return 'moving';
      default:
        return 'other';
    }
  };

  const handleRegisterEventFromDropdown = async (
    evOpt: {
      id: string;
      type: EventType;
      icon: string;
      label: string;
      subtitle: string;
      defaultTitle: string;
      colorClass: string;
      isPrimary?: boolean;
    },
    overrideDirection?: 'hacia_zarate' | 'hacia_malvinas'
  ) => {
    if (gpsCalibrationStatus) return;

    let fallbackLat = userLocation?.lat;
    let fallbackLng = userLocation?.lng;

    if (!fallbackLat || !fallbackLng) {
      if (mapInstanceRef.current) {
        const center = mapInstanceRef.current.getCenter();
        fallbackLat = center.lat;
        fallbackLng = center.lng;
      } else {
        fallbackLat = -34.1683;
        fallbackLng = -58.9592;
      }
    }

    // Buscar si existe un reporte previo de colectivo para deducir velocidad real entre paradas/puntos
    const previousBusReport = events.find(
      (e) => e.type === 'bus_location' && e.createdAtMs && Date.now() - e.createdAtMs < 360000
    );

    setGpsCalibrationStatus({
      samples: 1,
      bestAccuracy: Math.round(userLocation?.accuracy || 20),
    });

    let preciseFix;
    try {
      // Solicitar 6 lecturas GPS de alta precisión, descartar las menos exactas y elegir la mejor lectura
      preciseFix = await captureMostPreciseGpsReading({
        fallbackLat,
        fallbackLng,
        fallbackAccuracy: userLocation?.accuracy || 20,
        fallbackSpeedMps: userLocation?.speed ?? null,
        fallbackHeadingDeg: userLocation?.heading ?? null,
        previousReport: previousBusReport
          ? {
              lat: previousBusReport.lat,
              lng: previousBusReport.lng,
              createdAtMs: previousBusReport.createdAtMs,
            }
          : null,
        maxDurationMs: 2400,
        targetSamples: 6,
        onProgress: ({ samplesCollected, bestAccuracyMeters }) => {
          setGpsCalibrationStatus({
            samples: samplesCollected,
            bestAccuracy: bestAccuracyMeters,
          });
        },
      });
    } finally {
      setGpsCalibrationStatus(null);
    }

    const lat = preciseFix.lat;
    const lng = preciseFix.lng;

    const directionToUse: 'hacia_zarate' | 'hacia_malvinas' =
      overrideDirection ||
      (evOpt.type === 'bus_location'
        ? busDirection
        : preciseFix.inferredDirection || 'hacia_malvinas');
    const dirLabel = directionToUse === 'hacia_zarate' ? 'Zárate' : 'Barrio Malvinas';

    const now = Date.now();
    const note = eventCustomNote.trim() || evOpt.subtitle;
    const title =
      evOpt.type === 'bus_location'
        ? `Ubicación de colectivo ahora · Hacia ${dirLabel}`
        : evOpt.label;

    const newEvent: Omit<MapEvent, 'id' | 'confirmations' | 'confirmedByUserIds' | 'reportedAt'> = {
      routeId: selectedRouteId || 'route-zarate-malvinas',
      type: evOpt.type,
      title,
      description: note,
      lat,
      lng,
      reportedBy: currentUserName || 'Vecino UPPA',
      reportedByUserId: currentUserId || 'usr-vecino',
      direction: directionToUse,
      sentido: directionToUse,
      velocidadKmH: preciseFix.speedKmH,
      rumboGrados: preciseFix.headingDeg,
      rumboCardinal: preciseFix.headingCardinal,
      precisionMetros: preciseFix.accuracyMeters,
      lecturasGps: preciseFix.samplesCollected,
      createdAtMs: now,
      expiresAtMs: computeEventExpiresAtMs(evOpt.type, now),
      isVerified: true,
      estado: 'activo',
    };

    if (onAddEvent) {
      onAddEvent(newEvent);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true });
    }

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        // Si es ubicación de colectivo: NO decir problema o inconveniente
        const speechText =
          evOpt.type === 'bus_location'
            ? `Ubicación de colectivo ahora registrada hacia ${dirLabel}. Velocidad: ${preciseFix.speedKmH} kilómetros por hora.`
            : `Reporte registrado: ${evOpt.label}`;
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = 'es-AR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}

    const precisionSuffix = ` · ±${preciseFix.accuracyMeters}m (${preciseFix.samplesCollected} lect.)`;
    const toastMessage =
      evOpt.type === 'bus_location'
        ? `¡📍 Ubicación hacia ${dirLabel} (${preciseFix.speedKmH} km/h${precisionSuffix}) registrada!`
        : `¡${evOpt.icon} ${evOpt.label} (${precisionSuffix.replace(' · ', '')}) registrado!`;

    setEventRegisteredToast(toastMessage);
    setTimeout(() => {
      setEventRegisteredToast(null);
    }, 4500);

    setEventCustomNote('');
    setIsEventsPanelOpen(false);
    resetHideTimer();
  };

  // Re-start 8s exposure timer on mount (e.g. when returning from another section/tab)
  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleCardMouseEnter = () => {
    setIsHoveringCards(true);
    setAreCardsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    setIsHoveringCards(false);
    resetHideTimer();
  };

  const totalRoute: TransitRoute = routes.find((r) => r.id === 'route-zarate-malvinas') || routes.find((r) => r.stops.length > 30) || {
    id: 'route-zarate-malvinas',
    name: 'Linea 228(Malvinas-Zarate)',
    shortName: 'Linea 228(Malvinas-Zarate)',
    code: '228',
    description: 'Recorrido oficial completo desde Barrio Malvinas pasando por Las Campanas, Ariel del Plata, Colectora Panamericana, Casco Céntrico y RP 6 hasta Zárate Centro.',
    color: '#06b6d4',
    status: 'normal',
    frequencyMinutes: 12,
    currentDelayMinutes: 0,
    lastUpdated: 'En vivo',
    coordinates: LINEA_228_COORDINATES,
    stops: LINEA_228_STOPS,
  };
  const activeRoute = totalRoute;
  const nearestBus = liveBuses[0];

  const createResilientTileLayer = (styleKey: 'streets' | 'tesla-dark' | 'osm') => {
    const config = TILE_PROVIDERS[styleKey];
    const layer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
      attribution: config.attribution,
    });

    layer.on('tileerror', (errorEvent: any) => {
      if (config.fallbackUrl && errorEvent.tile && !errorEvent.tile.dataset.fallbackTried) {
        errorEvent.tile.dataset.fallbackTried = 'true';
        const coords = errorEvent.coords;
        const sub = config.subdomains[Math.floor(Math.random() * config.subdomains.length)] || 'a';
        errorEvent.tile.src = config.fallbackUrl
          .replace('{s}', sub)
          .replace('{z}', coords.z.toString())
          .replace('{x}', coords.x.toString())
          .replace('{y}', coords.y.toString())
          .replace('{r}', '');
      }
    });

    return layer;
  };

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MAP_CONFIG.DEFAULT_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    // Initialise with 'streets' (Calles & Rutas LocationIQ)
    const baseTile = createResilientTileLayer('streets').addTo(map);
    tileLayerRef.current = baseTile;

    polylinesLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    eventsLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);
    taxisLayerRef.current = L.layerGroup().addTo(map);
    userMarkerRef.current = L.layerGroup().addTo(map);
    trajectoryLayerRef.current = L.layerGroup().addTo(map);
    stopTrajectoryLayerRef.current = L.layerGroup().addTo(map);
    passengerTrackingLayerRef.current = L.layerGroup().addTo(map);
    gasStationsLayerRef.current = L.layerGroup().addTo(map);
    schoolsLayerRef.current = L.layerGroup().addTo(map);
    hospitalsLayerRef.current = L.layerGroup().addTo(map);
    trainStationsLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    const handleMapUserAction = () => {
      resetHideTimerRef.current();
    };

    map.on('click', handleMapUserAction);
    map.on('mousedown', handleMapUserAction);
    map.on('touchstart', handleMapUserAction);
    map.on('dragstart', handleMapUserAction);
    map.on('zoomstart', handleMapUserAction);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    const initialResizeTimer = setTimeout(handleResize, 250);

    return () => {
      clearTimeout(initialResizeTimer);
      window.removeEventListener('resize', handleResize);
      map.off('click', handleMapUserAction);
      map.off('mousedown', handleMapUserAction);
      map.off('touchstart', handleMapUserAction);
      map.off('dragstart', handleMapUserAction);
      map.off('zoomstart', handleMapUserAction);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const map = mapInstanceRef.current;

    map.removeLayer(tileLayerRef.current);
    const newBase = createResilientTileLayer(activeTileStyle).addTo(map);

    newBase.bringToBack();
    tileLayerRef.current = newBase;
  }, [activeTileStyle]);

  // Weather Radar Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (showWeatherRadar) {
      if (!weatherLayerRef.current) {
        weatherLayerRef.current = L.tileLayer(TILE_PROVIDERS['weather-radar'].url, {
          maxZoom: 18,
          opacity: 0.65,
        });
      }
      weatherLayerRef.current.addTo(map);
    } else {
      if (weatherLayerRef.current && map.hasLayer(weatherLayerRef.current)) {
        map.removeLayer(weatherLayerRef.current);
      }
    }
  }, [showWeatherRadar]);

  // Gas Stations Markers Layer (Toggleable via right-side icon)
  useEffect(() => {
    if (!mapInstanceRef.current || !gasStationsLayerRef.current) return;
    const layer = gasStationsLayerRef.current;
    layer.clearLayers();

    if (!showGasStations) return;

    GAS_STATIONS_DATA.forEach((station) => {
      const icon = L.divIcon({
        className: 'custom-gas-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 border-2 border-white text-slate-950 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(245,158,11,0.6)] font-bold transition-transform group-hover:scale-125">
              ⛽
            </div>
            <div class="absolute -bottom-5 bg-black/90 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-md border border-amber-400/40 whitespace-nowrap shadow-md pointer-events-none">
              ${station.name.split('(')[0].trim()}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([station.lat, station.lng], { icon });
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; color: #0f172a; max-width: 240px;">
          <div style="font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 4px; color: #0f172a;">
            <span>⛽</span> <span>${station.name}</span>
          </div>
          <div style="font-size: 10px; color: #d97706; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
            ${station.categoryName}
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.3;">
            ${station.address} <span style="color: #64748b;">(${station.zone})</span>
          </div>
          <div style="font-size: 10.5px; color: #475569; margin-top: 4px; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            ${station.details}
          </div>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}" target="_blank" rel="noopener noreferrer" title="Abrir Google Maps" style="display: block; text-align: center; background: #FFF19A; color: #101114; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
              Llevarme a esta Estación ➔
            </a>
          </div>
        </div>
      `);
      marker.addTo(layer);
    });
  }, [showGasStations]);

  // Schools & Educational Institutions Markers Layer (Toggleable via right-side icon)
  useEffect(() => {
    if (!mapInstanceRef.current || !schoolsLayerRef.current) return;
    const layer = schoolsLayerRef.current;
    layer.clearLayers();

    if (!showSchools) return;

    SCHOOLS_DATA.forEach((school) => {
      const icon = L.divIcon({
        className: 'custom-school-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 border-2 border-white text-white flex items-center justify-center text-sm shadow-[0_0_15px_rgba(99,102,241,0.6)] font-bold transition-transform group-hover:scale-125">
              🏫
            </div>
            <div class="absolute -bottom-5 bg-black/90 text-indigo-200 text-[9px] font-bold px-1.5 py-0.2 rounded-md border border-indigo-400/40 whitespace-nowrap shadow-md pointer-events-none">
              ${school.name.split('(')[0].trim()}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([school.lat, school.lng], { icon });
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; color: #0f172a; max-width: 240px;">
          <div style="font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 4px; color: #0f172a;">
            <span>🏫</span> <span>${school.name}</span>
          </div>
          <div style="font-size: 10px; color: #4f46e5; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
            ${school.categoryName}
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.3;">
            ${school.address} <span style="color: #64748b;">(${school.zone})</span>
          </div>
          <div style="font-size: 10.5px; color: #475569; margin-top: 4px; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            ${school.details}
          </div>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lng}" target="_blank" rel="noopener noreferrer" title="Abrir Google Maps" style="display: block; text-align: center; background: #FFF19A; color: #101114; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
              Llevarme a esta Escuela ➔
            </a>
          </div>
        </div>
      `);
      marker.addTo(layer);
    });
  }, [showSchools]);

  // Hospitals & Health Centers Markers Layer (Toggleable via top-bar icon)
  useEffect(() => {
    if (!mapInstanceRef.current || !hospitalsLayerRef.current) return;
    const layer = hospitalsLayerRef.current;
    layer.clearLayers();

    if (!showHospitals) return;

    const seenCoordCounts = new Map<string, number>();

    HOSPITALS_DATA.forEach((hospital) => {
      const coordKey = `${hospital.lat.toFixed(5)}_${hospital.lng.toFixed(5)}`;
      const dupIndex = seenCoordCounts.get(coordKey) ?? 0;
      seenCoordCounts.set(coordKey, dupIndex + 1);

      const markerLat = hospital.lat + dupIndex * 0.00018;
      const markerLng = hospital.lng + dupIndex * 0.00018;

      const icon = L.divIcon({
        className: 'custom-hospital-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-8 h-8 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 border-2 border-white text-white flex items-center justify-center text-sm shadow-[0_0_15px_rgba(244,63,94,0.6)] font-bold transition-transform group-hover:scale-125">
              🏥
            </div>
            <div class="absolute -bottom-5 bg-black/90 text-rose-200 text-[9px] font-bold px-1.5 py-0.2 rounded-md border border-rose-400/40 whitespace-nowrap shadow-md pointer-events-none">
              ${escapeHtml(hospital.name.split('(')[0].trim())}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([markerLat, markerLng], { icon });
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; color: #0f172a; max-width: 240px;">
          <div style="font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 4px; color: #0f172a;">
            <span>🏥</span> <span>${escapeHtml(hospital.name)}</span>
          </div>
          <div style="font-size: 10px; color: #e11d48; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
            ${escapeHtml(hospital.categoryName)}
          </div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px; line-height: 1.3;">
            ${escapeHtml(hospital.address)} <span style="color: #64748b;">(${escapeHtml(hospital.zone)})</span>
          </div>
          <div style="font-size: 10.5px; color: #475569; margin-top: 4px; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
            ${escapeHtml(hospital.details)}
          </div>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}" target="_blank" rel="noopener noreferrer" title="Abrir Google Maps" style="display: block; text-align: center; background: #FFF19A; color: #101114; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
              Llevarme a este Hospital ➔
            </a>
          </div>
        </div>
      `);
      marker.addTo(layer);
    });
  }, [showHospitals]);

  // Train Stations Markers Layer (Campana & Zárate Línea Mitre)
  useEffect(() => {
    if (!mapInstanceRef.current || !trainStationsLayerRef.current) return;
    const layer = trainStationsLayerRef.current;
    layer.clearLayers();

    if (!showTrainStations) return;

    TRAIN_STATIONS_DATA.forEach((station) => {
      const icon = L.divIcon({
        className: 'custom-train-station-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 border-2 border-[#FFF19A] text-white flex items-center justify-center text-sm shadow-[0_0_16px_rgba(14,165,233,0.75)] font-bold transition-transform group-hover:scale-125">
              🚆
            </div>
            <div class="absolute -bottom-5 bg-black/95 text-sky-200 text-[9px] font-black px-1.5 py-0.2 rounded-md border border-sky-400/60 whitespace-nowrap shadow-md pointer-events-none">
              ${escapeHtml(station.name.replace('Estación de Trenes de ', 'Est. Tren ').replace('Estación de Trenes ', 'Est. Tren '))}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const stationKey: 'campana' | 'zarate' =
        station.id === 'poi-tren-zarate' ? 'zarate' : 'campana';
      const cityDisplay = stationKey === 'zarate' ? 'Zárate' : 'Campana';

      const marker = L.marker([station.lat, station.lng], { icon });
      marker.bindPopup(
        `
        <div style="font-family: inherit; padding: 2px; color: #ffffff; max-width: 265px;">
          <div style="font-size: 13px; font-weight: 900; display: flex; align-items: center; gap: 6px; color: #ffffff;">
            <span>🚆</span> <span>${escapeHtml(station.name)}</span>
          </div>
          <div style="font-size: 10px; color: #38bdf8; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
            ${escapeHtml(station.categoryName)}
          </div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.35;">
            ${escapeHtml(station.address)} <span style="color: #94a3b8;">(${escapeHtml(station.zone)})</span>
          </div>
          <div style="font-size: 10.5px; color: #e2e8f0; margin-top: 5px; background: #101114; padding: 5px 7px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
            ${escapeHtml(station.details)}
          </div>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
            <button type="button" data-open-train-section="${stationKey}" style="width: 100%; border: 1.5px solid #38bdf8; cursor: pointer; text-align: center; background: #101114; color: #FFF19A; font-size: 11.5px; font-weight: 900; padding: 9px 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(56,189,248,0.28); position: relative; z-index: 20;">
              🚆 Servicio Inteligente de ${cityDisplay} ➔
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}" target="_blank" rel="noopener noreferrer" title="Abrir Google Maps" style="display: block; text-align: center; background: #FFF19A; color: #101114; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
              Llevarme a esta Estación de Trenes ➔
            </a>
          </div>
        </div>
      `,
        {
          autoPan: false,
          closeOnClick: false,
          offset: [0, -8],
        }
      );

      let hoverCloseTimer: number | null = null;
      const clearHoverCloseTimer = () => {
        if (hoverCloseTimer !== null) {
          window.clearTimeout(hoverCloseTimer);
          hoverCloseTimer = null;
        }
      };
      const scheduleHoverClose = () => {
        clearHoverCloseTimer();
        hoverCloseTimer = window.setTimeout(() => {
          marker.closePopup();
        }, 650);
      };

      marker.on('mouseover', () => {
        clearHoverCloseTimer();
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      });
      marker.on('mouseout', scheduleHoverClose);
      marker.on('click', () => {
        clearHoverCloseTimer();
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      });
      marker.on('remove', clearHoverCloseTimer);

      marker.on('popupopen', (e) => {
        clearHoverCloseTimer();
        const popupEl = e.popup.getElement();
        if (!popupEl) return;

        L.DomEvent.disableClickPropagation(popupEl);
        L.DomEvent.disableScrollPropagation(popupEl);

        popupEl.onmouseenter = clearHoverCloseTimer;
        popupEl.onmousemove = clearHoverCloseTimer;
        popupEl.onmouseleave = scheduleHoverClose;

        const btn = popupEl.querySelector('[data-open-train-section]') as HTMLElement | null;
        if (!btn) return;

        const handleOpenTrain = (ev: Event) => {
          L.DomEvent.stop(ev);
          clearHoverCloseTimer();
          marker.closePopup();
          onOpenTrainSectionRef.current?.(stationKey);
        };

        btn.onmouseenter = clearHoverCloseTimer;
        btn.onmousedown = (ev) => ev.stopPropagation();
        btn.ontouchstart = (ev) => ev.stopPropagation();
        btn.onpointerdown = (ev) => ev.stopPropagation();
        btn.onclick = handleOpenTrain;
      });

      marker.addTo(layer);
    });
  }, [showTrainStations]);

  // Handle map click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (onMapClickLocation) {
        onMapClickLocation(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [onMapClickLocation]);

  // User Live Location Marker (Pulsating Beacon)
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current) return;
    const layer = userMarkerRef.current;
    layer.clearLayers();

    if (!userLocation) return;

    const isDriver = isDriverMode && isDriverOnline;
    const isDriverOcupado = isDriver && driverDisponibilidad === 'ocupado';

    if (userLocation.accuracy && userLocation.accuracy < 100) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy,
        color: isDriver ? (isDriverOcupado ? '#f59e0b' : '#22c55e') : '#38bdf8',
        fillColor: isDriver ? (isDriverOcupado ? '#FFF19A' : '#86efac') : '#7dd3fc',
        fillOpacity: 0.14,
        weight: 1,
      }).addTo(layer);
    }

    const beaconIcon = L.divIcon({
      className: 'custom-user-beacon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2.5 rounded-full ${
            isDriver
              ? isDriverOcupado
                ? 'bg-amber-400/35'
                : 'bg-emerald-400/30'
              : 'bg-sky-400/30'
          } animate-pulse-ring"></div>
          <div class="w-5 h-5 rounded-full ${
            isDriver
              ? isDriverOcupado
                ? 'bg-[#FFF19A] border-2 border-[#101114]'
                : 'bg-emerald-400 border-2 border-white'
              : 'bg-sky-400 border-2 border-white'
          } shadow-[0_0_15px_${
            isDriver ? (isDriverOcupado ? '#FFF19A' : '#86efac') : '#7dd3fc'
          }] flex items-center justify-center text-[10px] text-slate-950 font-bold">
            ${isDriver ? '🚕' : '●'}
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: beaconIcon }).addTo(layer);
    if (isDriverMode) {
      userMarker.bindTooltip(
        isDriverOcupado ? 'Tu móvil · OCUPADO' : 'Tu móvil · DISPONIBLE',
        { direction: 'top', offset: [0, -10], className: 'uppa-map-tooltip' }
      );
    }
  }, [userLocation, isDriverMode, isDriverOnline, driverDisponibilidad]);

  const handleClearStopTrajectory = () => {
    setStopTrajectoryInfo(null);
    if (stopTrajectoryLayerRef.current) {
      stopTrajectoryLayerRef.current.clearLayers();
    }
  };

  const handleCalculateStopTrajectory = async (stop: BusStop, route: TransitRoute) => {
    if (!mapInstanceRef.current || !stopTrajectoryLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = stopTrajectoryLayerRef.current;
    layer.clearLayers();

    // Clear driver tracking if any to avoid visual conflict
    if (activeTrackingTaxi && onClearTrackingTaxi) {
      onClearTrackingTaxi();
    }

    const userLat = userLocation?.lat || -34.1950;
    const userLng = userLocation?.lng || -58.9720;
    const distKm = getDistanceKm(userLat, userLng, stop.lat, stop.lng);
    const etaWalkMin = Math.max(1, Math.round((distKm / 4.5) * 60));
    const etaTransitMin = Math.max(1, Math.round((distKm / 32) * 60));

    // Anuncio de voz amigable para guía GPS con ubicación y número de parada actualizados
    speakStopAnnouncement(stop, 'gps');

    setStopTrajectoryInfo({
      stop,
      route,
      distKm: Math.round(distKm * 10) / 10,
      etaWalkMin,
      etaTransitMin,
      userLat,
      userLng,
    });

    let coords: [number, number][] = [];

    // Query LocationIQ directions API with verified cartography key
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/directions/driving/${userLng},${userLat};${stop.lng},${stop.lat}?key=${CARTOGRAPHY_API_KEY}&overview=full&geometries=geojson`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.routes && data.routes[0]) {
          const rawCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          if (rawCoords.length >= 2) {
            coords = rawCoords;
          }
        }
      }
    } catch {
      // offline/timeout fallback
    }

    if (coords.length === 0) {
      // Interpolate realistic intermediate point
      const midLat = (userLat + stop.lat) / 2;
      const midLng = (userLng + stop.lng) / 2;
      coords = [[userLat, userLng], [midLat, midLng], [stop.lat, stop.lng]];
    }

    // 1. PUNTO A (Usuario)
    const userPointIcon = L.divIcon({
      className: 'custom-stop-user-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-sky-400/40 animate-pulse"></div>
          <div class="relative w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-xs shadow-[0_0_20px_#38bdf8] z-10 text-white font-bold">
            👤
          </div>
          <div class="absolute -bottom-6 bg-[#07090e]/95 text-sky-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>PUNTO A · Tu Ubicación</span>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker([userLat, userLng], { icon: userPointIcon }).addTo(layer);

    // 2. PUNTO B (Parada Seleccionada Titilando)
    const stopPointIcon = L.divIcon({
      className: 'custom-stop-point-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-4 rounded-full bg-cyan-400/40 marker-titilando-cyan"></div>
          <div class="absolute -inset-2 rounded-full bg-cyan-300/60 animate-ping"></div>
          <div class="relative w-9 h-9 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center text-sm shadow-[0_0_25px_#06b6d4] z-10 text-white font-bold">
            🚏
          </div>
          <div class="absolute -bottom-6 bg-[#07090e]/95 text-cyan-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>PUNTO B · Parada</span>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    L.marker([stop.lat, stop.lng], { icon: stopPointIcon }).addTo(layer);

    // 3. Trajectory line with glow and animated dash flow
    L.polyline(coords, {
      color: '#06b6d4',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);

    L.polyline(coords, {
      color: '#22d3ee',
      weight: 4,
      opacity: 0.95,
      className: 'leaflet-route-flow',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);

    // 4. Fit bounds
    try {
      map.fitBounds([[userLat, userLng], [stop.lat, stop.lng]], {
        padding: [80, 80],
        maxZoom: 16,
      });
    } catch {}
  };

  // Cartografía del Trazado Troncal Malvinas ↔ Zárate (Polylines)
  useEffect(() => {
    if (!mapInstanceRef.current || !polylinesLayerRef.current) return;
    const layer = polylinesLayerRef.current;
    layer.clearLayers();

    // 1. Soft atmospheric glow del recorrido troncal
    L.polyline(totalRoute.coordinates, {
      color: '#06b6d4',
      weight: 12,
      opacity: 0.28,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);

    // 2. Línea principal de trazado
    L.polyline(totalRoute.coordinates, {
      color: '#22d3ee',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);
  }, [totalRoute]);

  // Paradas del recorrido total B° Malvinas ↔ Zárate Terminal (Toggleable con showStops)
  useEffect(() => {
    if (!mapInstanceRef.current || !stopsLayerRef.current) return;
    const layer = stopsLayerRef.current;
    layer.clearLayers();

    if (!showStops) return;

    totalRoute.stops.forEach((stop) => {
      const isMcDonalds = stop.name.toLowerCase().includes('mcdonald');
      const isVigalondo = stop.name.toLowerCase().includes('vigalondo');
      const isTerminal = stop.name.toLowerCase().includes('terminal');
      const isRocca = stop.name.toLowerCase().includes('roberto rocca');

      const size = isMcDonalds ? 26 : isVigalondo || isTerminal || isRocca ? 22 : 16;
      const anchor = size / 2;

      const haloClass = isMcDonalds
        ? 'bg-amber-400/35 marker-titilando-amber'
        : isVigalondo || isTerminal || isRocca
        ? 'bg-cyan-400/30 marker-titilando-cyan'
        : 'bg-cyan-400/20 marker-titilando-cyan';

      const dotHtml = isMcDonalds
        ? `<div class="relative w-5 h-5 rounded-full bg-amber-400 border border-white text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.7)] z-10 font-black text-amber-950 transition-transform group-hover:scale-125" title="McDonald's Campana">🍔</div>`
        : isTerminal
        ? `<div class="relative w-5 h-5 rounded-full bg-cyan-400 border border-white text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.7)] z-10 font-black text-slate-950 transition-transform group-hover:scale-125" title="Terminal Zárate">🏁</div>`
        : `<div class="relative ${
            isVigalondo ? 'w-3 h-3 bg-cyan-200 ring-2 ring-cyan-400/50' : 'w-2.5 h-2.5 bg-cyan-300'
          } rounded-full border border-white/90 shadow-[0_0_6px_rgba(6,182,212,0.5)] z-10 transition-transform group-hover:scale-130"></div>`;

      const stopTitilandoIcon = L.divIcon({
        className: 'custom-stop-titilando-marker',
        html: `
          <div class="relative w-full h-full flex items-center justify-center cursor-pointer group" style="width: ${size}px; height: ${size}px;" title="Parada #${stop.sequence}: ${stop.name} (${stop.zone})">
            <!-- Halo titilando centrado -->
            <div class="absolute -inset-1 rounded-full ${haloClass} pointer-events-none"></div>
            <!-- Punto central exacto -->
            ${dotHtml}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
      });

      const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopTitilandoIcon });

      // Tooltip visible al pasar el cursor o interactuar con la cartografía
      stopMarker.bindTooltip(
        `<div style="display:flex;align-items:center;gap:5px;">
          <span style="background:rgba(6,182,212,0.25);color:#22d3ee;font-weight:900;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:10px;">#${stop.sequence}</span>
          <span style="font-weight:700;color:#f8fafc;font-size:11px;">${stop.name}</span>
        </div>`,
        {
          direction: 'top',
          offset: [0, -anchor - 2],
          opacity: 0.98,
          className: 'uppa-stop-leaflet-tooltip',
        }
      );

      stopMarker.on('click', () => {
        // Abrir Google Maps directamente para iniciar el recorrido por medio del GPS + anunciar por voz
        resetHideTimer();
        setSelectedStop({ stop, route: totalRoute });
        speakStopAnnouncement(stop, 'gps');
        if (stopTrajectoryLayerRef.current) {
          stopTrajectoryLayerRef.current.clearLayers();
        }
        setStopTrajectoryInfo(null);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([stop.lat, stop.lng], { animate: true });
        }

        const currLoc = userLocationRef.current;
        const originParam = currLoc ? `origin=${currLoc.lat},${currLoc.lng}&` : '';
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&${originParam}destination=${stop.lat},${stop.lng}&travelmode=walking`;
        try {
          const anchor = document.createElement('a');
          anchor.href = googleMapsUrl;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } catch {}
      });
      stopMarker.addTo(layer);
    });
  }, [totalRoute, showStops]);

  // Events Markers (Waze Style with Pastel Tones & Category Filtering)
  useEffect(() => {
    if (!mapInstanceRef.current || !eventsLayerRef.current) return;
    const layer = eventsLayerRef.current;
    layer.clearLayers();

    if (!showEvents) return;

    const getEventBadge = (type: any) => {
      switch (type) {
        case 'bus_location':
        case 'ubicacion_colectivo':
          // CYAN / CELESTE VIBRANTE: Ubicación del Colectivo en tiempo real
          return { icon: '📍', bg: 'bg-cyan-500', ring: 'ring-cyan-300/80 animate-pulse', border: 'border-cyan-400' };
        case 'accident':
        case 'accidente':
          // ROJO: Accidente
          return { icon: '💥', bg: 'bg-red-600', ring: 'ring-red-400/50', border: 'border-red-500' };
        case 'late':
        case 'demora':
          // AMARILLO: Demora
          return { icon: '⏳', bg: 'bg-yellow-500', ring: 'ring-yellow-300/60', border: 'border-yellow-400' };
        case 'traffic':
        case 'congestion':
        case 'corte':
        case 'alerta':
        case 'desvio':
        case 'incidente':
        case 'danger':
          // NARANJA: Congestión / Corte / Alerta
          return { icon: '🚗', bg: 'bg-orange-500', ring: 'ring-orange-400/50', border: 'border-orange-400' };
        case 'control':
        case 'control_policial':
          return { icon: '👮', bg: 'bg-indigo-600', ring: 'ring-indigo-400/50', border: 'border-indigo-400' };
        case 'transporte_alternativo':
          // AZUL: Transporte alternativo
          return { icon: '🚕', bg: 'bg-blue-600', ring: 'ring-blue-400/50', border: 'border-blue-400' };
        case 'moving':
        case 'normal':
          // VERDE: Recorrido normal
          return { icon: '⚡', bg: 'bg-emerald-500', ring: 'ring-emerald-400/50', border: 'border-emerald-400' };
        case 'breakdown':
        case 'averia':
          return { icon: '🔧', bg: 'bg-rose-600', ring: 'ring-rose-400/50', border: 'border-rose-400' };
        case 'missed':
        case 'salteo':
          return { icon: '❌', bg: 'bg-amber-600', ring: 'ring-amber-400/50', border: 'border-amber-400' };
        case 'inundacion':
          return { icon: '🌧️', bg: 'bg-cyan-600', ring: 'ring-cyan-400/50', border: 'border-cyan-400' };
        default:
          return { icon: '⚠️', bg: 'bg-amber-500', ring: 'ring-amber-400/50', border: 'border-amber-400' };
      }
    };

    events.forEach((ev) => {
      // Filtrar y descartar de forma infalible cualquier evento simulado o de prueba
      if (!isRealCommunityReport(ev)) return;

      const catKey = getEventCategoryKey(ev.type);
      if (activeEventCategories[catKey] === false) return;

      // Caducidad automática según tipo: Colectivo 1 min, Control Policial 3.5 hs, Calle Anegada/Inundada 10 hs
      if (isMapEventExpired(ev, nowTimestamp)) {
        return;
      }

      const isSelected = selectedEvent?.id === ev.id;

      let eventIcon: L.DivIcon;

      if (ev.type === 'bus_location') {
        const created = ev.createdAtMs || (typeof ev.reportedAt === 'number' ? ev.reportedAt : nowTimestamp);
        const remainingSec = Math.max(0, 60 - Math.floor((nowTimestamp - created) / 1000));
        const isZarateDir = ev.direction === 'hacia_zarate' || ev.sentido === 'hacia_zarate';
        const dirLabel = isZarateDir ? '➡️ A Zárate' : '⬅️ A Malvinas';
        const speedText = ev.velocidadKmH ? `${ev.velocidadKmH} km/h` : '';

        const pinBg = isZarateDir ? 'bg-red-600' : 'bg-blue-600';
        const pinShadow = isZarateDir
          ? 'shadow-[0_0_20px_rgba(220,38,38,0.85)]'
          : 'shadow-[0_0_20px_rgba(37,99,235,0.85)]';
        const pinRing = isZarateDir ? 'ring-red-300' : 'ring-blue-300';
        const pingBg = isZarateDir ? 'bg-red-400' : 'bg-blue-400';
        const dotBg = isZarateDir ? 'bg-red-300' : 'bg-blue-300';
        const badgeBorder = isZarateDir ? 'border-red-400/80' : 'border-blue-400/80';
        const badgeText = isZarateDir ? 'text-red-200' : 'text-blue-200';

        eventIcon = L.divIcon({
          className: 'custom-bus-location-marker',
          html: `
            <div class="relative flex flex-col items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
              <div class="relative w-9 h-9 rounded-2xl ${pinBg} text-white ${pinShadow} flex items-center justify-center text-lg font-black ring-2 ${pinRing} hover:scale-115 transition-transform">
                📍
                <span class="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${pingBg} opacity-80"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 ${dotBg} ring-2 ring-black"></span>
                </span>
              </div>
              <div class="mt-1 px-2 py-0.5 rounded-lg bg-black/90 border ${badgeBorder} text-[9.5px] font-mono font-black ${badgeText} whitespace-nowrap shadow-xl flex items-center gap-1.5 pointer-events-none">
                <span>${dirLabel}</span>
                <span class="text-white/40">·</span>
                <span class="text-amber-300 font-bold">${remainingSec}s</span>
                ${speedText ? `<span class="text-emerald-300 font-bold">· ${speedText}</span>` : ''}
              </div>
            </div>
          `,
          iconSize: [110, 48],
          iconAnchor: [55, 24],
        });
      } else {
        const badge = getEventBadge(ev.type);
        eventIcon = L.divIcon({
          className: 'custom-event-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div class="${badge.bg} text-white w-8 h-8 rounded-2xl flex items-center justify-center text-sm font-bold shadow-lg ring-2 ${
            isSelected ? 'ring-sky-300 scale-125' : badge.ring
          } transition-transform">
                ${badge.icon}
              </div>
              <div class="absolute -top-1 -right-1 bg-black/85 text-[9px] font-mono text-sky-200 font-bold px-1 rounded-full border border-white/10">
                +${ev.confirmations}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      }

      const marker = L.marker([ev.lat, ev.lng], { icon: eventIcon });

      const badge = getEventBadge(ev.type);
      const hasResolvedStreet = Boolean(ev.streetAddress && !isCoordinateAddress(ev.streetAddress));
      const streetText = hasResolvedStreet
        ? escapeHtml(ev.streetAddress)
        : 'Obteniendo dirección exacta...';
      const coordsLabel = `${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)}`;
      const safeTitle = escapeHtml(ev.title || 'Evento en ruta');
      const safeReporter = escapeHtml(ev.reportedBy || 'Vecino UPPA');
      const safeDesc =
        ev.description && ev.description.trim() !== ev.title.trim()
          ? escapeHtml(ev.description.trim())
          : '';
      const isZarateDirMeta = ev.direction === 'hacia_zarate' || ev.sentido === 'hacia_zarate';
      const telemetryParts: string[] = [];
      if (ev.velocidadKmH) telemetryParts.push(`${ev.velocidadKmH} km/h`);
      if (ev.rumboCardinal && ev.rumboCardinal !== '—') telemetryParts.push(`Rumbo ${escapeHtml(ev.rumboCardinal)}`);
      if (ev.precisionMetros) telemetryParts.push(`±${ev.precisionMetros}m`);

      const busMetaHtml =
        ev.type === 'bus_location'
          ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px;font-size:10.5px;font-weight:800;color:${
              isZarateDirMeta ? '#fca5a5' : '#93c5fd'
            };">
              <span>${isZarateDirMeta ? '🔴 ➡️ Hacia Zárate' : '🔵 ⬅️ Hacia Malvinas'}</span>
              ${telemetryParts.length > 0 ? `<span style="color:#B7F36B;">· ${telemetryParts.join(' · ')}</span>` : ''}
            </div>`
          : telemetryParts.length > 0
          ? `<div style="font-size:10px;font-family:monospace;color:#7dd3fc;margin-top:4px;font-weight:700;">📡 ${telemetryParts.join(' · ')}</div>`
          : '';

      marker.bindTooltip(
        `<div style="min-width:185px;max-width:250px;line-height:1.3;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
            <span style="font-size:11.5px;font-weight:900;color:#FFFFFF;">${badge.icon} ${safeTitle}</span>
            <span style="background:rgba(183,243,107,0.2);color:#B7F36B;font-family:monospace;font-size:9.5px;font-weight:900;padding:1px 5px;border-radius:6px;border:1px solid rgba(183,243,107,0.45);flex-shrink:0;">+${ev.confirmations}</span>
          </div>
          <div style="background:rgba(255,241,154,0.12);border:1px solid rgba(255,241,154,0.35);border-radius:8px;padding:5px 7px;margin-bottom:4px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#9299A5;font-weight:800;">Dirección exacta (GPS${ev.precisionMetros ? ` ±${ev.precisionMetros}m` : ''})</div>
            <div style="font-size:11px;font-weight:800;color:#FFF19A;">📍 ${streetText}</div>
            <div style="font-size:9px;font-family:monospace;color:#9299A5;margin-top:2px;">${coordsLabel}</div>
          </div>
          ${busMetaHtml}
          ${safeDesc ? `<div style="font-size:10.5px;color:#E2E8F0;margin-top:3px;">${safeDesc}</div>` : ''}
          <div style="margin-top:4px;font-size:9.5px;color:#9299A5;display:flex;justify-content:space-between;gap:6px;">
            <span>Por <strong style="color:#FFFFFF;">${safeReporter}</strong></span>
            <span style="color:#FFF19A;font-weight:700;">Clic p/ detalle</span>
          </div>
        </div>`,
        {
          direction: 'top',
          offset: [0, ev.type === 'bus_location' ? -22 : -16],
          opacity: 0.98,
          className: 'uppa-map-tooltip',
        }
      );

      marker.on('click', () => {
        onSelectEvent(ev);
      });
      marker.addTo(layer);
    });
  }, [events, selectedEvent, onSelectEvent, showEvents, activeEventCategories, nowTimestamp]);

  // Live Buses Markers (Tesla Minimalist Style)
  useEffect(() => {
    if (!mapInstanceRef.current || !busesLayerRef.current) return;
    const layer = busesLayerRef.current;
    layer.clearLayers();

    liveBuses.forEach((bus) => {
      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            <div class="w-8 h-8 rounded-2xl glass-panel border-sky-400/40 flex items-center justify-center text-sky-300 text-xs shadow-lg">
              🚌
            </div>
            <div class="absolute -bottom-4 bg-black/80 text-sky-200 text-[9px] font-mono px-1.5 py-0.2 rounded-full border border-sky-500/30 whitespace-nowrap">
              ${bus.speedKmH}km/h · ${bus.etaMinutes}m
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([bus.lat, bus.lng], { icon: busIcon }).addTo(layer);
    });
  }, [liveBuses]);

  // Taxi Markers (Clean Vehicle Icons) - VISIBLE ÚNICAMENTE PARA PASAJEROS
  useEffect(() => {
    if (!mapInstanceRef.current || !taxisLayerRef.current) return;
    const layer = taxisLayerRef.current;
    layer.clearLayers();

    // Regla de Visibilidad: Los choferes/prestadores de servicio NO ven taxis en el mapa, solo los pasajeros
    if (isDriverMode || !showTaxis) return;

    const uLat = userLocation?.lat ?? -34.1683;
    const uLng = userLocation?.lng ?? -58.9592;

    taxis.forEach((taxi) => {
      // Don't render generic taxi marker if this driver is already featured in the tracking trajectory layer
      if (activeTrackingTaxi?.id === taxi.id) return;

      const isMoto = taxi.vehicleType === 'moto';
      const isOcupado = taxi.disponibilidad === 'ocupado';
      const distKm = getDistanceKm(uLat, uLng, taxi.lat, taxi.lng);
      const distStr = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;

      const taxiIcon = L.divIcon({
        className: 'custom-taxi-marker',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            <div class="relative w-8 h-8 rounded-full ${
              isOcupado
                ? 'bg-amber-600/30 border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : 'bg-emerald-600/30 border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
            } flex items-center justify-center text-xs hover:scale-115 transition-transform">
              ${isMoto ? '🏍️' : '🚕'}
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                isOcupado ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
              } ring-1 ring-black"></span>
            </div>
            <div class="mt-0.5 px-1 py-0.2 rounded-md bg-black/85 border border-white/20 text-[9px] font-mono font-black text-white whitespace-nowrap shadow-md pointer-events-none">
              ${distStr}
            </div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 21],
      });

      const marker = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon });

      const safeDriver = escapeHtml(taxi.driverName || 'Prestador UPPA');
      const safeModel = escapeHtml(taxi.vehicleModel || (isMoto ? 'Moto Taxi' : 'Auto Taxi'));
      const safePatente = escapeHtml(taxi.patente || taxi.plate || '');
      const safeZone = escapeHtml(taxi.zone || 'Zárate ↔ Campana');
      const ratingLabel = taxi.rating > 0 ? `⭐ ${taxi.rating.toFixed(1)}` : '⭐ Nuevo';

      marker.bindTooltip(
        `<div style="min-width:175px;max-width:240px;line-height:1.3;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:900;color:#FFFFFF;">${isMoto ? '🏍️' : '🚕'} ${safeDriver}</span>
            <span style="background:${isOcupado ? '#FFF19A' : '#B7F36B'};color:#101114;font-size:9px;font-weight:900;padding:1px 6px;border-radius:6px;flex-shrink:0;">
              ${isOcupado ? 'OCUPADO' : 'DISPONIBLE'}
            </span>
          </div>
          <div style="font-size:10.5px;color:#E2E8F0;font-weight:700;margin-bottom:4px;">
            ${safeModel}${safePatente ? ` · <span style="font-family:monospace;color:#FFF19A;">${safePatente}</span>` : ''}
          </div>
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:4px 6px;margin-bottom:4px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#9299A5;font-weight:800;">Ubicación GPS actual</div>
            <div style="font-size:10.5px;font-weight:700;color:#B7F36B;">📍 ${safeZone}</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10px;color:#9299A5;">
            <span style="color:#FFF19A;font-weight:800;">${ratingLabel} · ${taxi.completedRides} viajes</span>
            <span style="font-family:monospace;color:#FFFFFF;font-weight:800;">a ${distStr}</span>
          </div>
        </div>`,
        {
          direction: 'top',
          offset: [0, -22],
          opacity: 0.98,
          className: 'uppa-map-tooltip',
        }
      );

      marker.on('click', () => {
        onSelectTaxi(taxi);
      });
      marker.addTo(layer);
    });
  }, [taxis, onSelectTaxi, activeTrackingTaxi, showTaxis, userLocation, isDriverMode]);

  // =========================================================================
  // DRIVER TRACKING TRAJECTORY & ETA (Punto A -> Punto B Titilando)
  // =========================================================================
  const lastFittedTaxiTrackIdRef = useRef<string | null>(null);
  const lastTaxiSoundIdRef = useRef<string | null>(null);
  const taxiRouteCacheRef = useRef<{
    id: string;
    dLat: number;
    dLng: number;
    uLat: number;
    uLng: number;
    coords: [number, number][];
    distKm: number;
    etaMin: number;
    fetchedAt: number;
  } | null>(null);

  useEffect(() => {
    if (!mapInstanceRef.current || !trajectoryLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = trajectoryLayerRef.current;
    layer.clearLayers();

    if (!activeTrackingTaxi) {
      lastFittedTaxiTrackIdRef.current = null;
      lastTaxiSoundIdRef.current = null;
      setTrajectoryInfo(null);
      return;
    }

    const driverLat = activeTrackingTaxi.lat;
    const driverLng = activeTrackingTaxi.lng;

    // Punto B: User location (or fallback to Malvinas destination)
    const userLat = userLocation?.lat || -34.1950;
    const userLng = userLocation?.lng || -58.9720;

    let isMounted = true;

    // Helper to compute driving trajectory
    const fetchTrajectory = async () => {
      let finalCoords: [number, number][] = [];
      let calculatedDistKm = getDistanceKm(driverLat, driverLng, userLat, userLng);
      let calculatedEtaMin = Math.max(2, Math.round((calculatedDistKm / 35) * 60));

      const cache = taxiRouteCacheRef.current;
      const canReuseDirections =
        cache &&
        cache.id === activeTrackingTaxi.id &&
        Date.now() - cache.fetchedAt < 15000 &&
        getDistanceKm(cache.dLat, cache.dLng, driverLat, driverLng) < 0.05 &&
        getDistanceKm(cache.uLat, cache.uLng, userLat, userLng) < 0.05;

      if (canReuseDirections && cache) {
        finalCoords = [[driverLat, driverLng], ...cache.coords.slice(1, -1), [userLat, userLng]];
      } else {
        // Attempt LocationIQ Directions API with the verified API key
        try {
          const response = await fetch(
            `https://us1.locationiq.com/v1/directions/driving/${driverLng},${driverLat};${userLng},${userLat}?key=${CARTOGRAPHY_API_KEY}&overview=full&geometries=geojson`,
            { signal: AbortSignal.timeout(3000) }
          );

          if (response.ok) {
            const data = await response.json();
            if (data && data.routes && data.routes[0]) {
              const rawCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng]
              );
              if (rawCoords.length >= 2) {
                finalCoords = rawCoords;
                calculatedDistKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
                calculatedEtaMin = Math.max(1, Math.round(data.routes[0].duration / 60));
                taxiRouteCacheRef.current = {
                  id: activeTrackingTaxi.id,
                  dLat: driverLat,
                  dLng: driverLng,
                  uLat: userLat,
                  uLng: userLng,
                  coords: rawCoords,
                  distKm: calculatedDistKm,
                  etaMin: calculatedEtaMin,
                  fetchedAt: Date.now(),
                };
              }
            }
          }
        } catch {
          // network or timeout: fallback to corridor interpolation
        }
      }

      // Fallback street path interpolation if API was unavailable
      if (finalCoords.length === 0) {
        const CORRIDOR_WAYPOINTS: [number, number][] = [
          [-34.1023, -59.0354], // Terminal Zárate
          [-34.1085, -59.0220], // Hospital Zárate
          [-34.1205, -59.0080], // Rotonda RN9
          [-34.1350, -58.9890], // Colectora
          [-34.1520, -58.9730], // Tenaris
          [-34.1610, -58.9640], // Rotonda Campana Norte
          [-34.1683, -58.9592], // Plaza Eduardo Costa
          [-34.1750, -58.9610], // Av. Rivadavia
          [-34.1840, -58.9670], // Ingreso Ruta 6
          [-34.1950, -58.9720], // B° Malvinas Centro
        ];

        const minLat = Math.min(driverLat, userLat);
        const maxLat = Math.max(driverLat, userLat);
        const intermediate = CORRIDOR_WAYPOINTS.filter(([lat]) => lat > minLat && lat < maxLat);

        if (driverLat > userLat) {
          intermediate.sort((a, b) => b[0] - a[0]);
        } else {
          intermediate.sort((a, b) => a[0] - b[0]);
        }

        finalCoords = [[driverLat, driverLng], ...intermediate, [userLat, userLng]];
      }

      if (!isMounted) return;

      setTrajectoryInfo({
        coordinates: finalCoords,
        distKm: calculatedDistKm,
        etaMinutes: calculatedEtaMin,
      });
      if (
        (calculatedDistKm <= 0.5 || calculatedEtaMin <= 2) &&
        lastTaxiSoundIdRef.current !== activeTrackingTaxi.id
      ) {
        lastTaxiSoundIdRef.current = activeTrackingTaxi.id;
        playMicroSound('driver_near');
      }

      // 1. PUNTO A (Driver): TITILANDO con halo pulsante
      const driverTitilandoIcon = L.divIcon({
        className: 'custom-driver-titilando-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <!-- Ripple Wave Rings -->
            <div class="absolute -inset-4 rounded-full bg-emerald-400/40 marker-titilando"></div>
            <div class="absolute -inset-2 rounded-full bg-emerald-500/60 animate-ping"></div>
            <!-- Core Vehicle Circle -->
            <div class="relative w-9 h-9 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-sm shadow-[0_0_25px_#10b981] z-10 font-bold">
              ${activeTrackingTaxi.vehicleType === 'moto' ? '🏍️' : '🚕'}
            </div>
            <!-- Punto A Tag -->
            <div class="absolute -bottom-6 bg-[#07090e]/95 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>PUNTO A · ${activeTrackingTaxi.driverName}</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([driverLat, driverLng], { icon: driverTitilandoIcon }).addTo(layer);

      // 2. PUNTO B (Usuario / Destino)
      const userDestinationIcon = L.divIcon({
        className: 'custom-user-destination-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-3 rounded-full bg-sky-400/40 animate-pulse"></div>
            <div class="relative w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-xs shadow-[0_0_20px_#38bdf8] z-10 text-white font-bold">
              👤
            </div>
            <div class="absolute -bottom-6 bg-[#07090e]/95 text-sky-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              <span>PUNTO B · Tu Ubicación</span>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([userLat, userLng], { icon: userDestinationIcon }).addTo(layer);

      // 3. Trajectory Polyline: Glow line + Animated dashed flow
      L.polyline(finalCoords, {
        color: '#10b981',
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      L.polyline(finalCoords, {
        color: '#34d399',
        weight: 4,
        opacity: 0.95,
        className: 'leaflet-route-flow',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      // 4. Auto-fit bounds only when starting tracking for this taxi ID
      if (lastFittedTaxiTrackIdRef.current !== activeTrackingTaxi.id) {
        lastFittedTaxiTrackIdRef.current = activeTrackingTaxi.id;
        try {
          const bounds = L.latLngBounds([[driverLat, driverLng], [userLat, userLng]]);
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
        } catch {}
      }
    };

    fetchTrajectory();

    return () => {
      isMounted = false;
      layer.clearLayers();
    };
  }, [activeTrackingTaxi, userLocation]);

  // =========================================================================
  // PASSENGER APPROACH ALARM (Solo alarma por 10s sin voz al habilitar GPS)
  // =========================================================================
  const trackedPassengerId = activeTrackingPassenger?.id || null;
  useEffect(() => {
    if (!trackedPassengerId) {
      passengerAlarmUntilRef.current = 0;
      stopPassengerApproachAlarm();
      return;
    }

    setIsPassengerHudMinimized(false);
    window.dispatchEvent(new CustomEvent('uppa-minimize-bottom-sheet'));
    passengerAlarmUntilRef.current = Date.now() + 10000;
    scheduleHideTimerRef.current(10000);
    const stopAlarm = startPassengerApproachAlarm(10000);

    return () => {
      passengerAlarmUntilRef.current = 0;
      stopAlarm();
    };
  }, [trackedPassengerId]);

  // =========================================================================
  // PASSENGER TRACKING TRAJECTORY & GPS (Chofer hacia Pasajero)
  // =========================================================================
  const lastFittedPassengerTrackIdRef = useRef<string | null>(null);
  const passengerRouteCacheRef = useRef<{
    id: string;
    dLat: number;
    dLng: number;
    pLat: number;
    pLng: number;
    coords: [number, number][];
    fetchedAt: number;
  } | null>(null);

  useEffect(() => {
    if (!mapInstanceRef.current || !passengerTrackingLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = passengerTrackingLayerRef.current;
    layer.clearLayers();

    if (!activeTrackingPassenger) {
      lastFittedPassengerTrackIdRef.current = null;
      setPassengerTrajectoryInfo(null);
      return;
    }

    resetHideTimerRef.current();

    // Driver location (or fallback to Campana Centro)
    const driverLat = userLocation?.lat || -34.1683;
    const driverLng = userLocation?.lng || -58.9592;

    // Passenger location (or fallback to Malvinas)
    const passengerLat = activeTrackingPassenger.origenCoords?.lat || -34.2096;
    const passengerLng = activeTrackingPassenger.origenCoords?.lng || -58.9426;

    let isMounted = true;

    // Silenciar cualquier voz previa: solo debe sonar la alarma de acercamiento al pasajero
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}

    const fetchPassengerTrajectory = async () => {
      let finalCoords: [number, number][] = [];
      let calculatedDistKm = getDistanceKm(driverLat, driverLng, passengerLat, passengerLng);
      let calculatedEtaMin = Math.max(1, Math.round((calculatedDistKm / 35) * 60));

      const cache = passengerRouteCacheRef.current;
      const canReuseDirections =
        cache &&
        cache.id === activeTrackingPassenger.id &&
        Date.now() - cache.fetchedAt < 15000 &&
        getDistanceKm(cache.dLat, cache.dLng, driverLat, driverLng) < 0.05 &&
        getDistanceKm(cache.pLat, cache.pLng, passengerLat, passengerLng) < 0.05;

      if (canReuseDirections && cache) {
        finalCoords = [[driverLat, driverLng], ...cache.coords.slice(1, -1), [passengerLat, passengerLng]];
      } else {
        try {
          const response = await fetch(
            `https://us1.locationiq.com/v1/directions/driving/${driverLng},${driverLat};${passengerLng},${passengerLat}?key=${CARTOGRAPHY_API_KEY}&overview=full&geometries=geojson`,
            { signal: AbortSignal.timeout(3000) }
          );

          if (response.ok) {
            const data = await response.json();
            if (data && data.routes && data.routes[0]) {
              const rawCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
                ([lng, lat]: [number, number]) => [lat, lng]
              );
              if (rawCoords.length >= 2) {
                finalCoords = rawCoords;
                calculatedDistKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
                calculatedEtaMin = Math.max(1, Math.round(data.routes[0].duration / 60));
                passengerRouteCacheRef.current = {
                  id: activeTrackingPassenger.id,
                  dLat: driverLat,
                  dLng: driverLng,
                  pLat: passengerLat,
                  pLng: passengerLng,
                  coords: rawCoords,
                  fetchedAt: Date.now(),
                };
              }
            }
          }
        } catch {}
      }

      if (finalCoords.length === 0) {
        const midLat = (driverLat + passengerLat) / 2;
        const midLng = (driverLng + passengerLng) / 2;
        finalCoords = [[driverLat, driverLng], [midLat, midLng], [passengerLat, passengerLng]];
      }

      if (!isMounted) return;

      setPassengerTrajectoryInfo({
        solicitud: activeTrackingPassenger,
        distKm: calculatedDistKm,
        etaDriveMin: calculatedEtaMin,
        driverLat,
        driverLng,
        passengerLat,
        passengerLng,
      });

      // 1. PUNTO A (Chofer GPS en camino)
      const driverMarkerIcon = L.divIcon({
        className: 'custom-driver-origin-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-3 rounded-full bg-emerald-400/40 animate-pulse"></div>
            <div class="relative w-9 h-9 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-sm shadow-[0_0_20px_#10b981] z-10 font-bold">
              ${activeTrackingPassenger.tipoVehiculoRequerido === 'moto' ? '🏍️' : '🚕'}
            </div>
            <div class="absolute -bottom-6 bg-[#07090e]/95 text-emerald-300 font-mono text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>TU VEHÍCULO</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([driverLat, driverLng], { icon: driverMarkerIcon }).addTo(layer);

      // 2. PUNTO B (Pasajero con Beacon Titilando)
      const passengerBeaconIcon = L.divIcon({
        className: 'custom-passenger-beacon-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-4 rounded-full bg-cyan-400/40 animate-ping"></div>
            <div class="absolute -inset-2 rounded-full bg-cyan-500/60 marker-titilando"></div>
            <div class="relative w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 border-2 border-white flex items-center justify-center text-sm shadow-[0_0_25px_#06b6d4] z-10 font-bold text-white">
              🧑
            </div>
            <div class="absolute -bottom-6 bg-[#07090e]/95 text-cyan-200 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-cyan-400/80 shadow-2xl whitespace-nowrap z-20 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span>PASAJERO: ${activeTrackingPassenger.nombrePasajero}</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const pMarker = L.marker([passengerLat, passengerLng], { icon: passengerBeaconIcon }).addTo(layer);
      pMarker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; color: #0f172a; max-width: 250px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 4px;">
            <span>🧑</span> <span>${activeTrackingPassenger.nombrePasajero}</span>
          </div>
          <div style="font-size: 11px; color: #0369a1; font-weight: 700; margin-top: 2px;">
            📍 Origen: ${activeTrackingPassenger.origen}
          </div>
          <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">
            🏁 Destino: ${activeTrackingPassenger.destino}
          </div>
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${passengerLat},${passengerLng}&travelmode=driving" target="_blank" rel="noopener noreferrer" title="Abrir Google Maps" style="display: block; text-align: center; background: #B7F36B; color: #101114; font-size: 11px; font-weight: 800; padding: 6px 10px; border-radius: 8px; text-decoration: none;">
              Iniciar Guía GPS en Google Maps ➔
            </a>
          </div>
        </div>
      `);

      // 3. Trajectory Polyline
      L.polyline(finalCoords, {
        color: '#06b6d4',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      L.polyline(finalCoords, {
        color: '#22d3ee',
        weight: 5,
        opacity: 0.95,
        className: 'leaflet-route-flow',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      // 4. Auto-fit bounds only on initial tracking session start
      if (lastFittedPassengerTrackIdRef.current !== activeTrackingPassenger.id) {
        lastFittedPassengerTrackIdRef.current = activeTrackingPassenger.id;
        try {
          const bounds = L.latLngBounds([[driverLat, driverLng], [passengerLat, passengerLng]]);
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
        } catch {}
      }
    };

    fetchPassengerTrajectory();

    return () => {
      isMounted = false;
      layer.clearLayers();
    };
  }, [activeTrackingPassenger, userLocation]);

  const handleFitEntireRoute = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (stopTrajectoryInfo) {
      map.fitBounds(
        [
          [stopTrajectoryInfo.userLat, stopTrajectoryInfo.userLng],
          [stopTrajectoryInfo.stop.lat, stopTrajectoryInfo.stop.lng],
        ],
        { padding: [70, 70], maxZoom: 16 }
      );
      return;
    }

    if (activeTrackingTaxi) {
      const userLat = userLocation?.lat || -34.1950;
      const userLng = userLocation?.lng || -58.9720;
      map.fitBounds(L.latLngBounds([[activeTrackingTaxi.lat, activeTrackingTaxi.lng], [userLat, userLng]]), {
        padding: [70, 70],
        maxZoom: 15,
      });
      return;
    }

    if (activeRoute && activeRoute.coordinates.length > 0) {
      const bounds = L.latLngBounds(activeRoute.coordinates);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  const handleLocateMe = () => {
    if (!mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.2 });
  };

  const registerBusEventRef = useRef<(direction: 'hacia_zarate' | 'hacia_malvinas') => void>(() => {});
  registerBusEventRef.current = (direction: 'hacia_zarate' | 'hacia_malvinas') => {
    handleRegisterEventFromDropdown(TRANSIT_EVENT_TYPES[0], direction);
  };

  // External trigger listeners for bottom bar buttons ("Mi ubicacion", "Enfocar" y Joystick de colectivos)
  useEffect(() => {
    const handleLocateEvent = () => {
      handleLocateMe();
    };
    const handleFitRouteEvent = () => {
      handleFitEntireRoute();
    };
    const handleReportBusDirection = (e: Event) => {
      const custom = e as CustomEvent<{ direction?: 'hacia_zarate' | 'hacia_malvinas' }>;
      const dir = custom.detail?.direction;
      if (dir === 'hacia_zarate' || dir === 'hacia_malvinas') {
        registerBusEventRef.current(dir);
      }
    };
    window.addEventListener('uppa-map-locate-me', handleLocateEvent);
    window.addEventListener('uppa-map-fit-route', handleFitRouteEvent);
    window.addEventListener('uppa-report-bus-direction', handleReportBusDirection);
    return () => {
      window.removeEventListener('uppa-map-locate-me', handleLocateEvent);
      window.removeEventListener('uppa-map-fit-route', handleFitRouteEvent);
      window.removeEventListener('uppa-report-bus-direction', handleReportBusDirection);
    };
  }, [userLocation, stopTrajectoryInfo, activeTrackingTaxi, activeRoute]);

  return (
    <div
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onTouchMove={resetHideTimer}
      onPointerDown={resetHideTimer}
      onClick={resetHideTimer}
      className="relative w-full h-full overflow-hidden bg-[#101114]"
    >
      {/* Map Container Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Toast de confirmación de evento registrado en el mapa */}
      {eventRegisteredToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[65] pointer-events-none animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-2.5 rounded-xl bg-[#202329] border-2 border-[#FFF19A] shadow-[3px_3px_0px_#101114] flex items-center gap-2.5 text-xs font-extrabold text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] animate-ping" />
            <span>{eventRegisteredToast}</span>
          </div>
        </div>
      )}

      {/* El indicador compacto sin texto de Modo Mapa Libre ahora se ubica junto al botón Opciones de transporte */}

      {/* Indicador de Disponibilidad sincronizado en el Mapa para Prestadores (Ocupado / Disponible) */}
      {isDriverMode && (
        <div className="absolute top-3 left-12 z-[41] pointer-events-auto">
          <button
            type="button"
            disabled={hasUnvalidatedRide || !onToggleDriverDisponibilidad}
            onClick={() => {
              resetHideTimer();
              onToggleDriverDisponibilidad?.();
            }}
            title={
              hasUnvalidatedRide
                ? 'Estado: OCUPADO (validá el código del pasajero en Taxis & Motos antes de pasar a disponible)'
                : driverDisponibilidad === 'ocupado'
                ? 'Estado en Mapa y Taxis & Motos: OCUPADO. Tocá para pasar a DISPONIBLE'
                : 'Estado en Mapa y Taxis & Motos: DISPONIBLE. Tocá para pasar a OCUPADO'
            }
            className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-full border-2 shadow-[0_2px_10px_rgba(0,0,0,0.55)] text-[10px] sm:text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-all ${
              hasUnvalidatedRide
                ? 'bg-[#FFF19A]/85 text-[#101114] border-[#101114] cursor-not-allowed'
                : driverDisponibilidad === 'ocupado'
                ? 'bg-[#FFF19A] text-[#101114] border-[#101114] cursor-pointer active:scale-95'
                : 'bg-[#101114]/95 text-[#B7F36B] border-[#B7F36B] hover:bg-[#B7F36B]/15 cursor-pointer active:scale-95'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                driverDisponibilidad === 'ocupado'
                  ? 'bg-[#101114] animate-ping'
                  : 'bg-[#B7F36B]'
              }`}
            />
            <span>
              {driverDisponibilidad === 'ocupado' ? 'OCUPADO' : 'DISPONIBLE'}
            </span>
          </button>
        </div>
      )}

      {/* Parte Superior del Mapa: Barra Horizontal de Botones Flotantes (Paradas, Estaciones, Escuelas, Hospitales, Prestadores, Filtros, Eventos) */}
      <div
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={handleCardMouseLeave}
        className={`absolute top-3 left-11 right-2.5 sm:left-auto sm:right-4 z-[42] ${
          passengerTrajectoryInfo && !isPassengerHudMinimized ? 'hidden sm:flex' : 'flex'
        } flex-row items-center justify-end gap-1 sm:gap-2 transition-all duration-300 ease-in-out ${
          areCardsVisible && !hideTopBarButtons
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        {/* Botón 1: Paradas (solo icono 🚏 con alternancia de visibilidad) */}
        <div>
          <button
            onClick={() => {
              resetHideTimer();
              const next = !showStops;
              setShowStops(next);
            }}
            className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
              showStops
                ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
            }`}
            title={showStops ? 'Ocultar paradas' : 'Mostrar paradas'}
          >
            <span className="leading-none select-none">🚏</span>
          </button>

          {/* Desplegable de Paradas con información y buscador */}
          {isStopsPanelOpen && (
            <div
              className="absolute top-full mt-2 right-0 w-[calc(100vw-1.5rem)] max-w-sm sm:w-92 max-h-[68vh] rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#101114] p-3.5 z-40 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚏</span>
                  <h3 className="text-xs font-black text-white">Paradas Línea 228</h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#101114] border border-white/15 text-[#FFF19A] text-[10px] font-mono font-bold">
                    {LINEA_228_STOPS.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsStopsPanelOpen(false)}
                  title="Cerrar"
                  className="w-8 h-8 rounded-lg bg-[#101114] border border-white/10 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Buscador de paradas */}
              <div className="pt-2.5 pb-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por calle o barrio..."
                    value={stopSearchQuery}
                    onChange={(e) => setStopSearchQuery(e.target.value)}
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl bg-[#101114] border border-white/15 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>
              </div>

              {/* Lista scrollable de paradas */}
              <div className="overflow-y-auto space-y-2 pr-1 flex-1 max-h-[50vh]">
                {LINEA_228_STOPS.filter(
                  (s) =>
                    s.name.toLowerCase().includes(stopSearchQuery.toLowerCase()) ||
                    s.zone.toLowerCase().includes(stopSearchQuery.toLowerCase()) ||
                    (s.description && s.description.toLowerCase().includes(stopSearchQuery.toLowerCase()))
                ).map((stop) => {
                  const isMcDonalds = stop.name.toLowerCase().includes('mcdonald');
                  return (
                    <div
                      key={stop.id}
                      className={`p-3 rounded-xl border transition-all text-xs ${
                        isMcDonalds
                          ? 'bg-[#101114] border-[#FFF19A]/50'
                          : 'bg-[#101114] hover:border-white/25 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-[#202329] text-[#FFF19A] font-mono text-[9.5px] font-black border border-white/10">
                              #{stop.sequence}
                            </span>
                            <span className="text-[10px] text-[#9299A5] font-mono">
                              {stop.zone}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-white text-[12px] mt-1 leading-snug">
                            {stop.name}
                          </h4>
                          {stop.description && (
                            <p className="text-[10px] text-[#9299A5] mt-0.5 line-clamp-1">
                              {stop.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botón Llevarme a esta ubicación */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (mapInstanceRef.current) {
                              mapInstanceRef.current.flyTo([stop.lat, stop.lng], 16, { animate: true });
                            }
                            handleCalculateStopTrajectory(stop, totalRoute);
                            setIsStopsPanelOpen(false);
                          }}
                          className="flex-1 min-h-[40px] py-1.5 px-2.5 rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          title="Guía GPS"
                        >
                          <Navigation className="w-3.5 h-3.5 text-[#101114]" />
                          <span>Llevarme a esta ubicación</span>
                        </button>

                        <button
                          onClick={() => {
                            if (mapInstanceRef.current) {
                              mapInstanceRef.current.flyTo([stop.lat, stop.lng], 16, { animate: true });
                            }
                            setSelectedStop({ stop, route: totalRoute });
                            setIsStopsPanelOpen(false);
                          }}
                          className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#202329] border border-white/15 hover:border-[#FFF19A] text-[#FFF19A] flex items-center justify-center cursor-pointer"
                          title="Centrar parada"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botón 2: Estación de Servicio (solo icono ⛽) */}
        <button
          onClick={() => {
            resetHideTimer();
            const next = !showGasStations;
            setShowGasStations(next);
            if (next && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([-34.1683, -58.9592]);
            }
          }}
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
            showGasStations
              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
              : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
          }`}
          title={showGasStations ? 'Ocultar estaciones' : 'Mostrar estaciones'}
        >
          <span className="leading-none select-none">⛽</span>
        </button>

        {/* Botón 3: Escuelas (solo icono 🏫) */}
        <button
          onClick={() => {
            resetHideTimer();
            const next = !showSchools;
            setShowSchools(next);
            if (next && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([-34.1800, -58.9500]);
            }
          }}
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
            showSchools
              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
              : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
          }`}
          title={showSchools ? 'Ocultar escuelas' : 'Mostrar escuelas'}
        >
          <span className="leading-none select-none">🏫</span>
        </button>

        {/* Botón 3b: Hospitales y Sanatorios (solo icono 🏥) */}
        <button
          onClick={() => {
            resetHideTimer();
            const next = !showHospitals;
            setShowHospitals(next);
            if (next && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([-34.1594, -58.9628]);
            }
          }}
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
            showHospitals
              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
              : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
          }`}
          title={showHospitals ? 'Ocultar hospitales' : 'Mostrar hospitales'}
        >
          <span className="leading-none select-none">🏥</span>
        </button>

        {/* Botón 3c: Estaciones de Trenes Campana & Zárate (solo icono 🚆) */}
        <button
          onClick={() => {
            resetHideTimer();
            const next = !showTrainStations;
            setShowTrainStations(next);
            if (next && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([-34.1270, -58.9985]);
            }
          }}
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
            showTrainStations
              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
              : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
          }`}
          title={showTrainStations ? 'Ocultar estaciones de trenes' : 'Mostrar estaciones de trenes'}
        >
          <span className="leading-none select-none">🚆</span>
        </button>

        {/* Botón Prestadores de Servicio (Solo para Pasajeros) */}
        {!isDriverMode && (
          <button
            onClick={() => {
              resetHideTimer();
              const next = !showTaxis;
              setShowTaxis(next);
            }}
            className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
              showTaxis
                ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                : 'bg-[#202329]/90 text-[#9299A5] border-white/15 opacity-70 hover:opacity-100 grayscale'
            }`}
            title={showTaxis ? 'Ocultar prestadores' : 'Mostrar prestadores'}
          >
            <span className="leading-none select-none">🚕</span>
          </button>
        )}

        {/* Botón 4: Filtro de Eventos y Capas por Categoría */}
        <div>
          <button
            onClick={() => {
              resetHideTimer();
              const next = !isEventFilterPanelOpen;
              setIsEventFilterPanelOpen(next);
              if (next) {
                setIsEventsPanelOpen(false);
                setIsStopsPanelOpen(false);
              }
            }}
            className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
              isEventFilterPanelOpen
                ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                : 'bg-[#202329]/95 text-white border-white/15 hover:border-[#FFF19A]'
            }`}
            title="Filtros del mapa"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Desplegable de Filtro de Eventos y Capas por Categoría */}
          {isEventFilterPanelOpen && (
            <div className="absolute top-full mt-2 right-0 w-[calc(100vw-1.5rem)] max-w-xs sm:w-80 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#101114] p-3.5 z-40 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-[#101114] text-[#FFF19A] flex items-center justify-center text-xs border border-white/15">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      resetHideTimer();
                      setShowEvents(!showEvents);
                    }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs border transition-all cursor-pointer ${
                      showEvents
                        ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                        : 'bg-[#101114] text-[#9299A5] border-white/10'
                    }`}
                    title={showEvents ? 'Ocultar eventos' : 'Mostrar eventos'}
                  >
                    {showEvents ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      resetHideTimer();
                      setShowStops(true);
                      setShowGasStations(true);
                      setShowSchools(true);
                      setShowHospitals(true);
                      setShowTrainStations(true);
                      setShowEvents(true);
                      setShowTaxis(true);
                      setActiveEventCategories({
                        bus_location: true,
                        accident: true,
                        late: true,
                        traffic: true,
                        corte: true,
                        control: true,
                        breakdown: true,
                        missed: true,
                        inundacion: true,
                        moving: true,
                        other: true,
                      });
                    }}
                    className="w-8 h-8 rounded-lg bg-[#101114] hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center text-xs border border-white/10 transition-all cursor-pointer"
                    title="Restablecer filtros"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsEventFilterPanelOpen(false)}
                    className="w-8 h-8 rounded-lg bg-[#101114] hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center text-xs border border-white/10 transition-colors cursor-pointer"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fila 1: Alternancia de Capas Principales */}
              <div className="py-2.5 border-b border-white/10 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => {
                    resetHideTimer();
                    setShowStops(!showStops);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border transition-all cursor-pointer active:scale-95 ${
                    showStops
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-50 grayscale'
                  }`}
                  title={showStops ? 'Ocultar paradas' : 'Mostrar paradas'}
                >
                  <span className="leading-none select-none">🚏</span>
                </button>

                <button
                  onClick={() => {
                    resetHideTimer();
                    setShowGasStations(!showGasStations);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border transition-all cursor-pointer active:scale-95 ${
                    showGasStations
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-50 grayscale'
                  }`}
                  title={showGasStations ? 'Ocultar estaciones' : 'Mostrar estaciones'}
                >
                  <span className="leading-none select-none">⛽</span>
                </button>

                <button
                  onClick={() => {
                    resetHideTimer();
                    setShowSchools(!showSchools);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border transition-all cursor-pointer active:scale-95 ${
                    showSchools
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-50 grayscale'
                  }`}
                  title={showSchools ? 'Ocultar colegios' : 'Mostrar colegios'}
                >
                  <span className="leading-none select-none">🏫</span>
                </button>

                <button
                  onClick={() => {
                    resetHideTimer();
                    setShowHospitals(!showHospitals);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border transition-all cursor-pointer active:scale-95 ${
                    showHospitals
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-50 grayscale'
                  }`}
                  title={showHospitals ? 'Ocultar hospitales' : 'Mostrar hospitales'}
                >
                  <span className="leading-none select-none">🏥</span>
                </button>

                <button
                  onClick={() => {
                    resetHideTimer();
                    setShowTrainStations(!showTrainStations);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border transition-all cursor-pointer active:scale-95 ${
                    showTrainStations
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-50 grayscale'
                  }`}
                  title={showTrainStations ? 'Ocultar estaciones de trenes' : 'Mostrar estaciones de trenes'}
                >
                  <span className="leading-none select-none">🚆</span>
                </button>

                <button
                  onClick={() => {
                    resetHideTimer();
                    setIsStopsPanelOpen(true);
                    setIsEventFilterPanelOpen(false);
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[#FFF19A] bg-[#101114] hover:border-[#FFF19A] border border-white/15 transition-all cursor-pointer active:scale-95"
                  title="Buscar paradas"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Fila 2: Categorías de Eventos e Inconvenientes */}
              <div className="pt-2.5 grid grid-cols-5 gap-2">
                {EVENT_FILTER_CATEGORIES.map((cat) => {
                  const isActive = showEvents && activeEventCategories[cat.key] !== false;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => {
                        resetHideTimer();
                        setActiveEventCategories((prev) => ({
                          ...prev,
                          [cat.key]: !prev[cat.key],
                        }));
                      }}
                      className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-all cursor-pointer active:scale-90 ${
                        isActive
                          ? 'bg-[#101114] border-[#B7F36B] text-white'
                          : 'bg-[#101114] text-[#9299A5] border-white/10 opacity-40 grayscale'
                      }`}
                      title={cat.tooltip}
                    >
                      <span className="leading-none select-none">{cat.icon}</span>
                      {isActive && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#B7F36B] ring-2 ring-[#202329]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Acceso Rápido Inferior: Registrar Evento */}
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => {
                    resetHideTimer();
                    setIsEventsPanelOpen(true);
                    setIsEventFilterPanelOpen(false);
                  }}
                  className="w-full min-h-[44px] py-2 rounded-xl bg-[#FFF19A] hover:brightness-95 border border-[#101114] text-[#101114] flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer"
                  title="Publicar evento"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publicar Evento</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botón 5: Reportar Eventos e Inconvenientes del Transporte */}
        <button
          onClick={() => {
            resetHideTimer();
            const next = !isEventsPanelOpen;
            setIsEventsPanelOpen(next);
            if (next) {
              setIsStopsPanelOpen(false);
              setIsEventFilterPanelOpen(false);
            }
          }}
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-lg border-2 shadow-[2px_2px_0px_#101114] transition-all active:scale-95 cursor-pointer shrink-0 ${
            isEventsPanelOpen
              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
              : 'bg-[#202329]/95 text-[#FFF19A] border-white/15 hover:border-[#FFF19A]'
          }`}
          title="Reportar evento"
        >
          <span className="leading-none select-none">⚠️</span>
        </button>
      </div>

      {/* Contenedor Superior Centrado: Eventos e Inconvenientes */}
      {isEventsPanelOpen && (
        <div className="fixed inset-0 z-[65] flex items-start justify-center pt-4 sm:pt-6 px-3 pointer-events-none">
          <div
            onClick={() => setIsEventsPanelOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto transition-opacity"
          />

          <div
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
            className="relative pointer-events-auto w-full max-w-lg sm:max-w-xl max-h-[82vh] rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/50 shadow-[6px_6px_0px_#101114] p-4 sm:p-5 z-50 flex flex-col animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FFF19A] text-[#101114] border border-[#101114] flex items-center justify-center text-lg font-black">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Eventos e Inconvenientes
                    <span className="text-[10px] font-mono font-black text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded-md">
                      En Vivo
                    </span>
                  </h3>
                  <p className="text-xs text-[#9299A5] leading-tight mt-0.5">
                    Reportá la ubicación del colectivo o registrá un inconveniente en ruta
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEventsPanelOpen(false)}
                className="w-10 h-10 rounded-xl bg-[#101114] hover:border-[#FFF19A] border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nota o Detalle opcional */}
            <div className="pt-3 pb-2.5 shrink-0">
              <input
                type="text"
                placeholder="Nota o detalle opcional (ej: Pasó recién frente a Tenaris...)"
                value={eventCustomNote}
                onChange={(e) => setEventCustomNote(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#101114] border border-white/15 text-xs sm:text-sm text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-all"
              />
            </div>

            {/* Indicador de ubicación de registro + Telemetría continua de velocidad, rumbo y calibración */}
            <div className="mb-3 px-3 py-2 rounded-xl bg-[#101114] border border-white/10 text-xs text-[#9299A5] space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
                  <span className="truncate">
                    {userLocation?.address ? `Ubicación: ${userLocation.address}` : 'Ubicación actual en corredor Zárate ↔ Campana'}
                  </span>
                </span>
                <span className="text-[10px] font-mono font-black text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded-md shrink-0">
                  {gpsCalibrationStatus
                    ? `Calibrando (${gpsCalibrationStatus.samples}/6)`
                    : `GPS ±${Math.round(userLocation?.accuracy || 15)}m`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-slate-300 border-t border-white/10 pt-1.5">
                {gpsCalibrationStatus ? (
                  <span className="text-[#FFF19A] font-black animate-pulse">
                    📡 Evaluando 6 lecturas GPS ({gpsCalibrationStatus.samples}/6) · Mejor lectura: ±{gpsCalibrationStatus.bestAccuracy}m...
                  </span>
                ) : (
                  <>
                    <span>
                      Velocidad: <strong className="text-[#B7F36B]">{calculateRealBusSpeed(userLocation?.lat, userLocation?.lng).speedKmH} km/h</strong>
                    </span>
                    <span>
                      Rumbo:{' '}
                      <strong className="text-sky-300">
                        {calculateRealBusHeading().cardinalLabel !== '—'
                          ? calculateRealBusHeading().cardinalLabel
                          : formatHeadingCardinal(userLocation?.heading)}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Lista scrollable de eventos */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 max-h-[50vh]">
              {TRANSIT_EVENT_TYPES.map((evOpt) => {
                if (evOpt.isPrimary) {
                  return (
                    <div
                      key={evOpt.id}
                      className="w-full p-3.5 rounded-2xl border-2 border-[#FFF19A] bg-[#101114] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#FFF19A] text-[#101114] border border-[#101114] flex items-center justify-center text-xl shrink-0">
                            📍
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-white text-sm font-display">
                                {evOpt.label}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#B7F36B] text-[#101114] flex items-center gap-1">
                                <span>Más Usado</span>
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9299A5] mt-0.5 leading-snug">
                              {evOpt.subtitle}. Permanece 1 minuto en el mapa y se publica en el chat.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#202329] border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-bold text-[#FFF19A] uppercase tracking-wider">
                            Elegí la dirección del colectivo:
                          </span>
                          <span className="text-[10px] font-mono text-[#9299A5]">
                            1 toque
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleRegisterEventFromDropdown(evOpt, 'hacia_zarate')}
                            className="min-h-[44px] px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white border border-red-300/70 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                            title="Reportar hacia Zárate"
                          >
                            <span className="text-sm">➡️</span>
                            <span>Hacia Zárate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRegisterEventFromDropdown(evOpt, 'hacia_malvinas')}
                            className="min-h-[44px] px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-300/70 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                            title="Reportar hacia Malvinas"
                          >
                            <span className="text-sm">⬅️</span>
                            <span>Hacia Malvinas</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={evOpt.id}
                    onClick={() => handleRegisterEventFromDropdown(evOpt)}
                    className="w-full min-h-[56px] p-3 rounded-xl border border-white/15 bg-[#101114] hover:border-[#FFF19A] text-left transition-all cursor-pointer group active:scale-98 flex items-center gap-3.5"
                    title={evOpt.label}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-[#202329] border border-white/10">
                      {evOpt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-white text-xs sm:text-sm group-hover:text-[#FFF19A] transition-colors">
                          {evOpt.label}
                        </h4>
                        <span className="text-[10px] font-mono font-bold text-[#101114] bg-[#FFF19A] px-2 py-0.5 rounded-md shrink-0">
                          Publicar ➔
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9299A5] mt-0.5 leading-snug line-clamp-1">
                        {evOpt.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACTIVE DRIVER TRAYECTORY HUD (When a taxi is selected in Taxis & Motos)
         ========================================================================= */}
      {activeTrackingTaxi && trajectoryInfo && (
        <div
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className={`absolute top-16 sm:top-18 left-3 right-3 sm:left-4 sm:right-auto sm:w-[380px] z-[45] transition-all duration-500 ease-in-out ${
            areCardsVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-3 pointer-events-none'
          }`}
        >
          <div className="uppa-glass-ios uppa-card-enter p-4 rounded-2xl border-[#B7F36B]/70 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] animate-ping shrink-0" />
                <span className="text-xs font-black text-[#B7F36B] uppercase tracking-wider font-mono">
                  Trayectoria en Vivo
                </span>
              </div>
              {onClearTrackingTaxi && (
                <button
                  onClick={onClearTrackingTaxi}
                  className="w-8 h-8 rounded-lg bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Cerrar seguimiento de conductor"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="pt-3 space-y-3">
              <div className="p-3.5 rounded-xl bg-[#101114] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#9299A5] font-mono uppercase tracking-wider font-bold">
                    Tiempo estimado de llegada
                  </div>
                  <div className="text-2xl font-black text-white font-display flex items-baseline gap-1.5 mt-0.5">
                    <span>{trajectoryInfo.etaMinutes} min</span>
                    <span className="text-xs font-mono text-[#B7F36B] font-bold">
                      ({trajectoryInfo.distKm} km)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-md bg-[#B7F36B] text-[#101114] text-[10px] font-mono font-black">
                    ~35 km/h
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[#101114]/65 border border-white/15 px-3 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-[#B7F36B]">Vehículo acercándose</span>
                  <span className="text-[#FFF19A] font-mono">~{trajectoryInfo.etaMinutes} min</span>
                </div>
                <div className="relative h-5 flex items-center justify-between overflow-hidden px-1">
                  <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF19A]/45" />
                  <div className="relative z-10 flex-1 pr-6 overflow-hidden">
                    <div className="w-full uppa-vehicle-approach-track">
                      <span className="text-sm leading-none inline-block" aria-hidden="true">
                        {activeTrackingTaxi.vehicleType === 'moto' ? '🛵' : '🚗'}
                      </span>
                    </div>
                  </div>
                  <span className="relative z-10 text-sm leading-none shrink-0" aria-hidden="true">
                    📍
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs bg-[#101114]/70 p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] shrink-0" />
                  <span className="font-bold text-[#9299A5]">Punto A:</span>
                  <span className="text-white truncate font-bold">
                    {activeTrackingTaxi.driverName} ({activeTrackingTaxi.zone})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFF19A] shrink-0" />
                  <span className="font-bold text-[#9299A5]">Punto B:</span>
                  <span className="text-white truncate">
                    {userLocation?.address || 'Tu Ubicación'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://wa.me/${activeTrackingTaxi.whatsapp}?text=${encodeURIComponent(
                    `Hola ${activeTrackingTaxi.driverName}! Te vi en el mapa de UPPA a ${trajectoryInfo.etaMinutes} min de mi ubicación (${trajectoryInfo.distKm} km). ¿Podés realizar el viaje?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Contactar por WhatsApp"
                  className="flex-1 min-h-[44px] rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4 text-[#101114]" />
                  <span>Pedir por WhatsApp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>

                {onClearTrackingTaxi && (
                  <button
                    onClick={onClearTrackingTaxi}
                    title="Cerrar ruta"
                    className="px-3.5 min-h-[44px] rounded-xl bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-xs font-bold text-white cursor-pointer"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACTIVE STOP TRAJECTORY HUD (Guía GPS Activa a Parada)
         ========================================================================= */}
      {stopTrajectoryInfo && (
        <div
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className={`absolute top-16 sm:top-18 left-3 right-3 sm:left-4 sm:right-auto sm:w-[390px] z-[45] transition-all duration-500 ease-in-out ${
            areCardsVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-3 pointer-events-none'
          }`}
        >
          <div className="uppa-glass-ios uppa-card-enter p-4 rounded-2xl border-[#FFF19A]/70 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B7F36B] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#B7F36B]"></span>
                </span>
                <span className="text-xs font-black text-[#FFF19A] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#FFF19A]" />
                  <span>Guía GPS Activa · Hacia Parada</span>
                </span>
              </div>
              <button
                onClick={handleClearStopTrajectory}
                className="w-8 h-8 rounded-lg bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Finalizar guía GPS"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-3 space-y-3">
              <div className="p-3.5 rounded-xl bg-[#101114] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#9299A5] font-mono uppercase tracking-wider font-bold">
                    Distancia Restante
                  </div>
                  <div className="text-2xl font-black text-white font-display flex items-baseline gap-1.5 mt-0.5">
                    <span>
                      {stopTrajectoryInfo.distKm < 1
                        ? `${Math.round(stopTrajectoryInfo.distKm * 1000)} m`
                        : `${stopTrajectoryInfo.distKm} km`}
                    </span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs font-mono text-[#101114] font-black flex items-center justify-end gap-1.5 bg-[#B7F36B] px-2.5 py-0.5 rounded-md">
                    <span>🚶 ~{stopTrajectoryInfo.etaWalkMin} min</span>
                  </div>
                  <div className="text-[10.5px] font-mono text-[#FFF19A] flex items-center justify-end gap-1">
                    <span>🚌 En micro: ~{stopTrajectoryInfo.etaTransitMin} min</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs bg-[#101114] p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFF19A] shrink-0" />
                  <span className="font-bold text-[#9299A5] text-[11px]">Origen:</span>
                  <span className="text-white truncate font-medium">
                    {userLocation?.address || 'Tu Ubicación GPS Actual'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] shrink-0" />
                  <span className="font-bold text-[#B7F36B] text-[11px]">Destino:</span>
                  <span className="text-white font-bold truncate">
                    {stopTrajectoryInfo.stop.name} (Parada #{stopTrajectoryInfo.stop.sequence})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.fitBounds(
                        [
                          [stopTrajectoryInfo.userLat, stopTrajectoryInfo.userLng],
                          [stopTrajectoryInfo.stop.lat, stopTrajectoryInfo.stop.lng],
                        ],
                        { padding: [70, 70], maxZoom: 16 }
                      );
                    }
                  }}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#FFF19A] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  title="Centrar ruta"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Centrar</span>
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${stopTrajectoryInfo.stop.lat},${stopTrajectoryInfo.stop.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3 rounded-xl bg-[#B7F36B] hover:brightness-95 border border-[#101114] text-xs font-black text-[#101114] flex items-center justify-center gap-1.5 shrink-0"
                  title="Abrir Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#101114]" />
                  <span>GPS Externo</span>
                </a>

                <button
                  onClick={handleClearStopTrajectory}
                  className="px-3 min-h-[44px] rounded-xl bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-xs font-bold text-white cursor-pointer"
                  title="Finalizar guía"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ACTIVE PASSENGER TRACKING HUD (Guía GPS Activa hacia el Pasajero)
         ========================================================================= */}
      {passengerTrajectoryInfo && (
        <div
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className={`absolute top-2 left-2 right-2 sm:top-2.5 sm:left-12 sm:right-auto sm:w-[315px] md:w-[370px] lg:w-[395px] z-[56] max-h-[calc(100%-78px)] overflow-y-auto overscroll-contain rounded-2xl transition-all duration-500 ease-in-out ${
            areCardsVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-3 pointer-events-none'
          }`}
        >
          <div
            className={`uppa-glass-ios uppa-card-enter rounded-2xl border-[#B7F36B]/75 relative overflow-hidden ${
              isPassengerHudMinimized ? 'p-2.5' : 'p-2.5 sm:p-3.5'
            }`}
          >
            <div
              className={`flex items-center justify-between gap-2 ${
                isPassengerHudMinimized ? '' : 'pb-2 border-b border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B7F36B] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B7F36B]"></span>
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] sm:text-xs font-black text-[#B7F36B] uppercase tracking-wider font-mono flex items-center gap-1.5 truncate">
                    <Navigation className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                    <span className="truncate">Ubicación GPS del Pasajero Habilitada</span>
                  </span>
                  {isPassengerHudMinimized && (
                    <div className="text-[11px] font-bold text-white/90 truncate mt-0.5">
                      {passengerTrajectoryInfo.solicitud.nombrePasajero} ·{' '}
                      <span className="text-[#FFF19A] font-mono">
                        {passengerTrajectoryInfo.distKm < 1
                          ? `${Math.round(passengerTrajectoryInfo.distKm * 1000)} m`
                          : `${passengerTrajectoryInfo.distKm} km`}{' '}
                        (~{passengerTrajectoryInfo.etaDriveMin} min)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPassengerHudMinimized((prev) => !prev)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#101114] border border-white/15 hover:border-[#B7F36B] text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title={isPassengerHudMinimized ? 'Expandir tarjeta GPS' : 'Minimizar tarjeta GPS'}
                  aria-label={isPassengerHudMinimized ? 'Expandir tarjeta GPS' : 'Minimizar tarjeta GPS'}
                >
                  {isPassengerHudMinimized ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
                {onClearTrackingPassenger && (
                  <button
                    type="button"
                    onClick={onClearTrackingPassenger}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Cerrar"
                    aria-label="Cerrar seguimiento GPS"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!isPassengerHudMinimized && (
              <div className="pt-2 sm:pt-2.5 space-y-2 sm:space-y-2.5">
                <div className="p-2.5 sm:p-3 rounded-xl bg-[#101114] border border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[9.5px] sm:text-[10px] text-[#9299A5] font-mono uppercase tracking-wider font-bold">
                      Distancia al Pasajero
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-display flex items-baseline gap-1.5 mt-0.5 leading-none">
                      <span>
                        {passengerTrajectoryInfo.distKm < 1
                          ? `${Math.round(passengerTrajectoryInfo.distKm * 1000)} m`
                          : `${passengerTrajectoryInfo.distKm} km`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-1 shrink-0">
                    <div className="text-[11px] sm:text-xs font-mono text-[#101114] font-black flex items-center justify-end gap-1.5 bg-[#FFF19A] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md">
                      <span>🚗 ~{passengerTrajectoryInfo.etaDriveMin} min</span>
                    </div>
                    <div className="text-[10px] font-mono text-[#B7F36B] flex items-center justify-end gap-1">
                      <span>Ruta óptima trazada</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#101114]/65 border border-white/15 px-2.5 py-1 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-[#B7F36B]">Acercándose al pasajero</span>
                    <span className="text-[#FFF19A] font-mono">~{passengerTrajectoryInfo.etaDriveMin} min</span>
                  </div>
                  <div className="relative h-4 sm:h-5 flex items-center justify-between overflow-hidden px-1">
                    <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF19A]/45" />
                    <div className="relative z-10 flex-1 pr-6 overflow-hidden">
                      <div className="w-full uppa-vehicle-approach-track">
                        <span className="text-sm leading-none inline-block" aria-hidden="true">
                          {passengerTrajectoryInfo.solicitud.tipoVehiculoRequerido === 'moto' ? '🛵' : '🚗'}
                        </span>
                      </div>
                    </div>
                    <span className="relative z-10 text-sm leading-none shrink-0" aria-hidden="true">
                      📍
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs bg-[#101114]/70 p-2.5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between pb-1 mb-0.5 border-b border-white/10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#202329] border border-white/15 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        🧑
                      </span>
                      <span className="font-extrabold text-white text-xs truncate">
                        {passengerTrajectoryInfo.solicitud.nombrePasajero}
                      </span>
                    </div>
                    <span className="text-[9.5px] uppercase font-black text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded-md shrink-0">
                      {passengerTrajectoryInfo.solicitud.tipoVehiculoRequerido === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-white">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#B7F36B] shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9.5px] sm:text-[10px] font-bold text-[#B7F36B] uppercase tracking-wider block">
                        Punto de Encuentro:
                      </span>
                      <span className="text-white font-medium text-[11.5px] sm:text-xs block leading-tight">
                        {passengerTrajectoryInfo.solicitud.origen}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-white pt-0.5">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#FFF19A] shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9.5px] sm:text-[10px] font-bold text-[#FFF19A] uppercase tracking-wider block">
                        Destino Final:
                      </span>
                      <span className="text-white font-medium text-[11.5px] sm:text-xs block leading-tight">
                        {passengerTrajectoryInfo.solicitud.destino}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 pt-0.5 flex-wrap">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${passengerTrajectoryInfo.passengerLat},${passengerTrajectoryInfo.passengerLng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="Abrir Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#101114]" />
                    <span>Google Maps GPS</span>
                  </a>

                  {passengerTrajectoryInfo.solicitud.telefonoPasajero && (
                    <a
                      href={`https://wa.me/${passengerTrajectoryInfo.solicitud.telefonoPasajero}?text=${encodeURIComponent(
                        `¡Hola ${passengerTrajectoryInfo.solicitud.nombrePasajero}! Soy tu chofer de UPPA. Voy en camino hacia ${passengerTrajectoryInfo.solicitud.origen}.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 rounded-xl bg-[#FFF19A] hover:brightness-95 border border-[#101114] text-[#101114] font-black text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all"
                      title="WhatsApp pasajero"
                    >
                      <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {Boolean(passengerTrajectoryInfo.solicitud.codigoValidado) &&
                    (onFinalizePassengerRide || onClearTrackingPassenger) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onFinalizePassengerRide) {
                            onFinalizePassengerRide(passengerTrajectoryInfo.solicitud.id);
                          } else {
                            onClearTrackingPassenger?.();
                          }
                        }}
                        className="px-3 sm:px-3.5 min-h-[38px] sm:min-h-[42px] rounded-xl uppa-cta-green text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        title="Finalizar viaje y pasar a disponible"
                      >
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Finalizar</span>
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stop Inspector Bottom Drawer */}
      {!stopTrajectoryInfo && selectedStop && (
        <div
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className={`absolute bottom-24 left-3 right-3 sm:right-auto sm:left-4 sm:w-92 z-[55] transition-all duration-500 ease-in-out ${
            areCardsVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <div className="p-4 rounded-2xl shadow-[5px_5px_0px_#101114] space-y-3 border-2 border-white/15 bg-[#202329]">
            <div className="h-1 rounded-full w-full bg-[#FFF19A]" />

            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#101114] border border-[#FFF19A]/60 flex items-center justify-center shrink-0 text-white font-bold text-sm mt-0.5">
                  🚏
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-tight">
                    {selectedStop.stop.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-[#B7F36B]" />
                    <span className="text-[10px] text-[#9299A5] font-semibold">
                      {selectedStop.route.name}
                    </span>
                    <span className="text-[9.5px] font-mono text-[#101114] font-black bg-[#FFF19A] px-1.5 py-0.5 rounded">
                      Parada #{selectedStop.stop.sequence}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStop(null)}
                className="w-8 h-8 rounded-lg bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const uLat = userLocation?.lat || -34.195;
              const uLng = userLocation?.lng || -58.972;
              const dKm = getDistanceKm(uLat, uLng, selectedStop.stop.lat, selectedStop.stop.lng);
              const walkMin = Math.max(1, Math.round((dKm / 4.5) * 60));
              const distText = dKm < 1 ? `${Math.round(dKm * 1000)} m` : `${dKm.toFixed(1)} km`;

              return (
                <div className="grid grid-cols-3 gap-1.5 text-center bg-[#101114] p-2.5 rounded-xl border border-white/10">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-mono text-[#9299A5] uppercase">Distancia</div>
                    <div className="text-xs font-black text-white font-mono">{distText}</div>
                  </div>
                  <div className="space-y-0.5 border-x border-white/10">
                    <div className="text-[9px] font-mono text-[#9299A5] uppercase">Caminando</div>
                    <div className="text-xs font-black text-[#B7F36B] font-mono">~{walkMin} min</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-mono text-[#9299A5] uppercase">Frecuencia</div>
                    <div className="text-xs font-black text-[#FFF19A] font-mono">c/{selectedStop.route.frequencyMinutes}m</div>
                  </div>
                </div>
              );
            })()}

            <div className="pt-0.5">
              <a
                href={`https://www.google.com/maps/dir/?api=1&${
                  userLocation ? `origin=${userLocation.lat},${userLocation.lng}&` : ''
                }destination=${selectedStop.stop.lat},${selectedStop.stop.lng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  handleCalculateStopTrajectory(selectedStop.stop, selectedStop.route);
                  setSelectedStop(null);
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                title="Abrir Google Maps"
              >
                <Navigation className="w-4 h-4 text-[#101114]" />
                <span className="tracking-tight text-xs uppercase font-black">IR · Iniciar Guía GPS</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#101114]" />
              </a>
            </div>

            {onOpenPedirTransporte && (
              <button
                onClick={() => {
                  onOpenPedirTransporte();
                  setSelectedStop(null);
                }}
                title="Pedir Auto o Moto"
                className="w-full min-h-[44px] rounded-xl bg-[#FFF19A] hover:brightness-95 border border-[#101114] text-[#101114] font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-[#101114] text-[#101114]" />
                <span>Pedir Transporte Alternativo en esta parada</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

