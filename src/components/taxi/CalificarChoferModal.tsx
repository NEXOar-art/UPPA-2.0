import React, { useState } from 'react';
import { X, Star, Check, Award, MessageSquare, AlertCircle } from 'lucide-react';
import { calificarChofer, getCalificacionInfo } from '../../services/realtimeFirebaseService';
import { CalificacionChoferFirestore } from '../../types';

interface CalificarChoferModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  pasajeroId: string;
  pasajeroNombre: string;
  onSuccess?: (calificacion: CalificacionChoferFirestore) => void;
}

export const CalificarChoferModal: React.FC<CalificarChoferModalProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  pasajeroId,
  pasajeroNombre,
  onSuccess,
}) => {
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cal = await calificarChofer({
        driverId,
        driverName,
        pasajeroId: pasajeroId || `usr-${Date.now()}`,
        pasajeroNombre: pasajeroNombre || 'Pasajero Comunidad',
        puntuacion: selectedRating,
        comentario,
      });

      setSuccessNotice('¡Calificación guardada! Ya forma parte del ranking en vivo de las últimas 3 horas.');
      if (onSuccess) onSuccess(cal);

      setTimeout(() => {
        setSuccessNotice(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      alert('Error al calificar: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const scaleOptions: Array<{ score: 1 | 2 | 3 | 4 | 5; label: string; desc: string }> = [
    { score: 1, label: '1 - Muy Bueno', desc: 'Excelente atención, puntualidad y vehículo' },
    { score: 2, label: '2 - Bueno', desc: 'Servicio satisfactorio y viaje correcto' },
    { score: 3, label: '3 - Regular', desc: 'Servicio estándar con aspectos a mejorar' },
    { score: 4, label: '4 - Malo', desc: 'Inconvenientes o demoras en el servicio' },
    { score: 5, label: '5 - Muy Malo', desc: 'Deficiente, descortés o cobro indebido' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0e18] border border-amber-500/40 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Star className="w-5 h-5 fill-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Calificar al Prestador</h3>
              <p className="text-xs text-amber-300 font-semibold">{driverName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative scale notice */}
        <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 space-y-0.5">
          <span className="font-bold flex items-center gap-1 text-amber-300">
            <Award className="w-3.5 h-3.5" />
            Escala oficial de 1 a 5:
          </span>
          <p className="text-slate-300 text-[11px]">
            <strong className="text-emerald-300">1 es Muy Bueno</strong> y <strong className="text-rose-300">5 es Muy Malo</strong>. Tu voto aparecerá en el ranking en vivo de las últimas 3 horas.
          </p>
        </div>

        {successNotice ? (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2 animate-in zoom-in-95">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rating Buttons 1 to 5 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Seleccioná la calificación:
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {scaleOptions.map((opt) => {
                  const isSelected = selectedRating === opt.score;
                  const info = getCalificacionInfo(opt.score);
                  return (
                    <button
                      type="button"
                      key={opt.score}
                      onClick={() => setSelectedRating(opt.score)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? `${info.badgeClass} ring-1 ring-amber-400 shadow-md`
                          : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {opt.score}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{opt.label}</span>
                            <span className="text-[10px] font-mono text-amber-300">{info.stars}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{opt.desc}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Comment */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Comentario u opinión (Opcional)
              </label>
              <textarea
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ej: Puntual, trato cordial y vehículo muy limpio..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Star className="w-4 h-4 fill-slate-950" />
              <span>{isSubmitting ? 'Guardando Calificación...' : 'Publicar Calificación'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
