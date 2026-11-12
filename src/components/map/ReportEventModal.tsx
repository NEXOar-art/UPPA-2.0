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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#202329] border-2 border-[#FFF19A]/45 rounded-2xl p-5 shadow-[6px_6px_0px_#101114] relative">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            {isBusLocation ? (
              <>
                <span className="text-[#FFF19A] text-base">📍</span>
                <span className="text-[#FFF19A] font-black">
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
          <button
            onClick={onClose}
            title="Cerrar ventana para reportar evento"
            className="w-9 h-9 rounded-xl bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-3.5 space-y-3">
          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-2">
            {EVENT_OPTIONS.slice(0, 4).map((opt) => {
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedType(opt.type)}
                  title={`Seleccionar tipo de reporte: ${opt.label}`}
                  className={`min-h-[60px] p-2.5 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFF19A] border-[#101114] text-[#101114]'
                      : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white hover:border-white/25'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-[11px] font-extrabold leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Direction Selector for Ubicación de Colectivo Ahora */}
          {isBusLocation && (
            <div className="p-3 rounded-xl bg-[#101114] border border-[#FFF19A]/40 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#FFF19A]">
                  ¿Hacia dónde va el colectivo?
                </span>
                <span className="text-[10px] text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded font-mono font-black">
                  1 min
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBusDirection('hacia_zarate')}
                  title="Indicar que el colectivo va hacia Zárate"
                  className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                    busDirection === 'hacia_zarate'
                      ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                      : 'bg-[#202329] border-white/15 text-[#9299A5] hover:text-white'
                  }`}
                >
                  <span>➡️</span>
                  <span>Hacia Zárate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBusDirection('hacia_malvinas')}
                  title="Indicar que el colectivo va hacia Barrio Malvinas"
                  className={`min-h-[44px] py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                    busDirection === 'hacia_malvinas'
                      ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                      : 'bg-[#202329] border-white/15 text-[#9299A5] hover:text-white'
                  }`}
                >
                  <span>⬅️</span>
                  <span>Hacia Malvinas</span>
                </button>
              </div>
              <p className="text-[10px] text-[#9299A5] leading-snug">
                El ícono 📍 quedará visible en el mapa durante 1 minuto y se avisará en el chat comunitario.
              </p>
            </div>
          )}

          {/* Other events dropdown */}
          <div className="pt-1">
            <details className="text-xs text-[#9299A5] group">
              <summary className="cursor-pointer hover:text-white flex items-center justify-between py-1 font-bold">
                <span>Otros tipos de alertas...</span>
                <span className="text-[10px] text-[#9299A5] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="grid grid-cols-2 gap-1.5 pt-2">
                {EVENT_OPTIONS.slice(4).map((opt) => {
                  const isSelected = selectedType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setSelectedType(opt.type)}
                      title={`Seleccionar alerta: ${opt.label}`}
                      className={`min-h-[44px] p-2 rounded-xl border text-center transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFF19A] border-[#101114] text-[#101114] font-black'
                          : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-[11px] font-bold truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          </div>

          {/* Route selector */}
          <div>
            <label className="text-[10.5px] text-[#9299A5] font-bold mb-1 block">Línea de transporte:</label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full min-h-[44px] bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A]"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#101114]">
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
              className="w-full min-h-[44px] bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
            />
          </div>

          <button
            type="submit"
            title={isBusLocation ? 'Publicar ubicación del colectivo en el mapa y chat' : 'Publicar reporte en el mapa y chat'}
            className={`w-full min-h-[48px] font-black text-xs rounded-xl flex items-center justify-center gap-1.5 border-2 border-[#101114] active:scale-95 transition-all cursor-pointer ${
              isBusLocation
                ? 'bg-[#B7F36B] hover:brightness-95 text-[#101114]'
                : 'bg-[#FFF19A] hover:brightness-95 text-[#101114]'
            }`}
          >
            {isBusLocation ? (
              <>
                <MapPin className="w-4 h-4" />
                <span>Publicar Ubicación Ahora (1 min)</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publicar Reporte</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
