import React, { useState } from 'react';
import { EventType, TransitRoute, MapEvent } from '../../types';
import { X, MapPin, Send } from 'lucide-react';
import { crearReporte } from '../../services/realtimeFirebaseService';
import { calculateRealBusSpeed } from '../../utils/busSpeedEstimator';

interface ReportEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newEvent: Omit<MapEvent, 'id' | 'confirmations' | 'confirmedByUserIds' | 'reportedAt'>) => void;
  routes: TransitRoute[];
  initialLat?: number;
  initialLng?: number;
  currentUserName: string;
  currentUserId: string;
}

const EVENT_OPTIONS: { type: EventType; label: string; icon: string; color: string; defaultTitle: string }[] = [
  { type: 'bus_location', label: 'Ubicación de colectivo ahora', icon: '📍', color: 'border-cyan-400 text-cyan-200 bg-cyan-500/25 ring-2 ring-cyan-400/50 shadow-md', defaultTitle: 'Ubicación de colectivo ahora' },
  { type: 'late', label: 'Demorado', icon: '🚌', color: 'border-amber-400/40 text-amber-200 bg-amber-400/10', defaultTitle: 'Micro demorado' },
  { type: 'breakdown', label: 'Averiado', icon: '🔧', color: 'border-rose-400/40 text-rose-200 bg-rose-400/10', defaultTitle: 'Micro con falla' },
  { type: 'missed', label: 'No Paró', icon: '❌', color: 'border-orange-400/40 text-orange-200 bg-orange-400/10', defaultTitle: 'Salteó parada' },
  { type: 'accident', label: 'Accidente', icon: '💥', color: 'border-red-400/40 text-red-200 bg-red-400/10', defaultTitle: 'Siniestro vial' },
  { type: 'traffic', label: 'Tráfico', icon: '🚗', color: 'border-yellow-400/40 text-yellow-200 bg-yellow-400/10', defaultTitle: 'Tránsito lento' },
  { type: 'moving', label: 'Con Lugar', icon: '⚡', color: 'border-sky-400/40 text-sky-200 bg-sky-400/10', defaultTitle: 'Coche en viaje' },
  { type: 'danger', label: 'Corte', icon: '🚧', color: 'border-purple-400/40 text-purple-200 bg-purple-400/10', defaultTitle: 'Calle cortada' },
];

export const ReportEventModal: React.FC<ReportEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  routes,
  initialLat = -34.1683,
  initialLng = -58.9592,
  currentUserName,
  currentUserId,
}) => {
  const [selectedType, setSelectedType] = useState<EventType>('bus_location');
  const [busDirection, setBusDirection] = useState<'hacia_zarate' | 'hacia_malvinas'>('hacia_zarate');
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || 'route-zarate-malvinas');
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const currentOption = EVENT_OPTIONS.find((o) => o.type === selectedType) || EVENT_OPTIONS[0];
  const isBusLocation = selectedType === 'bus_location';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    const speedData = calculateRealBusSpeed(initialLat, initialLng);
    const eventTitle = isBusLocation
      ? `Ubicación de colectivo ahora (${busDirection === 'hacia_zarate' ? 'Hacia Zárate' : 'Hacia Malvinas'})`
      : currentOption.defaultTitle;

    onSubmit({
      routeId: selectedRouteId,
      type: selectedType,
      title: eventTitle,
      description: comment.trim(),
      lat: initialLat,
      lng: initialLng,
      reportedBy: currentUserName,
      reportedByUserId: currentUserId,
      direction: isBusLocation ? busDirection : 'hacia_malvinas',
      sentido: isBusLocation ? busDirection : undefined,
      velocidadKmH: speedData.speedKmH,
      createdAtMs: now,
      expiresAtMs: isBusLocation ? now + 60000 : undefined,
      isVerified: false,
    });

    const firestoreType: any = isBusLocation
      ? 'ubicacion_colectivo'
      : selectedType === 'accident'
      ? 'accidente'
      : selectedType === 'late'
      ? 'demora'
      : selectedType === 'traffic'
      ? 'congestion'
      : selectedType === 'danger'
      ? 'corte'
      : 'alerta';

    crearReporte({
      usuarioId: currentUserId || 'usr-anon',
      nombreUsuario: currentUserName || 'Vecino UPPA',
      tipo: firestoreType,
      descripcion: comment.trim() || eventTitle,
      ubicacion: { lat: initialLat, lng: initialLng },
      ruta: selectedRouteId === 'route-vigalondo-mcdonalds' ? 'vigalondo-mcdonalds' : 'campana-zarate',
      sentido: isBusLocation ? busDirection : undefined,
      velocidadKmH: speedData.speedKmH,
    }).catch((err) => console.warn('Firestore report write:', err));

    onClose();
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-5 shadow-2xl relative">
        {/* Header - Not labeled as problem or alert when bus location is selected */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            {isBusLocation ? (
              <>
                <span className="text-cyan-400 text-base">📍</span>
                <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent font-black">
                  Ubicación de colectivo ahora
                </span>
              </>
            ) : (
              <>
                <span>⚠️</span>
                <span>Reportar Evento / Alerta</span>
              </>
            )}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white" aria-label="Cerrar modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-3 space-y-3">
          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-2">
            {EVENT_OPTIONS.slice(0, 4).map((opt) => {
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedType(opt.type)}
                  className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? `${opt.color} ring-1 ring-white/20 shadow-md scale-102`
                      : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-[11px] font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Direction Selector for Ubicación de Colectivo Ahora */}
          {isBusLocation && (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-950/50 via-slate-900 to-slate-900 border border-cyan-500/30 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <span>🧭</span> ¿Hacia dónde va el colectivo?
                </span>
                <span className="text-[10px] text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
                  ⏱️ 1 minuto
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBusDirection('hacia_zarate')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                    busDirection === 'hacia_zarate'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30 font-black scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>➡️</span>
                  <span>Hacia Zárate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBusDirection('hacia_malvinas')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                    busDirection === 'hacia_malvinas'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/30 font-black scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>⬅️</span>
                  <span>Hacia Malvinas</span>
                </button>
              </div>
              <p className="text-[10px] text-cyan-200/70 leading-snug">
                El ícono 📍 quedará visible en el mapa exactamente durante 1 minuto para dar precisión en tiempo real sin desinformar al avanzar.
              </p>
            </div>
          )}

          {/* Other events dropdown */}
          <div className="pt-1">
            <details className="text-xs text-slate-400 group">
              <summary className="cursor-pointer hover:text-slate-200 flex items-center justify-between py-1">
                <span>Otros tipos de alertas...</span>
                <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {EVENT_OPTIONS.slice(4).map((opt) => {
                  const isSelected = selectedType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setSelectedType(opt.type)}
                      className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                        isSelected
                          ? `${opt.color} ring-1 ring-white/20 shadow-md`
                          : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-[11px] font-semibold truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Route selector */}
          <div>
            <label className="text-[10px] text-slate-400 font-medium mb-1 block">Línea de transporte:</label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#0f1422]">
                  {r.shortName}
                </option>
              ))}
            </select>
          </div>

          {/* Optional comment */}
          <div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nota opcional (ej: pasando por arco de Campana)"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className={`w-full h-11 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all ${
              isBusLocation
                ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 shadow-cyan-500/25 font-black'
                : 'bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 shadow-sky-500/20'
            }`}
          >
            {isBusLocation ? (
              <>
                <MapPin className="w-4 h-4 fill-current" />
                <span>📍 Publicar Ubicación Ahora (1 min)</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Publicar Reporte</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
