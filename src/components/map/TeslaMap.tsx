import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { TransitRoute, MapEvent, LiveBus, TaxiListing, BusStop } from '../../types';
import { UserLocation, getDistanceKm } from '../../utils/geolocation';
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
} from 'lucide-react';

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
  activeTrackingTaxi?: TaxiListing | null;
  onClearTrackingTaxi?: () => void;
  onOpenPedirTransporte?: () => void;
}

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
  activeTrackingTaxi,
  onClearTrackingTaxi,
  onOpenPedirTransporte,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layers
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const weatherLayerRef = useRef<L.TileLayer | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const taxisLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);
  const trajectoryLayerRef = useRef<L.LayerGroup | null>(null);
  const stopTrajectoryLayerRef = useRef<L.LayerGroup | null>(null);

  // Map state - Default to 'osm' (OpenStreetMap cartografía oficial sin opciones de capas)
  const [activeTileStyle, setActiveTileStyle] = useState<'streets' | 'tesla-dark' | 'osm'>('osm');
  const [showWeatherRadar, setShowWeatherRadar] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<{ stop: BusStop; route: TransitRoute } | null>(null);

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

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
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

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialise with 'streets' (Calles & Rutas LocationIQ)
    const baseTile = createResilientTileLayer('streets').addTo(map);
    tileLayerRef.current = baseTile;

    polylinesLayerRef.current = L.layerGroup().addTo(map);
    eventsLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);
    taxisLayerRef.current = L.layerGroup().addTo(map);
    userMarkerRef.current = L.layerGroup().addTo(map);
    trajectoryLayerRef.current = L.layerGroup().addTo(map);
    stopTrajectoryLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
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

    if (userLocation.accuracy && userLocation.accuracy < 100) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy,
        color: isDriver ? '#22c55e' : '#38bdf8',
        fillColor: isDriver ? '#86efac' : '#7dd3fc',
        fillOpacity: 0.14,
        weight: 1,
      }).addTo(layer);
    }

    const beaconIcon = L.divIcon({
      className: 'custom-user-beacon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2.5 rounded-full ${
            isDriver ? 'bg-emerald-400/30' : 'bg-sky-400/30'
          } animate-pulse-ring"></div>
          <div class="w-5 h-5 rounded-full ${
            isDriver ? 'bg-emerald-400 border-2 border-white' : 'bg-sky-400 border-2 border-white'
          } shadow-[0_0_15px_${isDriver ? '#86efac' : '#7dd3fc'}] flex items-center justify-center text-[10px] text-slate-950 font-bold">
            ${isDriver ? '🚕' : '●'}
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: beaconIcon }).addTo(layer);
  }, [userLocation, isDriverMode, isDriverOnline]);

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

  // Multi-Route Cartography Rendering (Pastel Electric Colors)
  useEffect(() => {
    if (!mapInstanceRef.current || !polylinesLayerRef.current) return;
    const layer = polylinesLayerRef.current;
    layer.clearLayers();

    routes.forEach((route) => {
      const isSelected = selectedRouteId === 'all' || selectedRouteId === route.id;
      const opacity = isSelected ? 0.95 : 0.20;
      const weight = isSelected ? (selectedRouteId === route.id ? 6 : 4) : 2;

      // Soft pastel atmospheric glow
      if (isSelected) {
        L.polyline(route.coordinates, {
          color: route.color,
          weight: selectedRouteId === route.id ? 14 : 9,
          opacity: selectedRouteId === route.id ? 0.28 : 0.14,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);
      }

      // Core polyline
      const polyline = L.polyline(route.coordinates, {
        color: route.color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);

      polyline.on('click', () => {
        onSelectRouteId(route.id);
      });

      // Bus Stops on route - Icono titilando tenue con realce en McDonald's y paradas clave
      if (isSelected) {
        route.stops.forEach((stop) => {
          const isMcDonalds = stop.name.toLowerCase().includes('mcdonald');
          const isVigalondo = stop.name.toLowerCase().includes('vigalondo');

          const size = isMcDonalds ? 26 : (isVigalondo ? 20 : 16);
          const anchor = size / 2;

          const haloClass = isMcDonalds
            ? 'bg-amber-400/35 marker-titilando-amber'
            : isVigalondo
            ? 'bg-cyan-400/30 marker-titilando-cyan'
            : 'bg-cyan-400/20 marker-titilando-cyan';

          const dotHtml = isMcDonalds
            ? `<div class="relative w-5 h-5 rounded-full bg-amber-400 border border-white text-[10px] flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.7)] z-10 font-black text-amber-950 transition-transform group-hover:scale-125" title="McDonald's Campana">🍔</div>`
            : `<div class="relative ${
                isVigalondo ? 'w-3 h-3 bg-cyan-200 ring-2 ring-cyan-400/50' : 'w-2.5 h-2.5 bg-cyan-300'
              } rounded-full border border-white/90 shadow-[0_0_6px_rgba(6,182,212,0.5)] z-10 transition-transform group-hover:scale-130"></div>`;

          const stopTitilandoIcon = L.divIcon({
            className: 'custom-stop-titilando-marker',
            html: `
              <div class="relative w-full h-full flex items-center justify-center cursor-pointer group" style="width: ${size}px; height: ${size}px;" title="Parada: ${stop.name} (Clic para calcular trazabilidad)">
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
          stopMarker.on('click', () => {
            handleCalculateStopTrajectory(stop, route);
          });
          stopMarker.addTo(layer);
        });
      }
    });
  }, [routes, selectedRouteId, userLocation, onSelectRouteId, activeTrackingTaxi]);

  // Events Markers (Waze Style with Pastel Tones)
  useEffect(() => {
    if (!mapInstanceRef.current || !eventsLayerRef.current) return;
    const layer = eventsLayerRef.current;
    layer.clearLayers();

    const getEventBadge = (type: any) => {
      switch (type) {
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
          return { icon: '🔧', bg: 'bg-rose-600', ring: 'ring-rose-400/50', border: 'border-rose-400' };
        case 'missed':
          return { icon: '❌', bg: 'bg-amber-600', ring: 'ring-amber-400/50', border: 'border-amber-400' };
        default:
          return { icon: '⚠️', bg: 'bg-amber-500', ring: 'ring-amber-400/50', border: 'border-amber-400' };
      }
    };

    events.forEach((ev) => {
      const badge = getEventBadge(ev.type);
      const isSelected = selectedEvent?.id === ev.id;

      const eventIcon = L.divIcon({
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

      const marker = L.marker([ev.lat, ev.lng], { icon: eventIcon });
      marker.on('click', () => {
        onSelectEvent(ev);
      });
      marker.addTo(layer);
    });
  }, [events, selectedEvent, onSelectEvent]);

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

  // Taxi Markers (Clean Vehicle Icons)
  useEffect(() => {
    if (!mapInstanceRef.current || !taxisLayerRef.current) return;
    const layer = taxisLayerRef.current;
    layer.clearLayers();

    taxis.forEach((taxi) => {
      // Don't render generic taxi marker if this driver is already featured in the tracking trajectory layer
      if (activeTrackingTaxi?.id === taxi.id) return;

      const isMoto = taxi.vehicleType === 'moto';
      const taxiIcon = L.divIcon({
        className: 'custom-taxi-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            <div class="w-8 h-8 rounded-full bg-blue-600/30 border-2 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.55)] flex items-center justify-center text-xs hover:scale-115 transition-transform" title="Transporte Alternativo Habilitado (${taxi.driverName})">
              ${isMoto ? '🏍️' : '🚕'}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon });
      marker.on('click', () => {
        onSelectTaxi(taxi);
      });
      marker.addTo(layer);
    });
  }, [taxis, onSelectTaxi, activeTrackingTaxi]);

  // =========================================================================
  // DRIVER TRACKING TRAJECTORY & ETA (Punto A -> Punto B Titilando)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !trajectoryLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = trajectoryLayerRef.current;
    layer.clearLayers();

    if (!activeTrackingTaxi) {
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
            }
          }
        }
      } catch {
        // network or timeout: fallback to corridor interpolation
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

      // 4. Auto-fit bounds to show full route trajectory
      try {
        const bounds = L.latLngBounds([[driverLat, driverLng], [userLat, userLng]]);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
      } catch {}
    };

    fetchTrajectory();

    return () => {
      isMounted = false;
      layer.clearLayers();
    };
  }, [activeTrackingTaxi, userLocation]);

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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07090e]">
      {/* Map Container Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Route Selector Dropdown: Solo Desplegable Elegir Línea / Recorrido sin opciones debajo que tapen el mapa */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <div className="relative">
          <button
            onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
            className={`h-10 px-4 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2.5 shadow-xl backdrop-blur-xl border ${
              selectedRouteId !== 'all'
                ? 'bg-slate-900/95 text-white border-sky-400/50 shadow-sky-500/20 ring-1 ring-sky-400/30'
                : 'glass-panel text-slate-200 hover:text-white border-white/15 hover:border-white/25 hover:bg-white/10'
            }`}
            title="Elegir Línea / Recorrido"
          >
            {selectedRouteId !== 'all' ? (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm animate-pulse"
                style={{
                  backgroundColor: routes.find((r) => r.id === selectedRouteId)?.color || '#38bdf8',
                }}
              />
            ) : (
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span className="font-bold text-slate-100">
              {selectedRouteId === 'all'
                ? 'Elegir Línea / Recorrido'
                : routes.find((r) => r.id === selectedRouteId)?.shortName || 'Elegir Línea / Recorrido'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isRouteDropdownOpen ? 'rotate-180 text-sky-300' : ''
              }`}
            />
          </button>

          {/* Menú Desplegable con todas las rutas y opciones */}
          {isRouteDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 max-h-96 overflow-y-auto glass-panel rounded-3xl shadow-2xl p-2 z-40 border border-white/10 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-2xl bg-[#090d16]/95">
              <div className="text-[10px] uppercase font-mono font-bold text-slate-400 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                <span>Seleccionar Recorrido</span>
                <span className="text-sky-300 font-normal">Líneas UPPA</span>
              </div>

              <div className="space-y-1 pt-1.5">
                {/* Opción Todas las Rutas */}
                <button
                  onClick={() => {
                    onSelectRouteId('all');
                    setIsRouteDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl transition-all flex items-center justify-between text-xs ${
                    selectedRouteId === 'all'
                      ? 'bg-sky-400/20 text-sky-200 font-bold border border-sky-400/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-sky-300" />
                    <span>Todas las Rutas (Red Completa)</span>
                  </div>
                  {selectedRouteId === 'all' && <CheckCircle className="w-4 h-4 text-sky-400" />}
                </button>

                {/* Líneas y Recorridos */}
                {routes.map((r) => {
                  const isCurrent = selectedRouteId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectRouteId(r.id);
                        setIsRouteDropdownOpen(false);
                        if (mapInstanceRef.current && r.coordinates.length > 0) {
                          mapInstanceRef.current.fitBounds(L.latLngBounds(r.coordinates), { padding: [50, 50] });
                        }
                      }}
                      className={`w-full text-left px-3 py-2 rounded-2xl transition-all flex items-center justify-between text-xs ${
                        isCurrent
                          ? 'bg-white/15 text-white font-bold border border-white/20 shadow-sm'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-md"
                          style={{ backgroundColor: r.color }}
                        />
                        <div className="truncate">
                          <div className="font-bold text-white leading-tight truncate">
                            {r.shortName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {r.stops.length} paradas · cada {r.frequencyMinutes} min
                          </div>
                        </div>
                      </div>
                      {isCurrent && <CheckCircle className="w-4 h-4 text-sky-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Right: Mapa despejado con Cartografía OpenStreetMap */}

      {/* =========================================================================
          ACTIVE DRIVER TRAYECTORY HUD (When a taxi is selected in Taxis & Motos)
         ========================================================================= */}
      {activeTrackingTaxi && trajectoryInfo && (
        <div className="absolute top-18 left-4 right-4 sm:right-auto sm:w-[380px] z-30 pointer-events-auto animate-in slide-in-from-top-4 duration-300">
          <div className="glass-panel p-4 rounded-3xl shadow-2xl border border-emerald-400/40 relative overflow-hidden">
            {/* Ambient top green gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400" />

            <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-mono">
                  Trayectoria en Vivo · Driver Titilando
                </span>
              </div>
              {onClearTrackingTaxi && (
                <button
                  onClick={onClearTrackingTaxi}
                  className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Cerrar seguimiento"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="pt-3 space-y-3">
              {/* Big ETA Display */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/25 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-emerald-300 font-mono uppercase tracking-wider">
                    Tiempo estimado en destino
                  </div>
                  <div className="text-2xl font-extrabold text-white font-display flex items-baseline gap-1.5 mt-0.5">
                    <span>{trajectoryInfo.etaMinutes} min</span>
                    <span className="text-xs font-mono text-emerald-300 font-normal">
                      ({trajectoryInfo.distKm} km)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-mono font-semibold">
                    ~35 km/h
                  </span>
                </div>
              </div>

              {/* Point A -> Point B itinerary */}
              <div className="space-y-1.5 text-xs bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#10b981]" />
                  <span className="font-semibold text-slate-300">Punto A:</span>
                  <span className="text-white truncate">
                    {activeTrackingTaxi.driverName} ({activeTrackingTaxi.zone})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0 shadow-[0_0_8px_#38bdf8]" />
                  <span className="font-semibold text-slate-300">Punto B:</span>
                  <span className="text-white truncate">
                    {userLocation?.address || 'Tu Ubicación (Barrio Malvinas, Campana)'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://wa.me/${activeTrackingTaxi.whatsapp}?text=${encodeURIComponent(
                    `Hola ${activeTrackingTaxi.driverName}! Te vi en el mapa de UPPA a ${trajectoryInfo.etaMinutes} min de mi ubicación (${trajectoryInfo.distKm} km). ¿Podés realizar el viaje?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-10 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Pedir por WhatsApp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>

                {onClearTrackingTaxi && (
                  <button
                    onClick={onClearTrackingTaxi}
                    className="px-3 h-10 rounded-2xl glass-button text-xs text-slate-300 hover:text-white"
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
          ACTIVE STOP TRAJECTORY HUD (Punto A Usuario -> Punto B Parada Titilando)
         ========================================================================= */}
      {stopTrajectoryInfo && (
        <div className="absolute top-18 left-4 right-4 sm:right-auto sm:w-[380px] z-30 pointer-events-auto animate-in slide-in-from-top-4 duration-300">
          <div className="glass-panel p-4 rounded-3xl shadow-2xl border border-cyan-400/40 relative overflow-hidden bg-[#070b14]/90 backdrop-blur-2xl">
            {/* Top ambient cyan gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 animate-pulse" />

            <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
                  Trazabilidad a Parada · Titilando
                </span>
              </div>
              <button
                onClick={handleClearStopTrajectory}
                className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="Cerrar trazabilidad"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-3 space-y-3">
              {/* Distance and ETA calculations */}
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-cyan-300 font-mono uppercase tracking-wider">
                    Distancia y Llegada Estimada
                  </div>
                  <div className="text-2xl font-extrabold text-white font-display flex items-baseline gap-1.5 mt-0.5">
                    <span>
                      {stopTrajectoryInfo.distKm < 1
                        ? `${Math.round(stopTrajectoryInfo.distKm * 1000)} m`
                        : `${stopTrajectoryInfo.distKm} km`}
                    </span>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="text-[11px] font-mono text-emerald-300 font-bold flex items-center justify-end gap-1">
                    <span>🚶</span>
                    <span>~{stopTrajectoryInfo.etaWalkMin} min</span>
                  </div>
                  <div className="text-[10px] font-mono text-sky-300 flex items-center justify-end gap-1">
                    <span>🚌</span>
                    <span>~{stopTrajectoryInfo.etaTransitMin} min</span>
                  </div>
                </div>
              </div>

              {/* Point A -> Point B itinerary */}
              <div className="space-y-1.5 text-xs bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0 shadow-[0_0_8px_#38bdf8]" />
                  <span className="font-semibold text-slate-300">Punto A:</span>
                  <span className="text-white truncate">
                    {userLocation?.address || 'Tu Ubicación GPS'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_#06b6d4]" />
                  <span className="font-semibold text-slate-300">Punto B:</span>
                  <span className="text-cyan-200 font-semibold truncate">
                    {stopTrajectoryInfo.stop.name} (Parada #{stopTrajectoryInfo.stop.sequence})
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
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
                  className="flex-1 h-9 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Centrar Recorrido</span>
                </button>

                <button
                  onClick={handleClearStopTrajectory}
                  className="px-3 h-9 rounded-2xl glass-button text-xs text-slate-300 hover:text-white"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tesla Navigation HUD Card for Bus Corridor (Bottom-Left) */}
      {!activeTrackingTaxi && !stopTrajectoryInfo && (
        <div className="absolute bottom-6 left-4 z-20 pointer-events-auto">
          <div className="glass-panel p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-xs">
            <div className="w-9 h-9 rounded-xl bg-sky-400/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <Compass className="w-4 h-4" />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {activeRoute.shortName}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 font-semibold">
                  +18m
                </span>
              </div>

              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>{nearestBus ? `${nearestBus.speedKmH} km/h` : 'En ruta'}</span>
                <span>·</span>
                <span className="text-sky-300">ETA {nearestBus?.etaMinutes || 4}m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Action Pills (Center-Right) */}
      <div className="absolute bottom-6 right-4 z-20 flex items-center gap-2">
        {onOpenPedirTransporte && (
          <button
            onClick={onOpenPedirTransporte}
            className="h-11 px-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer ring-1 ring-amber-300"
            title="Pedir Transporte Alternativo (Aviso a Moto Taxi y Auto Taxi)"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span className="hidden sm:inline">Pedir Transporte Alternativo</span>
            <span className="sm:hidden">Pedir Transporte</span>
          </button>
        )}

        <button
          onClick={handleLocateMe}
          className="w-11 h-11 rounded-2xl glass-button text-slate-200 hover:text-sky-300 flex items-center justify-center shadow-lg"
          title="Mi Ubicación GPS"
        >
          <Navigation className="w-4 h-4 text-sky-300" />
        </button>

        <button
          onClick={handleFitEntireRoute}
          className="w-11 h-11 rounded-2xl glass-button text-slate-200 hover:text-white flex items-center justify-center shadow-lg"
          title="Enfocar Recorrido"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {onOpenReportModal && (
          <button
            onClick={onOpenReportModal}
            className="h-11 px-4 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
          >
            <span>+ Reportar</span>
          </button>
        )}
      </div>

      {/* Stop Inspector Bottom Drawer (Minimal Glass Drawer) */}
      {!stopTrajectoryInfo && selectedStop && (
        <div className="absolute bottom-20 left-4 right-4 sm:left-auto sm:right-auto sm:left-4 sm:w-80 z-30 pointer-events-auto animate-in slide-in-from-bottom duration-200">
          <div className="glass-panel p-4 rounded-3xl shadow-2xl space-y-2 border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedStop.route.color }} />
                <div>
                  <h4 className="text-xs font-bold text-white">{selectedStop.stop.name}</h4>
                  <span className="text-[10px] text-slate-400">{selectedStop.route.name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedStop(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300 bg-white/[0.04] p-2 rounded-xl">
              <span>Cada {selectedStop.route.frequencyMinutes} min</span>
              {userLocation && (
                <span className="text-sky-300 font-mono">
                  {getDistanceKm(userLocation.lat, userLocation.lng, selectedStop.stop.lat, selectedStop.stop.lng)} km
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
