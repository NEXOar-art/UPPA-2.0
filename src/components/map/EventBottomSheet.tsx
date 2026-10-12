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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5 flex justify-center pointer-events-none animate-in slide-in-from-bottom duration-300">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-4.5 pointer-events-auto text-slate-100 flex flex-col gap-3 shadow-2xl border-white/10">
        {/* Grab Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto cursor-pointer" onClick={onClose} />

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{event.reportedAt}</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5 leading-snug">
                {event.title}
              </h3>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {event.description && (
          <p className="text-xs text-slate-300 bg-white/[0.03] p-2.5 rounded-2xl border border-white/5">
            {event.description}
          </p>
        )}

        {/* Buttons (Pastel Action Pills) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onConfirm(event.id)}
            className={`h-10 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              hasConfirmed
                ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40'
                : 'bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 shadow-md shadow-sky-400/20'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>+{event.confirmations} Confirmar</span>
          </button>

          <button
            onClick={() => onOpenContextualChat(event)}
            className="h-10 rounded-2xl glass-button text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-300" />
            <span>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
