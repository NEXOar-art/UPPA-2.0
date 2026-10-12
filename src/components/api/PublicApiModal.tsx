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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0c0f17] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                API Pública & Cartografía UPPA
              </h2>
              <p className="text-xs text-slate-400">
                Integración con API Key cartográfica y telemetría de conductores en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active API Key Banner */}
        <div className="px-5 py-2.5 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">API Key Activa:</span>
            <code className="text-cyan-300 font-mono font-bold bg-black/40 px-2 py-0.5 rounded border border-cyan-700/50">
              {MAP_CONFIG.API_KEY}
            </code>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium">Cartografía & Radar Conectados</span>
        </div>

        {/* Endpoints bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto bg-[#090b12]">
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
              onClick={() => setSelectedEndpoint(ep.path)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-colors whitespace-nowrap ${
                selectedEndpoint === ep.path
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ep.label}
            </button>
          ))}
        </div>

        {/* JSON Preview */}
        <div className="p-5 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between pb-2 text-xs text-slate-400">
            <span className="font-mono text-cyan-400">Respuesta HTTP 200 OK · JSON</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 px-2.5 py-1 rounded-lg"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
            </button>
          </div>

          <pre className="flex-1 overflow-auto bg-[#07090e] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-300 leading-relaxed">
            {payloadString}
          </pre>

          <p className="text-[11px] text-slate-500 pt-3">
            Base URL oficial: <code className="text-cyan-400 font-mono">https://api.uppa.app</code>. Acceso abierto para el ecosistema Zárate-Campana.
          </p>
        </div>
      </div>
    </div>
  );
};
