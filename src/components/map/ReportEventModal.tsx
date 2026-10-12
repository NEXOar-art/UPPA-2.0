import React, { useState } from 'react';
import { EventType, TransitRoute, MapEvent } from '../../types';
import { X, MapPin, Send, AlertCircle, Sparkles } from 'lucide-react';
import { crearReporte } from '../../services/realtimeFirebaseService';

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
  const [selectedType, setSelectedType] = useState<EventType>('late');
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || 'route-zarate-malvinas');
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const currentOption = EVENT_OPTIONS.find((o) => o.type === selectedType) || EVENT_OPTIONS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      routeId: selectedRouteId,
      type: selectedType,
      title: currentOption.defaultTitle,
      description: comment.trim(),
      lat: initialLat,
      lng: initialLng,
      reportedBy: currentUserName,
      reportedByUserId: currentUserId,
      direction: 'hacia_malvinas',
      isVerified: false,
    });

    const firestoreType: any =
      selectedType === 'accident'
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
      descripcion: comment.trim() || currentOption.defaultTitle,
      ubicacion: { lat: initialLat, lng: initialLng },
      ruta: selectedRouteId === 'route-vigalondo-mcdonalds' ? 'vigalondo-mcdonalds' : 'campana-zarate',
    }).catch((err) => console.warn('Firestore report write:', err));

    onClose();
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>⚠️</span> Reportar Alerta
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pt-3 space-y-3">
          {/* 6 Big Visual Pastel Cards */}
          <div className="grid grid-cols-3 gap-2">
            {EVENT_OPTIONS.map((opt) => {
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

          {/* Route selector */}
          <div>
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
              placeholder="Nota opcional (ej: cerca de Tenaris)"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar Reporte</span>
          </button>
        </form>
      </div>
    </div>
  );
};
