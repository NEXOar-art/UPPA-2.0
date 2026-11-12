import React, { useState } from 'react';
import { X, Star, Check, Award } from 'lucide-react';
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
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
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
      setErrorMsg('Error al calificar: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const scaleOptions: Array<{ score: 1 | 2 | 3 | 4 | 5; label: string; desc: string }> = [
    { score: 5, label: '5 - Muy Bueno', desc: 'Excelente atención, puntualidad y vehículo (Puntaje Máximo)' },
    { score: 4, label: '4 - Bueno', desc: 'Servicio satisfactorio y viaje correcto' },
    { score: 3, label: '3 - Regular', desc: 'Servicio estándar con aspectos a mejorar' },
    { score: 2, label: '2 - Insuficiente', desc: 'Inconvenientes o demoras en el servicio' },
    { score: 1, label: '1 - Malo', desc: 'Deficiente, descortés o cobro indebido' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#202329] border-2 border-white/20 rounded-3xl p-5 sm:p-6 text-white shadow-[0_8px_0_rgba(0,0,0,0.65)] relative space-y-4">
        <div className="h-1.5 w-full rounded-full bg-[#FFF19A]" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-[#101114] border border-[#FFF19A]/50 flex items-center justify-center text-[#FFF19A]">
              <Star className="w-5 h-5 fill-[#FFF19A]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white font-display">Calificar al Prestador</h3>
              <p className="text-xs text-[#FFF19A] font-semibold">{driverName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar ventana de calificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative scale notice */}
        <div className="p-3 rounded-2xl bg-[#101114] border border-white/10 text-[11px] text-[#9299A5] space-y-0.5">
          <span className="font-bold flex items-center gap-1.5 text-[#FFF19A]">
            <Award className="w-3.5 h-3.5" />
            Escala oficial de 1 a 5:
          </span>
          <p className="text-[#9299A5] text-[11px]">
            <strong className="text-white">1 es Malo</strong> y <strong className="text-[#B7F36B]">5 es Muy Bueno</strong>. Tu voto aparecerá en el ranking en vivo de las últimas 3 horas.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs">
            {errorMsg}
          </div>
        )}

        {successNotice ? (
          <div className="p-4 rounded-2xl bg-[#B7F36B]/15 border border-[#B7F36B]/50 text-[#B7F36B] text-xs flex items-center gap-2 animate-in zoom-in-95">
            <Check className="w-5 h-5 text-[#B7F36B] shrink-0" />
            <span className="font-bold">{successNotice}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rating Buttons 1 to 5 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white block">
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
                      title={`Seleccionar calificación ${opt.label}`}
                      className={`w-full min-h-[46px] p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#101114] border-[#FFF19A] text-white shadow-[0_2px_0_#FFF19A]'
                          : 'bg-[#101114]/70 border-white/10 text-[#9299A5] hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs ${
                            isSelected ? 'bg-[#FFF19A] text-[#101114]' : 'bg-[#202329] text-white border border-white/10'
                          }`}
                        >
                          {opt.score}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{opt.label}</span>
                            <span className="text-[10px] font-mono text-[#FFF19A]">{info.stars}</span>
                          </div>
                          <span className="text-[10px] text-[#9299A5]">{opt.desc}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#B7F36B] stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Comment */}
            <div>
              <label className="text-xs font-semibold text-white block mb-1">
                Comentario u opinión (Opcional)
              </label>
              <textarea
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ej: Puntual, trato cordial y vehículo muy limpio..."
                className="w-full px-3 py-2 rounded-xl bg-[#101114] border border-white/15 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              title="Publicar calificación en el ranking en vivo de UPPA"
              className="w-full h-12 rounded-xl uppa-cta-yellow text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Star className="w-4 h-4 fill-[#101114]" />
              <span>{isSubmitting ? 'Guardando Calificación...' : 'Publicar Calificación'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
