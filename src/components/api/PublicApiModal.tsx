import React, { useState } from 'react';
import { X, Copy, Check, Code, Terminal, Globe, Key, Satellite } from 'lucide-react';
import { TransitRoute, MapEvent, TaxiListing } from '../../types';
import { MAP_CONFIG } from '../../config/api';

interface PublicApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: TransitRoute[];
  events: MapEvent[];
  taxis: TaxiListing[];
}

export const PublicApiModal: React.FC<PublicApiModalProps> = ({
  isOpen,
  onClose,
  routes,
  events,
  taxis,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/v1/line-status');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getPayload = () => {
    switch (selectedEndpoint) {
      case '/v1/line-status':
        return {
          status: 'delayed',
          headline: '🟡 Retrasos Comprobados (15-25 min)',
          corridor: 'Zárate ↔ Campana (Barrio Malvinas)',
          activeAlertsCount: events.length,
          activeBusesTracking: 3,
          availableTaxisBackup: taxis.filter((t) => t.status === 'active').length,
          lastUpdated: new Date().toISOString(),
          sentimentIndex: 64,
        };
      case '/v1/cartography/config':
        return {
          apiKey: MAP_CONFIG.API_KEY,
          providers: {
            weatherRadarRain: MAP_CONFIG.PROVIDERS.WEATHER_RAIN,
            locationIqDark: MAP_CONFIG.PROVIDERS.LOCATIONIQ_DARK,
            locationIqStreets: MAP_CONFIG.PROVIDERS.LOCATIONIQ_STREETS,
            cartoDark: MAP_CONFIG.PROVIDERS.CARTO_DARK,
          },
          reverseGeocoding: 'Enabled via LocationIQ & Local Heuristics',
          corridorCenter: MAP_CONFIG.DEFAULT_CENTER,
        };
      case '/v1/drivers/telemetry':
        return {
          connectedDriversCount: taxis.filter((t) => t.status === 'active').length,
          liveStreams: taxis
            .filter((t) => t.status === 'active')
            .map((t) => ({
              driverId: t.id,
              driverName: t.driverName,
              vehicleType: t.vehicleType,
              coordinates: { lat: t.lat, lng: t.lng },
              zone: t.zone,
              status: 'TRANSMITTING_LIVE_GPS',
              expiresAt: new Date(t.endsAt).toISOString(),
            })),
        };
      case '/v1/routes':
        return routes.map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          stopsCount: r.stops.length,
          status: r.status,
          currentDelayMinutes: r.currentDelayMinutes,
        }));
      case '/v1/map-events/public':
        return events.map((e) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          lat: e.lat,
          lng: e.lng,
          confirmations: e.confirmations,
          reportedAt: e.reportedAt,
        }));
      case '/v1/taxi/listings':
        return taxis
          .filter((t) => t.status === 'active')
          .map((t) => ({
            id: t.id,
            driverName: t.driverName,
            vehicleType: t.vehicleType,
            zone: t.zone,
            whatsappDirect: `https://wa.me/${t.whatsapp}`,
            activeUntil: new Date(t.endsAt).toLocaleTimeString(),
          }));
      default:
        return {};
    }
  };

  const payloadString = JSON.stringify(getPayload(), null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#202329] border-2 border-white/20 rounded-3xl shadow-[6px_6px_0px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/40 flex items-center justify-center text-[#FFF19A]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                API Pública & Cartografía UPPA
              </h2>
              <p className="text-xs text-[#9299A5]">
                Integración con API Key cartográfica y telemetría de conductores en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar ventana de API Pública"
            aria-label="Cerrar"
            className="w-11 h-11 rounded-xl bg-[#101114] border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active API Key Banner */}
        <div className="px-5 py-2.5 bg-[#101114] border-b border-white/10 flex items-center justify-between text-xs gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span className="text-[#9299A5]">API Key Activa:</span>
            <code className="text-[#FFF19A] font-mono font-bold bg-[#202329] px-2 py-0.5 rounded border border-white/15">
              {MAP_CONFIG.API_KEY}
            </code>
          </div>
          <span className="text-[11px] text-[#B7F36B] font-bold">Cartografía & Radar Conectados</span>
        </div>

        {/* Endpoints bar */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto bg-[#101114]">
          {[
            { path: '/v1/line-status', label: 'GET /line-status' },
            { path: '/v1/cartography/config', label: 'GET /cartography' },
            { path: '/v1/drivers/telemetry', label: 'GET /drivers/gps' },
            { path: '/v1/routes', label: 'GET /routes' },
            { path: '/v1/map-events/public', label: 'GET /map-events' },
            { path: '/v1/taxi/listings', label: 'GET /taxi/listings' },
          ].map((ep) => (
            <button
              key={ep.path}
              type="button"
              onClick={() => setSelectedEndpoint(ep.path)}
              title={`Consultar endpoint ${ep.label}`}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl font-mono text-xs transition-colors whitespace-nowrap cursor-pointer border ${
                selectedEndpoint === ep.path
                  ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] font-black'
                  : 'bg-[#202329] border-white/10 text-[#9299A5] hover:text-white'
              }`}
            >
              {ep.label}
            </button>
          ))}
        </div>

        {/* JSON Preview */}
        <div className="p-5 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between pb-2 text-xs text-[#9299A5]">
            <span className="font-mono text-[#B7F36B] font-bold">Respuesta HTTP 200 OK · JSON</span>
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar respuesta JSON al portapapeles"
              className="min-h-[36px] flex items-center gap-1.5 text-xs text-white bg-[#101114] hover:bg-white/10 border border-white/15 px-3 py-1 rounded-lg cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#B7F36B]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
            </button>
          </div>

          <pre className="flex-1 overflow-auto bg-[#101114] border-2 border-white/10 rounded-2xl p-4 font-mono text-xs text-[#B7F36B] leading-relaxed">
            {payloadString}
          </pre>

          <p className="text-[11px] text-[#9299A5] pt-3">
            Base URL oficial: <code className="text-[#FFF19A] font-mono">https://api.uppa.app</code>. Acceso abierto para el ecosistema Zárate-Campana.
          </p>
        </div>
      </div>
    </div>
  );
};
