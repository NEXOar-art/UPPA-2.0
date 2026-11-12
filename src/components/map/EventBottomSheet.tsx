import React from 'react';
import { MapEvent } from '../../types';
import { ThumbsUp, MessageSquare, AlertCircle, CheckCircle2, X, Flag, Share2 } from 'lucide-react';

interface EventBottomSheetProps {
  event: MapEvent | null;
  currentUserId: string;
  onClose: () => void;
  onConfirm: (eventId: string) => void;
  onReportFalse: (eventId: string) => void;
  onOpenContextualChat: (event: MapEvent) => void;
}

export const EventBottomSheet: React.FC<EventBottomSheetProps> = ({
  event,
  currentUserId,
  onClose,
  onConfirm,
  onReportFalse,
  onOpenContextualChat,
}) => {
  if (!event) return null;

  const hasConfirmed = event.confirmedByUserIds.includes(currentUserId);

  const getEventMeta = (type: MapEvent['type']) => {
    switch (type) {
      case 'bus_location':
        return { label: 'Ubicación de colectivo ahora', icon: '📍', color: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-sm' };
      case 'breakdown':
        return { label: 'Averiado', icon: '🔧', color: 'bg-rose-400/20 text-rose-300 border-rose-400/30' };
      case 'late':
        return { label: 'Demorado', icon: '🚌', color: 'bg-amber-400/20 text-amber-300 border-amber-400/30' };
      case 'missed':
        return { label: 'No Paró', icon: '❌', color: 'bg-orange-400/20 text-orange-300 border-orange-400/30' };
      case 'accident':
        return { label: 'Accidente', icon: '💥', color: 'bg-red-400/20 text-red-300 border-red-400/30' };
      case 'traffic':
        return { label: 'Tráfico', icon: '🚗', color: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' };
      case 'moving':
        return { label: 'En Ruta', icon: '⚡', color: 'bg-sky-400/20 text-sky-300 border-sky-400/30' };
      case 'danger':
        return { label: 'Corte', icon: '🚧', color: 'bg-purple-400/20 text-purple-300 border-purple-400/30' };
      default:
        return { label: 'Alerta', icon: '⚠️', color: 'bg-slate-400/20 text-slate-300 border-slate-400/30' };
    }
  };

  const meta = getEventMeta(event.type);
  const isBusLocation = event.type === 'bus_location';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5 flex justify-center pointer-events-none animate-in slide-in-from-bottom duration-300">
      <div className="w-full max-w-sm bg-[#202329] rounded-2xl p-4.5 pointer-events-auto text-white flex flex-col gap-3 shadow-[5px_5px_0px_#101114] border-2 border-white/15">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto cursor-pointer" onClick={onClose} />

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-[11px] text-[#9299A5] font-mono">{event.reportedAt}</span>
              </div>
              <h3 className="text-sm font-black text-white mt-1 leading-snug">
                {event.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Cerrar detalle de este reporte"
            className="w-9 h-9 rounded-xl bg-[#101114] border border-white/15 hover:border-[#FFF19A] text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bloque especial para Ubicación de Colectivo Ahora */}
        {isBusLocation && (
          <div className="p-3 rounded-xl bg-[#101114] border border-[#FFF19A]/45 text-xs space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span>Dirección:</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FFF19A] text-[#101114] font-black">
                  {event.direction === 'hacia_zarate' ? '➡️ Hacia Zárate' : '⬅️ Hacia Malvinas'}
                </span>
              </span>
              {event.velocidadKmH && (
                <span className="font-mono text-[#101114] font-black bg-[#B7F36B] px-2 py-0.5 rounded-md">
                  {event.velocidadKmH} km/h
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-[#9299A5] leading-tight">
              Marcador en vivo: permanece activo por 1 minuto en el mapa para máxima exactitud.
            </p>
          </div>
        )}

        {event.description && (
          <p className="text-xs text-[#9299A5] bg-[#101114] p-3 rounded-xl border border-white/10">
            {event.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onConfirm(event.id)}
            title="Confirmar que este reporte sigue activo en ruta"
            className={`min-h-[44px] rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
              hasConfirmed
                ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                : 'bg-[#FFF19A] hover:brightness-95 text-[#101114] border-[#101114]'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>+{event.confirmations} Confirmar</span>
          </button>

          <button
            onClick={() => onOpenContextualChat(event)}
            title="Comentar este reporte en el chat comunitario"
            className="min-h-[44px] rounded-xl bg-[#101114] hover:border-[#FFF19A] border border-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
